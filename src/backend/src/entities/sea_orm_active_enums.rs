//! `SeaORM` Entity. Generated by sea-orm-codegen 0.12.15

use sea_orm::entity::prelude::*;

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "position_enum")]
pub enum PositionEnum {
    #[sea_orm(string_value = "BOT")]
    Bot,
    #[sea_orm(string_value = "JUNGLE")]
    Jungle,
    #[sea_orm(string_value = "MID")]
    Mid,
    #[sea_orm(string_value = "SUPPORT")]
    Support,
    #[sea_orm(string_value = "TOP")]
    Top,
}
#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "rank_tier_enum")]
pub enum RankTierEnum {
    #[sea_orm(string_value = "CHALLENGER")]
    Challenger,
    #[sea_orm(string_value = "GRANDMASTER")]
    Grandmaster,
    #[sea_orm(string_value = "MASTER")]
    Master,
}
