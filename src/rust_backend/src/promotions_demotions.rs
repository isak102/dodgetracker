use std::collections::HashMap;

use anyhow::Result;
use log::info;
use riven::{consts::PlatformRoute, models::league_v4::LeagueItem};
use sea_orm::{
    prelude::{ChronoDateTimeUtc, DateTimeUtc},
    ActiveValue::Set,
    ColumnTrait, DatabaseTransaction, EntityTrait, QueryFilter,
};

use crate::{
    config::INSERT_CHUNK_SIZE,
    entities::{apex_tier_players, demotions, promotions, sea_orm_active_enums::RankTier},
};

fn has_promoted(
    summoner_id: &String,
    db_players: &HashMap<String, apex_tier_players::Model>,
    demotions: &HashMap<String, Vec<ChronoDateTimeUtc>>,
) -> bool {
    match db_players.get(summoner_id) {
        None => true,
        Some(db_player) => match demotions.get(summoner_id) {
            Some(demotions) => demotions
                .iter()
                .any(|demotion| demotion > &db_player.updated_at),
            None => false,
        },
    }
}

fn has_demoted(
    player: &apex_tier_players::Model,
    player_demotions: Option<&Vec<ChronoDateTimeUtc>>,
) -> bool {
    match player_demotions {
        None => true,
        Some(demotions) => !demotions
            .iter()
            .any(|demotion| demotion > &player.updated_at),
    }
}

// TODO: only execute this once and pass it down
async fn get_demotions(
    region: PlatformRoute,
    txn: &DatabaseTransaction,
) -> Result<HashMap<String, Vec<ChronoDateTimeUtc>>> {
    let time = std::time::Instant::now();

    let demotions: Vec<demotions::Model> = demotions::Entity::find()
        .filter(demotions::Column::Region.eq(region.to_string()))
        .all(txn)
        .await?;

    info!("[{}]: Getting demotions from DB...", region);

    let result = demotions.into_iter().fold(
        HashMap::new(),
        |mut acc: HashMap<String, Vec<DateTimeUtc>>, demotion| {
            acc.entry(demotion.summoner_id)
                .or_default()
                .push(demotion.created_at);
            acc
        },
    );

    info!(
        "[{}]: Got {} demotions from DB in {:?}.",
        region,
        result.len(),
        time.elapsed()
    );

    Ok(result)
}

pub async fn insert_promotions(
    api_players: &HashMap<String, (LeagueItem, RankTier)>,
    db_players: &HashMap<String, apex_tier_players::Model>,
    region: PlatformRoute,
    txn: &DatabaseTransaction,
) -> Result<()> {
    let demotions = get_demotions(region, txn).await?;

    let t1 = std::time::Instant::now();
    info!("[{}]: Finding promotions...", region);

    let promotions_models: Vec<promotions::ActiveModel> = api_players
        .iter()
        .filter_map(|(summoner_id, (stats, _))| {
            if has_promoted(summoner_id, db_players, &demotions) {
                Some(promotions::ActiveModel {
                    summoner_id: Set(summoner_id.clone()),
                    region: Set(region.to_string()),
                    at_wins: Set(stats.wins),
                    at_losses: Set(stats.losses),
                    ..Default::default()
                })
            } else {
                None
            }
        })
        .collect();

    info!(
        "[{}]: Found {} promotions in {:?}.",
        region,
        promotions_models.len(),
        t1.elapsed()
    );

    for chunk in promotions_models.chunks(INSERT_CHUNK_SIZE) {
        promotions::Entity::insert_many(chunk.to_vec())
            .exec(txn)
            .await?;
    }

    Ok(())
}

pub async fn insert_demotions(
    api_players: &HashMap<String, (LeagueItem, RankTier)>,
    db_players: &HashMap<String, apex_tier_players::Model>,
    region: PlatformRoute,
    txn: &DatabaseTransaction,
) -> Result<()> {
    let players_not_in_api: HashMap<String, apex_tier_players::Model> = db_players
        .iter()
        .filter(|(summoner_id, _)| !api_players.contains_key(*summoner_id))
        .map(|(summoner_id, player)| (summoner_id.clone(), player.clone()))
        .collect();

    let demotions = get_demotions(region, txn).await?;
    info!("[{}]: Finding new demotions...", region);

    let t1 = std::time::Instant::now();
    let demotion_models: Vec<demotions::ActiveModel> = players_not_in_api
        .iter()
        .filter_map(|(summoner_id, player)| {
            let player_demotions = demotions.get(summoner_id);

            if has_demoted(player, player_demotions) {
                Some(demotions::ActiveModel {
                    summoner_id: Set(summoner_id.clone()),
                    region: Set(region.to_string()),
                    at_wins: Set(player.wins),
                    at_losses: Set(player.losses),
                    ..Default::default()
                })
            } else {
                None
            }
        })
        .collect();

    info!(
        "[{}]: Found {} demotions in {:?}.",
        region,
        demotion_models.len(),
        t1.elapsed()
    );

    for chunk in demotion_models.chunks(INSERT_CHUNK_SIZE) {
        demotions::Entity::insert_many(chunk.to_vec())
            .exec(txn)
            .await?;
    }

    Ok(())
}
