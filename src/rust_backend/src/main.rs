extern crate dotenv;

use dotenv::from_path;
use riven::{consts::PlatformRoute, RiotApi};
use sea_orm::*;
use std::env;

mod entities;
mod players;

use entities::*;

async fn run() -> Result<(), DbErr> {
    from_path("../../.env").ok();

    let db_url = env::var("BACKEND_DATABASE_URL").expect("DB URL not set");
    let db = Database::connect(db_url).await?;

    let riot_api = RiotApi::new(env::var("RIOT_API_KEY").expect("RIOT API KEY not set"));

    players::get_players_from_api(PlatformRoute::EUW1, &riot_api)
        .await
        .unwrap();

    Ok(())
}

#[tokio::main]
async fn main() {
    run().await.unwrap();
    println!("Hello, world!");
}
