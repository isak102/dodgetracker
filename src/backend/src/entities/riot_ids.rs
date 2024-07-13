//! `SeaORM` Entity. Generated by sea-orm-codegen 0.12.15

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "riot_ids")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
    pub lolpros_slug: Option<String>,
    #[sea_orm(column_type = "VarBinary(255)", nullable)]
    pub lower_game_name: Option<Vec<u8>>,
    #[sea_orm(column_type = "VarBinary(255)", nullable)]
    pub lower_tag_line: Option<Vec<u8>>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
