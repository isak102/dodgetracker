use std::collections::HashMap;

use anyhow::Result;
use log::info;
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

    info!("[{}]: Getting apex tier players from DB...", region);

    let result: HashMap<String, apex_tier_players::Model> = apex_tier_players::Entity::find()
        .filter(apex_tier_players::Column::Region.eq(region.to_string()))
        .all(txn)
        .await?
        .into_iter()
        .map(|model| (model.summoner_id.clone(), model))
        .collect();

    info!(
        "[{}]: Got {} players from DB in {:?}.",
        region,
        result.len(),
        time.elapsed()
    );

    Ok(result)
}

pub async fn get_players_from_api(
    region: PlatformRoute,
) -> Result<(
    HashMap<String, (LeagueItem, RankTier)>,
    (usize, usize, usize),
)> {
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

    info!("[{}]: Getting apex tier players from API...", region);

    let (master_result, grandmaster_result, challenger_result) =
        try_join!(master, grandmaster, challenger)?;

    info!(
        "[{}]: Apex tiers API query time: {:?}",
        region,
        time.elapsed()
    );

    let new_time = std::time::Instant::now();

    let (master_count, grandmaster_count, challenger_count) = (
        master_result.entries.len(),
        grandmaster_result.entries.len(),
        challenger_result.entries.len(),
    );

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

    info!(
        "[{}]: API result processing time taken: {:?}",
        region,
        new_time.elapsed()
    );

    Ok((result, (master_count, grandmaster_count, challenger_count)))
}

pub async fn upsert_players(
    players: &HashMap<String, (LeagueItem, RankTier)>,
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

    for chunk in player_models.chunks(INSERT_CHUNK_SIZE) {
        info!("[{}]: Upserting {} players into DB...", region, chunk.len());
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

    info!(
        "[{}]: Upserted {} players into DB in {:?}.",
        region,
        player_models.len(),
        time.elapsed(),
    );

    Ok(())
}