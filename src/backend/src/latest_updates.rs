use anyhow::Result;
use log::info;
use riven::consts::PlatformRoute;
use sea_orm::{
    sea_query::OnConflict, ActiveValue::Set, DatabaseConnection, DatabaseTransaction, EntityTrait,
};
use tracing::instrument;

use crate::entities::latest_updates;

#[instrument(skip_all)]
pub async fn set_latest_update(region: PlatformRoute, db: &DatabaseConnection) -> Result<()> {
    info!("Setting latest update time...");
    latest_updates::Entity::insert(latest_updates::ActiveModel {
        region: Set(region.to_string()),
        update_time: Set(chrono::Utc::now().into()),
    })
    .on_conflict(
        OnConflict::column(latest_updates::Column::Region)
            .update_column(latest_updates::Column::UpdateTime)
            .to_owned(),
    )
    .exec(db)
    .await?;

    Ok(())
}
