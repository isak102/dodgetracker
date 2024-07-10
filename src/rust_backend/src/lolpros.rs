use anyhow::Result;
use sea_orm::{sea_query::OnConflict, ActiveValue::Set, DatabaseTransaction, EntityTrait};
use serde::Deserialize;
use tokio::task;
use urlencoding::encode;

use crate::{config::INSERT_CHUNK_SIZE, entities::riot_ids};

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
    println!("Starting lolpros query for {} accounts", accounts.len());
    let futures = accounts.iter().map(|model| {
        let game_name = model.game_name.clone().unwrap();
        let tag_line = model.tag_line.clone().unwrap();
        task::spawn(get_lolpros_slug(game_name, tag_line))
    });

    let results: Vec<_> = futures::future::join_all(futures).await;
    println!("Lolpros API query time taken: {:?}", t1.elapsed());

    let accounts_with_slug: Vec<riot_ids::ActiveModel> = accounts
        .iter()
        .zip(results)
        .filter_map(|(model, result)| match result {
            Ok(Ok(Some(slug))) => Some(riot_ids::ActiveModel {
                puuid: model.puuid.clone(),
                lolpros_slug: Set(Some(slug)),
                ..Default::default()
            }),
            _ => None,
        })
        .collect();

    let t2 = std::time::Instant::now();
    println!(
        "Inserting {} lolpros slugs into DB",
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

    println!("Lolpros upsert time taken: {:?}", t2.elapsed());
    Ok(())
}
