use std::collections::HashMap;

use anyhow::Result;
use riven::consts::{PlatformRoute, QueueType};
use riven::models::league_v4::LeagueItem;
use sea_orm::sea_query::OnConflict;
use sea_orm::{ActiveValue, ColumnTrait, DatabaseTransaction, EntityTrait, QueryFilter};
use tokio::try_join;

use crate::config::INSERT_CHUNK_SIZE;
use crate::entities::apex_tier_players;
use crate::entities::sea_orm_active_enums::RankTier;
use crate::riot_api::RIOT_API;

pub async fn get_players_from_db(
    txn: &DatabaseTransaction,
    region: PlatformRoute,
) -> Result<HashMap<String, apex_tier_players::Model>> {
    let time = std::time::Instant::now();

    let result: HashMap<String, apex_tier_players::Model> = apex_tier_players::Entity::find()
        .filter(apex_tier_players::Column::Region.eq(region.to_string()))
        .all(txn)
        .await?
        .into_iter()
        .map(|model| (model.summoner_id.clone(), model))
        .collect();

    println!("Apex tier DB query time taken: {:?}", time.elapsed());

    Ok(result)
}

pub async fn get_players_from_api(
    region: PlatformRoute,
) -> Result<HashMap<String, (LeagueItem, RankTier)>> {
    let time = std::time::Instant::now();

    let master = RIOT_API
        .league_v4()
        .get_master_league(region, QueueType::RANKED_SOLO_5x5);
    let grandmaster = RIOT_API
        .league_v4()
        .get_grandmaster_league(region, QueueType::RANKED_SOLO_5x5);
    let challenger = RIOT_API
        .league_v4()
        .get_challenger_league(region, QueueType::RANKED_SOLO_5x5);

    println!("Apex tiers API queries started for region: {}", region);
    let (master_result, grandmaster_result, challenger_result) =
        try_join!(master, grandmaster, challenger)?;
    println!(
        "Apex tiers API query time taken for {}: {:?}",
        region,
        time.elapsed()
    );

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
    txn: &DatabaseTransaction,
) -> Result<()> {
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
    for chunk in player_models.chunks(INSERT_CHUNK_SIZE) {
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
                    apex_tier_players::Column::UpdatedAt,
                ])
                .to_owned(),
            )
            .exec(txn)
            .await?;
    }

    println!("Upsert time taken: {:?}", time.elapsed());

    Ok(())
}
