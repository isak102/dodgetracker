use anyhow::Result;
use riven::consts::PlatformRoute;
use sea_orm::sea_query::OnConflict;
use sea_orm::DatabaseTransaction;
use sea_orm::{ActiveValue::Set, EntityTrait};
use tokio::task;

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
    let t1 = std::time::Instant::now();
    println!(
        "Updating {} summoners for region: {}",
        summoner_ids.len(),
        region
    );

    let futures = summoner_ids
        .iter()
        .map(|s_id| task::spawn(RIOT_API.summoner_v4().get_by_summoner_id(region, s_id)));

    let results: Vec<_> = futures::future::join_all(futures).await;

    println!(
        "{} Summoners API query time taken: {:?}",
        region,
        t1.elapsed()
    );

    let summoner_models: Vec<entities::summoners::ActiveModel> = results
        .iter()
        .filter_map(|r| match r.as_ref().expect("Join error failed") {
            Ok(s) => Some(summoners::ActiveModel {
                puuid: Set(s.puuid.clone()),
                summoner_id: Set(Some(s.id.clone())),
                region: Set(region.to_string()),
                account_id: Set(Some(s.account_id.clone())),
                profile_icon_id: Set(s.profile_icon_id),
                summoner_level: Set(s.summoner_level),
                ..Default::default()
            }),
            Err(_) => None,
        })
        .collect();

    let t2 = std::time::Instant::now();

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
                    ])
                    .to_owned(),
            )
            .exec(txn)
            .await?;
    }

    println!("{} Summoners insert time taken: {:?}", region, t2.elapsed());

    Ok(summoner_models
        .iter()
        .filter_map(|s| match s.summoner_id {
            Set(Some(ref id)) => Some(id.clone()),
            _ => None,
        })
        .collect())
}
