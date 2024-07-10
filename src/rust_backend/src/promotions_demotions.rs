use std::collections::HashMap;

use anyhow::Result;
use riven::{consts::PlatformRoute, models::league_v4::LeagueItem};
use sea_orm::{
    prelude::ChronoDateTimeUtc, ActiveValue::Set, ColumnTrait, DatabaseTransaction, EntityTrait,
    QueryFilter,
};

use crate::{
    config::INSERT_CHUNK_SIZE,
    entities::{apex_tier_players, demotions, promotions, sea_orm_active_enums::RankTier},
};

async fn get_demotions(
    region: PlatformRoute,
    txn: &DatabaseTransaction,
) -> Result<HashMap<String, Vec<ChronoDateTimeUtc>>> {
    let time = std::time::Instant::now();

    let demotions: Vec<demotions::Model> = demotions::Entity::find()
        .filter(demotions::Column::Region.eq(region.to_string()))
        .all(txn)
        .await?;

    let result = demotions
        .into_iter()
        .fold(HashMap::new(), |mut acc, demotion| {
            acc.entry(demotion.summoner_id)
                .or_insert_with(Vec::new)
                .push(demotion.created_at);
            acc
        });

    println!(
        "Demotions query for region {} time taken: {:?}",
        region,
        time.elapsed()
    );

    Ok(result)
}

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

pub async fn register_promotions(
    api_players: &HashMap<String, (LeagueItem, RankTier)>,
    db_players: &HashMap<String, apex_tier_players::Model>,
    region: PlatformRoute,
    txn: &DatabaseTransaction,
) -> Result<()> {
    let demotions = get_demotions(region, txn).await?;

    let t1 = std::time::Instant::now();
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

    println!(
        "Finding promotions for region {} time taken: {:?}",
        region,
        t1.elapsed()
    );

    for chunk in promotions_models.chunks(INSERT_CHUNK_SIZE) {
        promotions::Entity::insert_many(chunk.to_vec())
            .exec(txn)
            .await?;
    }

    Ok(())
}
