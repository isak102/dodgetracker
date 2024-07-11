use std::time::Duration;

use anyhow::Result;
use futures::future::join_all;
use log::{error, info, warn};
use sea_orm::{sea_query::OnConflict, ActiveValue::Set, DatabaseTransaction, EntityTrait};
use serde::Deserialize;
use tokio::spawn;
use urlencoding::encode;

use crate::{config::INSERT_CHUNK_SIZE, entities::riot_ids, util::with_timeout};

#[derive(Deserialize, Debug)]
struct LolprosProfile {
    slug: String,
}

async fn get_lolpros_slug(game_name: String, tag_line: String) -> Result<Option<String>> {
    let query = encode(format!("{}#{}", game_name, tag_line).as_str()).to_string();
    let url = format!("https://api.lolpros.gg/es/search?query={}", query);

    let profiles: Vec<LolprosProfile> = reqwest::get(&url).await?.json().await?;

    if profiles.is_empty() {
        Ok(None)
    } else {
        Ok(Some(profiles[0].slug.clone()))
    }
}

pub async fn upsert_lolpros_slugs(
    accounts: &[riot_ids::ActiveModel],
    txn: &DatabaseTransaction,
) -> Result<()> {
    let t1 = std::time::Instant::now();
    info!(
        "[EUW1]: Starting lolpros query for {} accounts...",
        accounts.len()
    );

    let futures = accounts.iter().map(|model| {
        let game_name = model.game_name.clone().unwrap();
        let tag_line = model.tag_line.clone().unwrap();
        spawn(with_timeout(
            Duration::from_secs(5),
            get_lolpros_slug(game_name, tag_line),
        ))
    });

    let results: Vec<_> = join_all(futures).await;
    info!("[EUW1]: Lolpros query time taken: {:?}.", t1.elapsed());

    let accounts_with_slug: Vec<riot_ids::ActiveModel> = accounts
        .iter()
        .zip(results)
        .filter_map(|(model, result)| match result.ok()? {
            Ok(Ok(Some(slug))) => Some(riot_ids::ActiveModel {
                puuid: model.puuid.clone(),
                lolpros_slug: Set(Some(slug)),
                ..Default::default()
            }),
            Ok(Err(e)) => {
                warn!("[EUW1]: A lolpros API query failed: {}", e);
                None
            }
            Err(e) => {
                warn!("[EUW1]: A lolpros API query timed out: {}", e);
                None
            }
            _ => None,
        })
        .collect();

    let t2 = std::time::Instant::now();
    info!(
        "[EUW1]: Upserting {} lolpros slugs into DB...",
        accounts_with_slug.len()
    );

    for chunk in accounts_with_slug.chunks(INSERT_CHUNK_SIZE) {
        riot_ids::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                OnConflict::column(riot_ids::Column::Puuid)
                    .update_columns([riot_ids::Column::LolprosSlug, riot_ids::Column::UpdatedAt])
                    .to_owned(),
            )
            .exec(txn)
            .await?;
    }

    info!(
        "[EUW1]: Upserted {} lolpros slugs into DB in {:?}.",
        accounts_with_slug.len(),
        t2.elapsed()
    );
    Ok(())
}
