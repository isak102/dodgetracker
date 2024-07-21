extern crate dotenv;
use std::collections::HashMap;
use std::time::Instant;

use anyhow::Result;
use futures::future::join_all;
use lazy_static::lazy_static;
use riven::consts::PlatformRoute;
use sea_orm::ActiveValue::Set;
use sea_orm::TransactionTrait;
use tokio::spawn;
use tokio::time::sleep;
use tokio::time::Duration;
use tracing::instrument;
use tracing::{error, info};

mod apex_tier_players;
mod config;
mod db;
mod dodges;
mod entities;
mod latest_updates;
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
    static ref THROTTLES: HashMap<PlatformRoute, Duration> = {
        let mut m = HashMap::new();
        m.insert(PlatformRoute::EUW1, Duration::from_millis(7000));
        m.insert(PlatformRoute::EUN1, Duration::from_millis(7000));
        m.insert(PlatformRoute::NA1, Duration::from_millis(7000));
        m.insert(PlatformRoute::KR, Duration::from_millis(7000));
        m.insert(PlatformRoute::OC1, Duration::from_millis(7000));
        m
    };
}

const RETRY_WAIT_SECS: u64 = 5;

#[instrument(skip_all, fields(duration = duration.as_millis()))]
async fn sleep_thread(duration: Duration) {
    info!("Sleeping...");
    sleep(duration).await;
}

#[allow(unreachable_code)]
#[instrument(name = "run")]
async fn run_region(region: PlatformRoute) {
    info!("Getting DB connection...");
    let db = db::get_db().await;

    loop {
        let t1 = Instant::now();

        info!("Starting transaction...");
        let txn = match db.begin().await {
            Ok(txn) => txn,
            Err(e) => {
                error!(?e, "Failed to start transaction");
                sleep_thread(Duration::from_secs(RETRY_WAIT_SECS)).await;
                continue;
            }
        };

        let t2 = Instant::now();
        let (api_players, (master_count, grandmaster_count, challenger_count)) =
            match apex_tier_players::get_players_from_api(region).await {
                Ok(r) => r,
                Err(error) => {
                    error!(?error, "Error getting players from the League API.");
                    sleep_thread(Duration::from_secs(RETRY_WAIT_SECS)).await;
                    continue;
                }
            };

        let db_players = match apex_tier_players::get_players_from_db(&txn, region).await {
            Ok(res) => res,
            Err(error) => {
                error!(?error, "Error getting players from DB.");
                sleep_thread(Duration::from_secs(RETRY_WAIT_SECS)).await;
                continue;
            }
        };

        let dodges = dodges::find_dodges(&db_players, &api_players).await;

        if !dodges.is_empty() {
            let summoner_ids: Vec<&str> = dodges
                .iter()
                .filter_map(|dodge| match &dodge.summoner_id {
                    Set(id) => Some(id.as_str()),
                    _ => None,
                })
                .collect();

            let riot_ids = match summoners::upsert_summoners(&summoner_ids, region, &txn).await {
                Ok(res) => res,
                Err(error) => {
                    error!(?error, "Error updating summoners table");
                    sleep_thread(Duration::from_secs(RETRY_WAIT_SECS)).await;
                    continue;
                }
            };

            let riot_id_models = match riot_ids::update_riot_ids(&riot_ids, &txn).await {
                Ok(res) => res,
                Err(error) => {
                    error!(?error, "Error updating riot_ids table");
                    sleep_thread(Duration::from_secs(RETRY_WAIT_SECS)).await;
                    continue;
                }
            };

            if region == PlatformRoute::EUW1 {
                if let Err(error) = lolpros::upsert_lolpros_slugs(&riot_id_models, &txn).await {
                    error!(?error, "Error upserting Lolpros slugs. Ignoring.");
                }
            }

            if let Err(error) = dodges::insert_dodges(&dodges, &txn).await {
                error!(?error, "Error inserting dodges");
                sleep_thread(Duration::from_secs(RETRY_WAIT_SECS)).await;
                continue;
            }
        }

        if let Err(error) = apex_tier_players::upsert_players(&api_players, region, &txn).await {
            error!(?error, "Error upserting players");
            sleep_thread(Duration::from_secs(RETRY_WAIT_SECS)).await;
            continue;
        }

        if let Err(error) =
            promotions_demotions::insert_promotions(&api_players, &db_players, region, &txn).await
        {
            error!(?error, "Error inserting promotions");
            sleep_thread(Duration::from_secs(RETRY_WAIT_SECS)).await;
            continue;
        }
        if let Err(error) =
            promotions_demotions::insert_demotions(&api_players, &db_players, region, &txn).await
        {
            error!(?error, "Error inserting demotions");
            sleep_thread(Duration::from_secs(RETRY_WAIT_SECS)).await;
            continue;
        }

        if let Err(error) = player_counts::update_player_counts(
            master_count,
            grandmaster_count,
            challenger_count,
            region,
            &txn,
        )
        .await
        {
            error!(?error, "Error updating player counts. Ignoring.");
        }

        info!("Committing transaction...");
        if let Err(error) = txn.commit().await {
            error!(?error, "Failed to commit transaction.");
            sleep_thread(Duration::from_secs(RETRY_WAIT_SECS)).await;
            continue;
        }
        info!(
            perf = t1.elapsed().as_millis(),
            metric = "region_update",
            "Region update complete.",
        );
        if let Err(error) = latest_updates::set_latest_update(region, db).await {
            error!(?error, "Error setting latest update time. Ignoring.");
        }

        if let Some(sleep_duration) = THROTTLES[&region].checked_sub(t2.elapsed()) {
            sleep_thread(sleep_duration).await;
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
    let (_guard, _json_guard) = logger::init();

    run().await.unwrap();
}
