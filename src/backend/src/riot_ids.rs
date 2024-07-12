use std::time::{Duration, Instant};

use anyhow::Result;
use futures::future::join_all;
use sea_orm::sea_query::OnConflict;
use sea_orm::DatabaseTransaction;
use sea_orm::{ActiveValue::Set, EntityTrait};
use tracing::{error, info, instrument};

use crate::config::INSERT_CHUNK_SIZE;
use crate::util::with_timeout;
use crate::{entities::riot_ids, riot_api::RIOT_API};

#[instrument(skip_all, fields(puuids = puuids.len()))]
pub async fn update_riot_ids(
    puuids: &[String],
    txn: &DatabaseTransaction,
) -> Result<Vec<riot_ids::ActiveModel>> {
    let t1 = Instant::now();
    info!("Getting account infos from Riot API...",);

    let results = join_all(puuids.iter().map(|puuid| {
        with_timeout(
            Duration::from_secs(5),
            RIOT_API
                .account_v1()
                .get_by_puuid(riven::consts::RegionalRoute::EUROPE, puuid),
        )
    }))
    .await;

    info!(
        perf = t1.elapsed().as_millis(),
        metric = "accounts_api_query",
        "Accounts API queries completed."
    );

    let riot_id_models: Vec<riot_ids::ActiveModel> = puuids
        .iter()
        .zip(results.iter())
        .filter_map(|(puuid, result)| match result.as_ref() {
            Ok(Ok(a)) => {
                if a.game_name.is_none() || a.tag_line.is_none() {
                    error!(puuid, account = ?a, "Missing game_name or tag_line for puuid, skipping.");
                    return None
                }
                Some(riot_ids::ActiveModel {
                    puuid: Set(a.puuid.clone()),
                    game_name: Set(a.game_name.clone().unwrap()),
                    tag_line: Set(a.tag_line.clone().unwrap()),
                    ..Default::default()
                })
            }
            Ok(Err(e)) => {
                error!(puuid, error = ?e, "An account API query failed.");
                None
            }
            Err(e) => {
                error!(puuid, error = ?e, "An account API query timed out.");
                None
            }
        })
        .collect();

    let t2 = Instant::now();
    info!(
        accounts = riot_id_models.len(),
        "Upserting accounts into DB..."
    );

    for chunk in riot_id_models.chunks(INSERT_CHUNK_SIZE) {
        riot_ids::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                OnConflict::column(riot_ids::Column::Puuid)
                    .update_columns([
                        riot_ids::Column::GameName,
                        riot_ids::Column::TagLine,
                        riot_ids::Column::UpdatedAt,
                    ])
                    .to_owned(),
            )
            .exec(txn)
            .await?;
    }

    info!(
        perf = t2.elapsed().as_millis(),
        accounts = riot_id_models.len(),
        metric = "accounts_upserted",
        "Upserted accounts into DB."
    );

    Ok(riot_id_models)
}
