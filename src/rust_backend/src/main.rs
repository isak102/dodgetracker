extern crate dotenv;
use anyhow::Result;
use dotenv::from_path;
use futures::future::try_join_all;
use riven::{consts::PlatformRoute, RiotApi};
use std::env;
use std::sync::Arc;

mod db;
mod dodges;
mod entities;
mod players;
mod riot_api;

const SUPPORTED_REGIONS: [PlatformRoute; 5] = [
    PlatformRoute::EUW1,
    PlatformRoute::EUN1,
    PlatformRoute::NA1,
    PlatformRoute::KR,
    PlatformRoute::OC1,
];

async fn run_region(region: PlatformRoute) -> Result<()> {
    let db = db::get_db().await;

    let new_players = players::get_players_from_api(region).await.unwrap();
    let old_players = players::get_players_from_db(db, region).await.unwrap();

    let dodges = dodges::find_dodges(&old_players, &new_players).await;

    players::upsert_players(new_players, region, db).await?;
    dodges::insert_dodges(dodges, db).await?;

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
