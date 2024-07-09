use crate::entities::apex_tier_players;
use crate::entities::sea_orm_active_enums::RankTier;
use anyhow::Result;
use riven::consts::{PlatformRoute, QueueType};
use riven::models::league_v4::LeagueItem;
use riven::RiotApi;
use sea_orm::sea_query::OnConflict;
use sea_orm::{ActiveValue, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use std::collections::HashMap;
use tokio::try_join;

pub async fn get_players_from_db(
    db: &DatabaseConnection,
    region: PlatformRoute,
) -> Result<HashMap<String, apex_tier_players::Model>> {
    let time = std::time::Instant::now();

    let result: HashMap<String, apex_tier_players::Model> = apex_tier_players::Entity::find()
        .filter(apex_tier_players::Column::Region.eq(region.to_string()))
        .all(db)
        .await?
        .into_iter()
        .map(|model| (model.summoner_id.clone(), model))
        .collect();

    println!("DB query time taken: {:?}", time.elapsed());

    Ok(result)
}

pub async fn get_players_from_api(
    region: PlatformRoute,
    riot_api: &RiotApi,
) -> Result<HashMap<String, (LeagueItem, RankTier)>> {
    let time = std::time::Instant::now();

    let master = riot_api
        .league_v4()
        .get_master_league(region, QueueType::RANKED_SOLO_5x5);
    let grandmaster = riot_api
        .league_v4()
        .get_grandmaster_league(region, QueueType::RANKED_SOLO_5x5);
    let challenger = riot_api
        .league_v4()
        .get_challenger_league(region, QueueType::RANKED_SOLO_5x5);

    let (master_result, grandmaster_result, challenger_result) =
        try_join!(master, grandmaster, challenger)?;

    println!("API query time taken: {:?}", time.elapsed());

    let new_time = std::time::Instant::now();

    let result: HashMap<String, (LeagueItem, RankTier)> = master_result
        .entries
        .into_iter()
        .map(|entry| (entry.summoner_id.clone(), (entry, RankTier::Master)))
        .chain(
            grandmaster_result
                .entries
                .into_iter()
                .map(|entry| (entry.summoner_id.clone(), (entry, RankTier::Grandmaster))),
        )
        .chain(
            challenger_result
                .entries
                .into_iter()
                .map(|entry| (entry.summoner_id.clone(), (entry, RankTier::Challenger))),
        )
        .collect();

    println!("API result processing time taken: {:?}", new_time.elapsed());

    Ok(result)
}

pub async fn upsert_players(
    players: HashMap<String, (LeagueItem, RankTier)>,
    region: PlatformRoute,
    db: &DatabaseConnection,
) -> Result<()> {
    const CHUNK_SIZE: usize = 2000; // Define the chunk size

    let time = std::time::Instant::now();

    let player_models: Vec<apex_tier_players::ActiveModel> = players
        .values()
        .map(|(player, tier)| apex_tier_players::ActiveModel {
            summoner_id: ActiveValue::Set(player.summoner_id.clone()),
            region: ActiveValue::Set(region.to_string()),
            rank_tier: ActiveValue::Set(tier.to_owned()),
            wins: ActiveValue::Set(player.wins),
            losses: ActiveValue::Set(player.losses),
            current_lp: ActiveValue::Set(player.league_points),
            ..Default::default()
        })
        .collect();

    // Chunk the player models
    for chunk in player_models.chunks(CHUNK_SIZE) {
        apex_tier_players::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                OnConflict::columns([
                    apex_tier_players::Column::SummonerId,
                    apex_tier_players::Column::Region,
                ])
                .update_columns([
                    apex_tier_players::Column::RankTier,
                    apex_tier_players::Column::Wins,
                    apex_tier_players::Column::Losses,
                    apex_tier_players::Column::CurrentLp,
                ])
                .to_owned(),
            )
            .exec(db)
            .await?;
    }

    println!("Upsert time taken: {:?}", time.elapsed());

    Ok(())
}
