use std::time::{Duration, Instant};

use anyhow::Result;
use futures::future::join_all;
use sea_orm::{sea_query::OnConflict, ActiveValue::Set, DatabaseTransaction, EntityTrait};
use serde::Deserialize;
use tracing::{info, instrument, warn};
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

#[instrument(skip(accounts, txn), fields(accounts = accounts.len()))]
pub async fn upsert_lolpros_slugs(
    accounts: &[riot_ids::ActiveModel],
    txn: &DatabaseTransaction,
) -> Result<()> {
    let t1 = Instant::now();
    info!("Starting lolpros queries...");

    let results: Vec<_> = join_all(accounts.iter().map(|model| {
        let game_name = model.game_name.clone().unwrap();
        let tag_line = model.tag_line.clone().unwrap();
        with_timeout(
            Duration::from_secs(5),
            get_lolpros_slug(game_name, tag_line),
        )
    }))
    .await;

    info!(
        perf = t1.elapsed().as_millis(),
        queries = results.len(),
        metric = "lolpros_api_query",
        "Lolpros API queries completed."
    );

    let accounts_with_slug: Vec<riot_ids::ActiveModel> = accounts
        .iter()
        .zip(results)
        .filter_map(|(model, result)| match result {
            Ok(Ok(Some(slug))) => Some(riot_ids::ActiveModel {
                puuid: model.puuid.clone(),
                lolpros_slug: Set(Some(slug)),
                ..Default::default()
            }),
            Ok(Err(e)) => {
                warn!(
                    game_name = model.game_name.clone().unwrap(),
                    tag_line = model.game_name.clone().unwrap(),
                    puuid = model.puuid.clone().unwrap(),
                    error = ?e,
                    "Lolpros API query failed. Ignoring.",
                );
                None
            }
            Err(e) => {
                warn!(
                    game_name = model.game_name.clone().unwrap(),
                    tag_line = model.game_name.clone().unwrap(),
                    puuid = model.puuid.clone().unwrap(),
                    error = ?e,
                    "Lolpros API query timed out. Ignoring.",
                );
                None
            }
            _ => None,
        })
        .collect();

    if accounts_with_slug.is_empty() {
        return Ok(());
    }

    let t2 = Instant::now();
    info!(
        slugs = accounts_with_slug.len(),
        "Upserting lolpros slugs into DB...",
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
        perf = t2.elapsed().as_millis(),
        slugs = accounts_with_slug.len(),
        metric = "lolpros_db_upsert",
        "Upserted lolpros slugs into DB."
    );
    Ok(())
}
