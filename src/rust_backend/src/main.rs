extern crate dotenv;
use std::collections::HashMap;

use anyhow::Result;
use futures::future::try_join_all;
use lazy_static::lazy_static;
use log::info;
use riven::consts::PlatformRoute;
use sea_orm::ActiveValue::Set;
use sea_orm::TransactionTrait;

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
        m.insert(PlatformRoute::EUW1, 5);
        m.insert(PlatformRoute::EUN1, 5);
        m.insert(PlatformRoute::NA1, 10);
        m.insert(PlatformRoute::KR, 10);
        m.insert(PlatformRoute::OC1, 10);
        m
    };
}

async fn run_region(region: PlatformRoute) -> Result<()> {
    info!("[{}]: Getting DB connection...", region);
    let db = db::get_db().await;

    loop {
        let t1 = std::time::Instant::now();
        info!("[{}]: Starting transaction...", region);
        let txn = db.begin().await?;

        let (api_players, (master_count, grandmaster_count, challenger_count)) =
            match apex_tier_players::get_players_from_api(region).await {
                Ok(r) => r,
                Err(_) => {
                    // TODO: Wait for a bit here, then continue the loop
                    break;
                }
            };

        let db_players = apex_tier_players::get_players_from_db(&txn, region)
            .await
            .unwrap();

        let dodges = dodges::find_dodges(&db_players, &api_players, region).await;

        if !dodges.is_empty() {
            let summoner_ids: Vec<&str> = dodges
                .iter()
                .filter_map(|dodge| match &dodge.summoner_id {
                    Set(id) => Some(id.as_str()),
                    _ => None,
                })
                .collect();

            let riot_ids = summoners::update_summoners(&summoner_ids, region, &txn).await?;

            let riot_id_models = riot_ids::update_riot_ids(&riot_ids, region, &txn).await?;

            if region == PlatformRoute::EUW1 {
                lolpros::upsert_lolpros_slugs(&riot_id_models, &txn).await?;
            }

            dodges::insert_dodges(&dodges, &txn, region).await?;
        }

        apex_tier_players::upsert_players(&api_players, region, &txn).await?;

        promotions_demotions::insert_promotions(&api_players, &db_players, region, &txn).await?;
        promotions_demotions::insert_demotions(&api_players, &db_players, region, &txn).await?;

        player_counts::update_player_counts(
            master_count,
            grandmaster_count,
            challenger_count,
            region,
            &txn,
        )
        .await?;

        info!("[{}]: Committing transaction...", region);
        txn.commit().await?;
        info!(
            "[{}]: PERFORMANCE: Region update took {:?}.",
            region,
            t1.elapsed()
        );

        info!(
            "[{}]: Sleeping for {} seconds...",
            region, THROTTLES[&region]
        );
        tokio::time::sleep(tokio::time::Duration::from_secs(THROTTLES[&region] as u64)).await;
    }

    Ok(())
}

async fn run() -> Result<()> {
    let mut tasks = vec![];

    for &region in SUPPORTED_REGIONS.iter() {
        tasks.push(tokio::spawn(async move { run_region(region).await }));
    }

    // Wait for all tasks to complete and collect the results
    let results = try_join_all(tasks).await?;

    // Handle any errors from the tasks
    for result in results {
        if let Err(e) = result {
            eprintln!("Error running region task: {:?}", e);
        }
    }

    Ok(())
}

#[tokio::main]
async fn main() {
    let _logger = logger::init();
    run().await.unwrap();
}
