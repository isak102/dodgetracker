use std::time::Duration;

use anyhow::Result;
use futures::future::join_all;
use log::{error, info, warn};
use riven::consts::PlatformRoute;
use sea_orm::sea_query::OnConflict;
use sea_orm::DatabaseTransaction;
use sea_orm::{ActiveValue::Set, EntityTrait};
use tokio::spawn;

use crate::config::INSERT_CHUNK_SIZE;
use crate::util::with_timeout;
use crate::{entities::riot_ids, riot_api::RIOT_API};

pub async fn update_riot_ids(
    puuids: &[String],
    region: PlatformRoute,
    txn: &DatabaseTransaction,
) -> Result<Vec<riot_ids::ActiveModel>> {
    let t1 = std::time::Instant::now();

    info!(
        "[{}]: Getting account info from API for {} Riot IDs...",
        region,
        puuids.len()
    );

    let futures = puuids.iter().map(|puuid| {
        spawn(with_timeout(
            Duration::from_secs(5),
            RIOT_API
                .account_v1()
                .get_by_puuid(riven::consts::RegionalRoute::EUROPE, puuid),
        ))
    });

    let results: Vec<_> = join_all(futures).await;
    info!("[{}]: Got accounts from API in {:?}.", region, t1.elapsed());

    let riot_id_models: Vec<riot_ids::ActiveModel> = results
        .iter()
        .filter_map(|r| match r.as_ref().expect("Join failed") {
            Ok(Ok(a)) => {
                if let (Some(game_name), Some(tag_line)) =
                    (a.game_name.as_ref(), a.tag_line.as_ref())
                {
                    Some(riot_ids::ActiveModel {
                        puuid: Set(a.puuid.clone()),
                        game_name: Set(game_name.clone()),
                        tag_line: Set(tag_line.clone()),
                        ..Default::default()
                    })
                } else {
                    error!(
                        "[{}]: Missing game_name or tag_line for puuid: {}",
                        region, a.puuid
                    );
                    None
                }
            }
            Ok(Err(e)) => {
                error!(
                    "[{}]: Error getting account info for a puuid: {}",
                    region, e
                );
                None
            }
            Err(e) => {
                error!("[{}]: An account API query timed out: {}.", region, e);
                None
            }
        })
        .collect();

    let t2 = std::time::Instant::now();
    info!(
        "[{}]: Inserting {} Riot IDs into DB...",
        region,
        riot_id_models.len()
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
        "[{}]: Inserted {} Riot IDs into DB in {:?}.",
        region,
        riot_id_models.len(),
        t2.elapsed()
    );

    Ok(riot_id_models)
}
