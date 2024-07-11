use std::{collections::HashMap, time::Instant};

use anyhow::Result;
use log::info;
use riven::{consts::PlatformRoute, models::league_v4::LeagueItem};
use sea_orm::{ActiveValue, DatabaseTransaction, EntityTrait};

use crate::entities::{apex_tier_players, dodges, sea_orm_active_enums::RankTier};

const DECAY_LP_LOSS: i32 = 75;

pub async fn find_dodges(
    db_players: &HashMap<String, apex_tier_players::Model>,
    api_players: &HashMap<String, (LeagueItem, RankTier)>,
    region: PlatformRoute,
) -> Vec<dodges::ActiveModel> {
    let start_time = Instant::now();

    info!("[{}]: Finding dodges...", region);

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

    info!(
        "[{}]: Found {} dodges in {:?}.",
        region,
        dodges.len(),
        start_time.elapsed()
    );

    dodges
}

pub async fn insert_dodges(
    dodges: &[dodges::ActiveModel],
    txn: &DatabaseTransaction,
    region: PlatformRoute,
) -> Result<()> {
    if dodges.is_empty() {
        return Ok(());
    }

    let t1 = Instant::now();
    info!("[{}]: Inserting dodges...", region);

    dodges::Entity::insert_many(dodges.to_owned())
        .exec(txn)
        .await?;

    info!(
        "[{}]: Inserted {} dodges in {:?}.",
        region,
        dodges.len(),
        t1.elapsed()
    );

    Ok(())
}
