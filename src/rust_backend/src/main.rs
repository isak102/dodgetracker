extern crate dotenv;
use anyhow::Result;
use futures::future::try_join_all;
use riven::consts::PlatformRoute;
use sea_orm::ActiveValue::Set;
use sea_orm::TransactionTrait;

mod apex_tier_players;
mod config;
mod db;
mod dodges;
mod entities;
mod lolpros;
mod riot_api;
mod riot_ids;
mod summoners;
mod promotions_demotions;

const SUPPORTED_REGIONS: [PlatformRoute; 5] = [
    PlatformRoute::EUW1,
    PlatformRoute::EUN1,
    PlatformRoute::NA1,
    PlatformRoute::KR,
    PlatformRoute::OC1,
];

async fn run_region(region: PlatformRoute) -> Result<()> {
    let db = db::get_db().await;
    let txn = db.begin().await?;

    let new_players = match apex_tier_players::get_players_from_api(region).await {
        Ok(players) => players,
        Err(_) => return Ok(()),
    };
    let old_players = apex_tier_players::get_players_from_db(&txn, region)
        .await
        .unwrap();

    let dodges = dodges::find_dodges(&old_players, &new_players).await;

    apex_tier_players::upsert_players(new_players, region, &txn).await?;

    if !dodges.is_empty() {
        dodges::insert_dodges(&dodges, &txn).await?;

        let summoner_ids: Vec<&str> = dodges
            .iter()
            .filter_map(|dodge| match &dodge.summoner_id {
                Set(id) => Some(id.as_str()),
                _ => None,
            })
            .collect();

        let riot_ids = summoners::update_summoners(&summoner_ids, region, &txn).await?;

        let riot_id_models = riot_ids::update_riot_ids(&riot_ids, &txn).await?;

        if region == PlatformRoute::EUW1 {
            lolpros::upsert_lolpros_slugs(&riot_id_models, &txn).await?;
        }
    }

    txn.commit().await?;

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
    let time = std::time::Instant::now();
    if let Err(e) = run().await {
        eprintln!("Application error: {:?}", e);
    }
    println!("Total time elapsed: {:?}", time.elapsed());
}
