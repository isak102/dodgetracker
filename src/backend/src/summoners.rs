use std::time::{Duration, Instant};

use anyhow::Result;
use futures::future::join_all;
use log::{error, info};
use riven::consts::PlatformRoute;
use sea_orm::sea_query::OnConflict;
use sea_orm::DatabaseTransaction;
use sea_orm::{ActiveValue::Set, EntityTrait};

use crate::util::with_timeout;
use crate::{
    config::INSERT_CHUNK_SIZE,
    entities::{self, summoners},
    riot_api::RIOT_API,
};

pub async fn update_summoners(
    summoner_ids: &[&str],
    region: PlatformRoute,
    txn: &DatabaseTransaction,
) -> Result<Vec<String>> {
    let t1 = Instant::now();
    info!(
        "[{}]: Getting summoner info from API for {} summoners...",
        region,
        summoner_ids.len()
    );

    let results = join_all(summoner_ids.iter().map(|s_id| {
        with_timeout(
            Duration::from_secs(10),
            RIOT_API.summoner_v4().get_by_summoner_id(region, s_id),
        )
    }))
    .await;

    info!(
        "[{}]: Got summoners from API in {:?}.",
        region,
        t1.elapsed()
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
                error!("[{}]: A summoner API query failed: {}", region, e);
                None
            }
            Err(e) => {
                error!("[{}]: A summoner API query timed out: {}", region, e);
                None
            }
        })
        .collect();

    let t2 = Instant::now();
    info!(
        "[{}]: Upserting {} summoners into DB...",
        region,
        summoner_models.len()
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
        "[{}]: Upserted {} summoners into DB in {:?}.",
        region,
        summoner_models.len(),
        t2.elapsed()
    );

    Ok(summoner_models
        .iter()
        .filter_map(|s| match s.puuid {
            Set(ref id) => Some(id.clone()),
            _ => None,
        })
        .collect())
}
