extern crate dotenv;
use std::collections::HashMap;
use std::time::Instant;

use anyhow::Result;
use futures::future::join_all;
use lazy_static::lazy_static;
use log::{error, info};
use riven::consts::PlatformRoute;
use sea_orm::ActiveValue::Set;
use sea_orm::TransactionTrait;
use tokio::spawn;
use tokio::time::sleep;
use tokio::time::Duration;

mod apex_tier_players;
mod config;
mod db;
mod dodges;
mod entities;
mod logger;
mod lolpros;
mod player_counts;
mod promotions_demotions;
mod riot_api;
mod riot_ids;
mod summoners;
mod util;

const SUPPORTED_REGIONS: [PlatformRoute; 5] = [
    PlatformRoute::EUW1,
    PlatformRoute::EUN1,
    PlatformRoute::NA1,
    PlatformRoute::KR,
    PlatformRoute::OC1,
];

lazy_static! {
    static ref THROTTLES: HashMap<PlatformRoute, i32> = {
        let mut m = HashMap::new();
        m.insert(PlatformRoute::EUW1, 3);
        m.insert(PlatformRoute::EUN1, 6);
        m.insert(PlatformRoute::NA1, 12);
        m.insert(PlatformRoute::KR, 12);
        m.insert(PlatformRoute::OC1, 6);
        m
    };
}

const RETRY_WAIT_SECS: u64 = 5;

async fn sleep_thread(duration: Duration, region: PlatformRoute) {
    info!(
        "[{}]: Sleeping for {} seconds...",
        region,
        duration.as_secs()
    );
    sleep(duration).await;
}

#[allow(unreachable_code)]
async fn run_region(region: PlatformRoute) {
    info!("[{}]: Getting DB connection...", region);
    let db = db::get_db().await;

    loop {
        let t1 = Instant::now();

        info!("[{}]: Starting transaction...", region);
        let txn = match db.begin().await {
            Ok(txn) => txn,
            Err(e) => {
                error!("[{}]: Failed to start transaction: {}", region, e);
                sleep_thread(Duration::from_secs(RETRY_WAIT_SECS), region).await;
                continue;
            }
        };

        let t2 = Instant::now();
        let (api_players, (master_count, grandmaster_count, challenger_count)) =
            match apex_tier_players::get_players_from_api(region).await {
                Ok(r) => r,
                Err(e) => {
                    error!("[{}]: Error getting players from Riot API: {}", region, e);
                    sleep_thread(Duration::from_secs(RETRY_WAIT_SECS), region).await;
                    continue;
                }
            };

        let db_players = match apex_tier_players::get_players_from_db(&txn, region).await {
            Ok(res) => res,
            Err(e) => {
                error!("[{}]: Error getting players from DB: {}", region, e);
                sleep_thread(Duration::from_secs(RETRY_WAIT_SECS), region).await;
                continue;
            }
        };

        let dodges = dodges::find_dodges(&db_players, &api_players, region).await;

        if !dodges.is_empty() {
            let summoner_ids: Vec<&str> = dodges
                .iter()
                .filter_map(|dodge| match &dodge.summoner_id {
                    Set(id) => Some(id.as_str()),
                    _ => None,
                })
                .collect();

            let riot_ids = match summoners::update_summoners(&summoner_ids, region, &txn).await {
                Ok(res) => res,
                Err(e) => {
                    error!("[{}]: Error updating summoners table: {}", region, e);
                    sleep_thread(Duration::from_secs(RETRY_WAIT_SECS), region).await;
                    continue;
                }
            };

            let riot_id_models = match riot_ids::update_riot_ids(&riot_ids, region, &txn).await {
                Ok(res) => res,
                Err(e) => {
                    error!("[{}]: Error updating riot_ids table: {}", region, e);
                    sleep_thread(Duration::from_secs(RETRY_WAIT_SECS), region).await;
                    continue;
                }
            };

            if let Err(e) = lolpros::upsert_lolpros_slugs(&riot_id_models, &txn).await {
                error!(
                    "[{}]: Error upserting Lolpros slugs: {}. Ignoring.",
                    region, e
                );
            }

            if let Err(e) = dodges::insert_dodges(&dodges, &txn, region).await {
                error!("[{}]: Error inserting dodges: {}", region, e);
                sleep_thread(Duration::from_secs(RETRY_WAIT_SECS), region).await;
                continue;
            }
        }

        if let Err(e) = apex_tier_players::upsert_players(&api_players, region, &txn).await {
            error!("[{}]: Error upserting players: {}", region, e);
            sleep_thread(Duration::from_secs(RETRY_WAIT_SECS), region).await;
            continue;
        }

        if let Err(e) =
            promotions_demotions::insert_promotions(&api_players, &db_players, region, &txn).await
        {
            error!("[{}]: Error inserting promotions: {}", region, e);
            sleep_thread(Duration::from_secs(RETRY_WAIT_SECS), region).await;
            continue;
        }
        if let Err(e) =
            promotions_demotions::insert_demotions(&api_players, &db_players, region, &txn).await
        {
            error!("[{}]: Error inserting demotions: {}", region, e);
            sleep_thread(Duration::from_secs(RETRY_WAIT_SECS), region).await;
            continue;
        }

        if let Err(e) = player_counts::update_player_counts(
            master_count,
            grandmaster_count,
            challenger_count,
            region,
            &txn,
        )
        .await
        {
            error!(
                "[{}]: Error updating player counts: {}. Ignoring.",
                region, e
            );
        }

        info!("[{}]: Committing transaction...", region);
        if let Err(e) = txn.commit().await {
            error!("[{}]: Failed to commit transaction: {:?}", region, e);
            sleep_thread(Duration::from_secs(RETRY_WAIT_SECS), region).await;
            continue;
        }
        info!(
            "[{}]: PERFORMANCE: Region update took {:?}.",
            region,
            t1.elapsed()
        );

        if let Some(sleep_duration) =
            Duration::from_secs(THROTTLES[&region] as u64).checked_sub(t2.elapsed())
        {
            info!(
                "[{}]: Sleeping for {} seconds...",
                region,
                sleep_duration.as_secs_f32()
            );
            sleep(sleep_duration).await;
        }
    }
}

async fn run() -> Result<()> {
    let mut tasks = vec![];

    for &region in SUPPORTED_REGIONS.iter() {
        tasks.push(spawn(async move { run_region(region).await }));
    }

    // Wait for all tasks to complete and collect the results
    let _results = join_all(tasks).await;

    Ok(())
}

#[tokio::main]
async fn main() {
    let _logger = logger::init();
    run().await.unwrap();
}