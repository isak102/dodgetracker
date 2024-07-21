import {
  bigint,
  bigserial,
  index,
  pgSchema,
  primaryKey,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const dodgetracker = pgSchema("dodgetracker");
export const rankTierEnum = dodgetracker.enum("rank_tier_enum", [
  "CHALLENGER",
  "GRANDMASTER",
  "MASTER",
]);

export const demotions = dodgetracker.table(
  "demotions",
  {
    demotionId: bigserial("demotion_id", { mode: "bigint" })
      .primaryKey()
      .notNull(),
    summonerId: varchar("summoner_id", { length: 255 }).notNull(),
    region: varchar("region", { length: 5 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    atWins: bigint("at_wins", { mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    atLosses: bigint("at_losses", { mode: "number" }).notNull(),
  },
  (table) => {
    return {
      idx18293SummonerIdRegion: index("idx_18293_summoner_id_region").using(
        "btree",
        table.summonerId,
        table.region,
      ),
    };
  },
);

export const promotions = dodgetracker.table(
  "promotions",
  {
    promotionId: bigserial("promotion_id", { mode: "bigint" })
      .primaryKey()
      .notNull(),
    summonerId: varchar("summoner_id", { length: 255 }).notNull(),
    region: varchar("region", { length: 5 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    atWins: bigint("at_wins", { mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    atLosses: bigint("at_losses", { mode: "number" }).notNull(),
  },
  (table) => {
    return {
      idx18311SummonerIdRegion: index("idx_18311_summoner_id_region").using(
        "btree",
        table.summonerId,
        table.region,
      ),
    };
  },
);

export const summoners = dodgetracker.table(
  "summoners",
  {
    summonerId: varchar("summoner_id", { length: 255 }),
    region: varchar("region", { length: 10 }).notNull(),
    accountId: varchar("account_id", { length: 255 }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    profileIconId: bigint("profile_icon_id", { mode: "number" }).notNull(),
    puuid: varchar("puuid", { length: 255 }).primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    summonerLevel: bigint("summoner_level", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idx18325Puuid: index("idx_18325_puuid").using("btree", table.puuid),
      idx18325PuuidSummonerIdRegion: index(
        "idx_18325_puuid_summoner_id_region",
      ).using("btree", table.puuid, table.summonerId, table.region),
      idx18325Region: index("idx_18325_region").using("btree", table.region),
      idx18325SummonerId: index("idx_18325_summoner_id").using(
        "btree",
        table.summonerId,
      ),
      idx18325SummonerIdRegion: uniqueIndex(
        "idx_18325_summoner_id_region",
      ).using("btree", table.summonerId, table.region),
    };
  },
);

export const riotIds = dodgetracker.table(
  "riot_ids",
  {
    puuid: varchar("puuid", { length: 255 }).primaryKey().notNull(),
    gameName: varchar("game_name", { length: 255 }).default("").notNull(),
    tagLine: varchar("tag_line", { length: 255 }).default("").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    lolprosSlug: varchar("lolpros_slug", { length: 255 }),
    lowerGameName: varchar("lower_game_name", { length: 255 }),
    lowerTagLine: varchar("lower_tag_line", { length: 255 }),
  },
  (table) => {
    return {
      idx18316PuuidGameNameTagLine: index(
        "idx_18316_puuid_game_name_tag_line",
      ).using("btree", table.puuid, table.gameName, table.tagLine),
      lowerGameNameTagLine: index("lower_game_name_tag_line").using(
        "btree",
        table.lowerGameName,
        table.lowerTagLine,
      ),
    };
  },
);

export const dodges = dodgetracker.table(
  "dodges",
  {
    dodgeId: bigserial("dodge_id", { mode: "bigint" }).primaryKey().notNull(),
    summonerId: varchar("summoner_id", { length: 255 }).notNull(),
    region: varchar("region", { length: 10 }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    lpBefore: bigint("lp_before", { mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    lpAfter: bigint("lp_after", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    atWins: bigint("at_wins", { mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    atLosses: bigint("at_losses", { mode: "number" }).notNull(),
    rankTier: rankTierEnum("rank_tier").notNull(),
  },
  (table) => {
    return {
      idx18299CreatedAt: index("idx_18299_created_at").using(
        "btree",
        table.createdAt,
      ),
      idx18299RegionCreatedAtDodgeId: index(
        "idx_18299_region_created_at_dodge_id",
      ).using("btree", table.region, table.createdAt, table.dodgeId),
      idx18299SummonerId: index("idx_18299_summoner_id").using(
        "btree",
        table.summonerId,
        table.region,
      ),
      idx18299SummonerIdRegionCreatedAt: index(
        "idx_18299_summoner_id_region_created_at",
      ).using("btree", table.summonerId, table.region, table.createdAt),
    };
  },
);

export const playerCounts = dodgetracker.table("player_counts", {
  id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
  region: varchar("region", { length: 10 }).notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  playerCount: bigint("player_count", { mode: "number" }).notNull(),
  atTime: timestamp("at_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  rankTier: rankTierEnum("rank_tier").notNull(),
});

export const apexTierPlayers = dodgetracker.table(
  "apex_tier_players",
  {
    summonerId: varchar("summoner_id", { length: 255 }).notNull(),
    summonerName: varchar("summoner_name", { length: 32 }),
    region: varchar("region", { length: 5 }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    currentLp: bigint("current_lp", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    wins: bigint("wins", { mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    losses: bigint("losses", { mode: "number" }).notNull(),
    rankTier: rankTierEnum("rank_tier").notNull(),
  },
  (table) => {
    return {
      idx18287Region: index("idx_18287_region").using("btree", table.region),
      idx18287SummonerId: index("idx_18287_summoner_id").using(
        "btree",
        table.summonerId,
      ),
      idx18287Primary: primaryKey({
        columns: [table.summonerId, table.region],
        name: "idx_18287_primary",
      }),
    };
  },
);

export const latestUpdates = dodgetracker.table("latest_updates", {
  region: varchar("region", { length: 5 }).primaryKey().notNull(),
  updateTime: timestamp("update_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});
