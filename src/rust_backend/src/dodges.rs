use std::{collections::HashMap, time::Instant};

use anyhow::Result;
use riven::models::league_v4::LeagueItem;
use sea_orm::{ActiveValue, DatabaseConnection, DatabaseTransaction, EntityTrait};

use crate::entities::{apex_tier_players, dodges, sea_orm_active_enums::RankTier};

const DECAY_LP_LOSS: i32 = 75;

pub async fn find_dodges(
    db_players: &HashMap<String, apex_tier_players::Model>,
    api_players: &HashMap<String, (LeagueItem, RankTier)>,
) -> Vec<dodges::ActiveModel> {
    let start_time = Instant::now();

    let dodges: Vec<dodges::ActiveModel> = api_players
        .values()
        .filter_map(|(new_data, _)| {
            db_players.get(&new_data.summoner_id).and_then(|old_data| {
                let old_games_played = old_data.wins + old_data.losses;
                let new_games_played = new_data.wins + new_data.losses;

                if new_data.league_points < old_data.current_lp
                    && new_games_played == old_games_played
                    && old_data.current_lp - new_data.league_points != DECAY_LP_LOSS
                {
                    Some(dodges::ActiveModel {
                        summoner_id: ActiveValue::Set(old_data.summoner_id.clone()),
                        region: ActiveValue::Set(old_data.region.clone()),
                        lp_before: ActiveValue::Set(old_data.current_lp),
                        lp_after: ActiveValue::Set(new_data.league_points),
                        rank_tier: ActiveValue::Set(old_data.rank_tier.clone()),
                        at_wins: ActiveValue::Set(old_data.wins),
                        at_losses: ActiveValue::Set(old_data.losses),
                        ..Default::default()
                    })
                } else {
                    None
                }
            })
        })
        .collect();

    println!("Dodges detection time taken: {:?}", start_time.elapsed());
    println!("Found {} dodges", dodges.len());

    dodges
}

pub async fn insert_dodges(
    dodges: &Vec<dodges::ActiveModel>,
    txn: &DatabaseTransaction,
) -> Result<()> {
    if dodges.is_empty() {
        return Ok(());
    }

    let start_time = Instant::now();
    dodges::Entity::insert_many(dodges.clone())
        .exec(txn)
        .await?;
    println!("Dodges Insert time taken: {:?}", start_time.elapsed());

    Ok(())
}
