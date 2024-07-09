use std::collections::HashMap;
use std::time::Instant;

use crate::apex_tier_players;
use riven::models::league_v4::LeagueItem;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};

use anyhow::Result;
use riven::consts::PlatformRoute;
use riven::RiotApi;
use tokio::try_join;

pub async fn get_players_from_db(
    db: &DatabaseConnection,
    region: &str,
) -> Result<Vec<apex_tier_players::Model>> {
    let all_players = apex_tier_players::Entity::find()
        .filter(apex_tier_players::Column::Region.eq(region))
        .all(db)
        .await?;
    Ok(all_players)
}

pub async fn get_players_from_api(
    region: PlatformRoute,
    riot_api: &RiotApi,
) -> Result<HashMap<String, LeagueItem>> {
    let master = riot_api
        .league_v4()
        .get_master_league(region, riven::consts::QueueType::RANKED_SOLO_5x5);
    let grandmaster = riot_api
        .league_v4()
        .get_grandmaster_league(region, riven::consts::QueueType::RANKED_SOLO_5x5);
    let challenger = riot_api
        .league_v4()
        .get_challenger_league(region, riven::consts::QueueType::RANKED_SOLO_5x5);

    let (master_result, grandmaster_result, challenger_result) =
        try_join!(master, grandmaster, challenger)?;

    let start_time = Instant::now();

    let result: HashMap<String, LeagueItem> = master_result
        .entries
        .into_iter()
        .chain(grandmaster_result.entries)
        .chain(challenger_result.entries)
        .map(|entry| (entry.summoner_id.clone(), entry))
        .collect();

    println!("Time taken: {:?}", start_time.elapsed());

    Ok(result)
}
