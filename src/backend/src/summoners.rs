use std::time::{Duration, Instant};

use anyhow::Result;
use futures::future::join_all;
use riven::consts::PlatformRoute;
use sea_orm::sea_query::OnConflict;
use sea_orm::DatabaseTransaction;
use sea_orm::{ActiveValue::Set, EntityTrait};
use tracing::{error, info, instrument};

use crate::util::with_timeout;
use crate::{
    config::INSERT_CHUNK_SIZE,
    entities::{self, summoners},
    riot_api::RIOT_API,
};

#[instrument(skip_all, fields(summoners = summoner_ids.len()))]
pub async fn upsert_summoners(
    summoner_ids: &[&str],
    region: PlatformRoute,
    txn: &DatabaseTransaction,
) -> Result<Vec<String>> {
    let t1 = Instant::now();
    info!("Getting summoner info from league API for summoners...");

    let results = join_all(summoner_ids.iter().map(|s_id| {
        with_timeout(
            Duration::from_secs(10),
            RIOT_API.summoner_v4().get_by_summoner_id(region, s_id),
        )
    }))
    .await;

    info!(
        perf = t1.elapsed().as_millis(),
        summoners = results.len(),
        metric = "summoner_api_query",
        "Got summoners from API."
    );

    let summoner_models: Vec<entities::summoners::ActiveModel> = results
        .iter()
        .filter_map(|r| match r.as_ref() {
            Ok(Ok(s)) => Some(summoners::ActiveModel {
                puuid: Set(s.puuid.clone()),
                summoner_id: Set(Some(s.id.clone())),
                region: Set(region.to_string()),
                account_id: Set(Some(s.account_id.clone())),
                profile_icon_id: Set(s.profile_icon_id),
                summoner_level: Set(s.summoner_level),
                ..Default::default()
            }),
            Ok(Err(e)) => {
                error!(error = ?e, "A summoner API query failed");
                None
            }
            Err(e) => {
                error!(error = ?e, "A summoner API query timed out");
                None
            }
        })
        .collect();

    let t2 = Instant::now();
    info!(
        summoners = summoner_models.len(),
        "Upserting summoners into DB...",
    );

    for chunk in summoner_models.chunks(INSERT_CHUNK_SIZE) {
        summoners::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                OnConflict::column(summoners::Column::Puuid)
                    .update_columns([
                        summoners::Column::SummonerId,
                        summoners::Column::Region,
                        summoners::Column::AccountId,
                        summoners::Column::ProfileIconId,
                        summoners::Column::SummonerLevel,
                        summoners::Column::UpdatedAt,
                    ])
                    .to_owned(),
            )
            .exec(txn)
            .await?;
    }

    info!(
        perf = t2.elapsed().as_millis(),
        summoners = summoner_models.len(),
        metric = "summoners_upsert",
        "Upserted summoners into DB."
    );

    Ok(summoner_models
        .iter()
        .filter_map(|s| match s.puuid {
            Set(ref id) => Some(id.clone()),
            _ => None,
        })
        .collect())
}
