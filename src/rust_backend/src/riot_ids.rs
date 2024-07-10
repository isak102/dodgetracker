use anyhow::Result;
use sea_orm::sea_query::OnConflict;
use sea_orm::DatabaseTransaction;
use sea_orm::{ActiveValue::Set, EntityTrait};
use tokio::task;

use crate::config::INSERT_CHUNK_SIZE;
use crate::{entities::riot_ids, riot_api::RIOT_API};

pub async fn update_riot_ids(
    puuids: &[String],
    txn: &DatabaseTransaction,
) -> Result<Vec<riot_ids::ActiveModel>> {
    let t1 = std::time::Instant::now();

    println!("Starting accounts query for {} riot ids", puuids.len());
    let futures = puuids.iter().map(|puuid| {
        task::spawn(
            RIOT_API
                .account_v1()
                .get_by_puuid(riven::consts::RegionalRoute::EUROPE, puuid),
        )
    });

    let results: Vec<_> = futures::future::join_all(futures).await;
    println!("Accounts API query time taken: {:?}", t1.elapsed());

    let riot_id_models: Vec<riot_ids::ActiveModel> = results
        .iter()
        .filter_map(|r| match r.as_ref().expect("Join failed") {
            Ok(a) => {
                if let (Some(game_name), Some(tag_line)) =
                    (a.game_name.as_ref(), a.tag_line.as_ref())
                {
                    Some(riot_ids::ActiveModel {
                        puuid: Set(a.puuid.clone()),
                        game_name: Set(game_name.clone()),
                        tag_line: Set(tag_line.clone()),
                        ..Default::default()
                    })
                } else {
                    println!("Missing game_name or tag_line for puuid: {}", a.puuid);
                    None
                }
            }
            Err(e) => {
                dbg!(e);
                None
            }
        })
        .collect();

    let t2 = std::time::Instant::now();
    println!("Inserting {} riot ids into DB", riot_id_models.len());

    for chunk in riot_id_models.chunks(INSERT_CHUNK_SIZE) {
        riot_ids::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                OnConflict::column(riot_ids::Column::Puuid)
                    .update_columns([
                        riot_ids::Column::GameName,
                        riot_ids::Column::TagLine,
                        riot_ids::Column::UpdatedAt,
                    ])
                    .to_owned(),
            )
            .exec(txn)
            .await?;
    }

    println!("Riot_ids insertion time taken: {:?}", t2.elapsed());

    Ok(riot_id_models)
}
