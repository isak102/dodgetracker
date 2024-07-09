extern crate dotenv;
use anyhow::Result;
use dotenv::from_path;
use riven::{consts::PlatformRoute, RiotApi};
use sea_orm::*;
use std::env;

mod dodges;
mod entities;
mod players;

async fn run() -> Result<()> {
    from_path("../../.env").ok();

    let db_url = env::var("BACKEND_DATABASE_URL").expect("DB URL not set");
    let time = std::time::Instant::now();
    let db = Database::connect(db_url).await?;
    println!("Database connection time taken: {:?}", time.elapsed());
    let riot_api = RiotApi::new(env::var("RIOT_API_KEY").expect("RIOT API KEY not set"));

    let region = PlatformRoute::EUW1;

    let new_players = players::get_players_from_api(region, &riot_api)
        .await
        .unwrap();
    let old_players = players::get_players_from_db(&db, region).await.unwrap();

    let dodges = dodges::find_dodges(&old_players, &new_players).await;

    players::upsert_players(new_players, region, &db).await?;
    dodges::insert_dodges(dodges, &db).await?;

    println!("Total time taken: {:?}", time.elapsed());

    Ok(())
}

#[tokio::main]
async fn main() {
    run().await.unwrap();
}
