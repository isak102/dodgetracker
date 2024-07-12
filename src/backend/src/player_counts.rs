use anyhow::Result;
use riven::consts::PlatformRoute;
use sea_orm::{
    prelude::ChronoDateTimeUtc, ActiveValue::Set, ColumnTrait, DatabaseTransaction, EntityTrait,
    QueryFilter, QueryOrder,
};
use tracing::info;
use tracing::instrument;

use crate::entities::{
    player_counts,
    sea_orm_active_enums::RankTier::{Challenger, Grandmaster, Master},
};

async fn get_latest_update_time(
    region: PlatformRoute,
    txn: &DatabaseTransaction,
) -> Result<Option<ChronoDateTimeUtc>> {
    Ok(player_counts::Entity::find()
        .filter(player_counts::Column::Region.eq(region.to_string()))
        .order_by(player_counts::Column::Id, sea_orm::Order::Desc)
        .one(txn)
        .await?
        .map(|model| model.at_time))
}

#[instrument(skip_all, fields(m = master_count, gm = grandmaster_count, c = challenger_count))]
pub async fn update_player_counts(
    master_count: usize,
    grandmaster_count: usize,
    challenger_count: usize,
    region: PlatformRoute,
    txn: &DatabaseTransaction,
) -> Result<()> {
    let latest_update_time = get_latest_update_time(region, txn).await?;

    if let Some(latest_update_time) = latest_update_time {
        let time_diff = chrono::Utc::now() - latest_update_time;
        if time_diff < chrono::Duration::hours(1) {
            info!(
                last_update_diff = time_diff.num_minutes(),
                "Skipping player counts update."
            );
            return Ok(());
        }
    }

    let counts = [
        player_counts::ActiveModel {
            region: Set(region.to_string()),
            rank_tier: Set(Master),
            player_count: Set(master_count as i32),
            ..Default::default()
        },
        player_counts::ActiveModel {
            region: Set(region.to_string()),
            rank_tier: Set(Grandmaster),
            player_count: Set(grandmaster_count as i32),
            ..Default::default()
        },
        player_counts::ActiveModel {
            region: Set(region.to_string()),
            rank_tier: Set(Challenger),
            player_count: Set(challenger_count as i32),
            ..Default::default()
        },
    ];

    info!("Updating player counts");

    player_counts::Entity::insert_many(counts.to_vec())
        .exec(txn)
        .await?;

    Ok(())
}
