import { ExtractTablesWithRelations, sql } from "drizzle-orm";
import { MySqlTransaction } from "drizzle-orm/mysql-core";
import {
  MySql2PreparedQueryHKT,
  MySql2QueryResultHKT,
} from "drizzle-orm/mysql2";
import { Constants } from "twisted";
import { Regions, regionToRegionGroup } from "twisted/dist/constants/regions";
import { LeagueItemDTO } from "twisted/dist/models-dto";
import {
  apexTierPlayers,
  demotions,
  playerCounts,
  promotions,
  riotIds,
  summoners,
} from "../db/schema";
import { lolApi, riotApi } from "./api";
import { Dodge } from "./dodges";
import logger from "./logger";
import { Tier } from "./types";

const supportedRegions = [
  Constants.Regions.EU_WEST,
  Constants.Regions.AMERICA_NORTH,
  Constants.Regions.EU_EAST,
  Constants.Regions.OCEANIA,
  Constants.Regions.KOREA,
];

interface LeagueItemDTOWithRegionAndTier extends LeagueItemDTO {
  region: Regions;
  rankTier: string;
}

export type SummonerIdAndRegionKey = string;

export type PlayersFromApiMap = Map<
  SummonerIdAndRegionKey,
  LeagueItemDTOWithRegionAndTier
>;

export type PlayersFromDbMap = Map<
  SummonerIdAndRegionKey,
  {
    lp: number;
    wins: number;
    losses: number;
    updatedAt: Date;
  }
>;

async function getPlayersForRegion(
  region: Regions,
  transaction: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
  >,
): Promise<LeagueItemDTOWithRegionAndTier[]> {
  const promises = [
    lolApi.League.getMasterLeagueByQueue(
      Constants.Queues.RANKED_SOLO_5x5,
      region,
    ),
    lolApi.League.getGrandMasterLeagueByQueue(
      Constants.Queues.RANKED_SOLO_5x5,
      region,
    ),
    lolApi.League.getChallengerLeaguesByQueue(
      Constants.Queues.RANKED_SOLO_5x5,
      region,
    ),
  ];

  const [master, grandmaster, challenger] = await Promise.all(promises);

  const mapEntriesWithRegion = (
    entries: LeagueItemDTO[],
    region: Regions,
    rankTier: string,
  ): LeagueItemDTOWithRegionAndTier[] =>
    entries.map((entry) => ({
      ...entry,
      region,
      rankTier,
    }));

  if (
    master.response?.entries &&
    grandmaster.response?.entries &&
    challenger.response?.entries
  ) {
    // Update the player count for the given region and rank tier
    await insertApexTierPlayerCount(
      region,
      master.response.entries.length,
      grandmaster.response.entries.length,
      challenger.response.entries.length,
      transaction,
    );
  }

  // Simplify the check for responses and entries
  const entries = [master, grandmaster, challenger].reduce((acc, league) => {
    if (league.response?.entries) {
      acc.push(
        ...mapEntriesWithRegion(
          league.response.entries,
          region,
          league.response.tier,
        ),
      );
    }
    return acc;
  }, [] as LeagueItemDTOWithRegionAndTier[]);

  return entries;
}

/**
 * Will update the player count for the given region and rank tier in the database.
 *
 * @param region - The region to insert the player count for
 * @param masterPlayerCount - Number of players in the MASTER tier
 * @param grandmasterPlayerCount - Number of players in the GRANDMASTER tier
 * @param challengerPlayerCount - Number of players in the CHALLENGER tier
 * @param transaction - The database transaction to execute the query in
 */
async function insertApexTierPlayerCount(
  region: Regions,
  masterPlayerCount: number,
  grandmasterPlayerCount: number,
  challengerPlayerCount: number,
  transaction: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
  >,
): Promise<void> {
  logger.info(
    `Inserting player counts for ${region} [M: ${masterPlayerCount}, GM: ${grandmasterPlayerCount}, C: ${challengerPlayerCount}]`,
  );
  await transaction.insert(playerCounts).values([
    {
      region,
      playerCount: masterPlayerCount,
      rankTier: "MASTER",
    },
    {
      region,
      playerCount: grandmasterPlayerCount,
      rankTier: "GRANDMASTER",
    },
    {
      region,
      playerCount: challengerPlayerCount,
      rankTier: "CHALLENGER",
    },
  ]);
}

export function constructSummonerAndRegionKey(
  summonerId: string,
  region: string,
): SummonerIdAndRegionKey {
  return `${summonerId}-${region.toUpperCase()}`;
}

export async function fetchCurrentPlayers(
  transaction: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
  >,
): Promise<PlayersFromDbMap> {
  const rows = await transaction.select().from(apexTierPlayers);

  let currentPlayersData = new Map<
    SummonerIdAndRegionKey,
    {
      lp: number;
      wins: number;
      losses: number;
      updatedAt: Date;
    }
  >();

  rows.forEach((row) => {
    const key = constructSummonerAndRegionKey(row.summonerId, row.region);
    currentPlayersData.set(key, {
      lp: row.currentLp!,
      wins: row.wins,
      losses: row.losses,
      updatedAt: row.updatedAt!,
    });
  });

  return currentPlayersData;
}

export async function getPlayers(
  transaction: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
  >,
): Promise<PlayersFromApiMap> {
  const promises = supportedRegions.map(
    async (region) => await getPlayersForRegion(region, transaction),
  );

  const players = await Promise.all(promises);

  const playersMap = new Map<
    SummonerIdAndRegionKey,
    LeagueItemDTOWithRegionAndTier
  >();

  players.forEach((regionPlayers) => {
    regionPlayers.forEach((player) => {
      playersMap.set(
        constructSummonerAndRegionKey(player.summonerId, player.region),
        player,
      );
    });
  });

  return playersMap;
}

async function getDemotions(
  transaction: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
  >,
): Promise<Map<SummonerIdAndRegionKey, [Date]>> {
  const rows = await transaction.select().from(demotions);

  const demotionsMap = new Map<string, [Date]>();
  rows.forEach((row) => {
    const key = constructSummonerAndRegionKey(row.summonerId, row.region);
    if (!demotionsMap.has(key)) {
      demotionsMap.set(key, [row.createdAt]);
    } else {
      demotionsMap.get(key)?.push(row.createdAt);
    }
  });

  return demotionsMap;
}

export async function registerPromotions(
  playersFromDb: PlayersFromDbMap,
  playersFromApi: PlayersFromApiMap,
  transaction: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
  >,
): Promise<void> {
  const demotionsMap = await getDemotions(transaction);

  const promotedPlayers: {
    summonerId: string;
    region: string;
    atWins: number;
    atLosses: number;
  }[] = [];

  for (const [key, playerFromApi] of Array.from(playersFromApi.entries())) {
    const playerFromDb = playersFromDb.get(key);

    if (!playerFromDb) {
      // If player exists in the API but not in the DB then it's a promotion
      promotedPlayers.push({
        summonerId: playerFromApi.summonerId,
        region: playerFromApi.region,
        atWins: playerFromApi.wins,
        atLosses: playerFromApi.losses,
      });
    } else {
      // If a player exists in the DB, check if it's a promotion.
      const demotions = demotionsMap.get(key);
      if (!demotions) continue;

      for (const demotion of demotions) {
        if (demotion.getTime() > playerFromDb.updatedAt.getTime()) {
          promotedPlayers.push({
            summonerId: playerFromApi.summonerId,
            region: playerFromApi.region,
            atWins: playerFromApi.wins,
            atLosses: playerFromApi.losses,
          });
        }
      }
    }
  }

  if (promotedPlayers.length === 0) {
    logger.info("No promotions to register, skipping...");
  } else {
    logger.info(
      `Registering ${promotedPlayers.length} new players in promotions table...`,
    );
    await transaction.insert(promotions).values(promotedPlayers);
  }
}

export async function registerDemotions(
  playersFromDb: PlayersFromDbMap,
  playersFromApi: PlayersFromApiMap,
  transaction: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
  >,
): Promise<void> {
  const playersNotInApi: Map<
    SummonerIdAndRegionKey,
    { updatedAt: Date; wins: number; losses: number }
  > = new Map();

  playersFromDb.forEach((playerFromDb, key) => {
    const playerFromApi = playersFromApi.get(key);
    if (!playerFromApi) {
      playersNotInApi.set(key, {
        updatedAt: playerFromDb.updatedAt,
        wins: playerFromDb.wins,
        losses: playerFromDb.losses,
      });
    }
  });

  const demotionsMap = await getDemotions(transaction);

  const demotedPlayers: {
    summonerId: string;
    region: string;
    atWins: number;
    atLosses: number;
  }[] = Array.from(playersNotInApi)
    .filter(([key, player]) => {
      const demotions = demotionsMap.get(key);
      if (!demotions) return true; // if there are no demotions, then the player is demoted

      for (const demotion of demotions) {
        if (demotion.getTime() > player.updatedAt.getTime()) {
          // if there exists a demotion with a date after the last update, then a new demotion is not needed
          return false;
        }
      }
      // if there are no demotions with a date after the last update, then the player is demoted
      return true;
    })
    .map(([key, player]) => {
      const lastDashIndex = key.lastIndexOf("-");
      const summonerId = key.slice(0, lastDashIndex);
      const region = key.slice(lastDashIndex + 1);
      return {
        summonerId,
        region,
        atWins: player.wins,
        atLosses: player.losses,
      };
    });

  if (demotedPlayers.length === 0) {
    logger.info("No demotions to register, skipping...");
  } else {
    logger.info(
      `Registering ${demotedPlayers.length} players in demotions table...`,
    );
    await transaction.insert(demotions).values(demotedPlayers);
  }
}

export async function upsertPlayers(
  players: PlayersFromApiMap,
  transaction: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
  >,
): Promise<void> {
  const playersToUpsert = Array.from(players.values()).map((player) => {
    return {
      summonerId: player.summonerId,
      summonerName: player.summonerName,
      region: player.region,
      rankTier: player.rankTier as Tier,
      currentLp: player.leaguePoints,
      wins: player.wins,
      losses: player.losses,
    };
  });

  if (playersToUpsert.length > 0) {
    const chunkSize = 20000;
    for (let i = 0; i < playersToUpsert.length; i += chunkSize) {
      logger.info(`Upserting chunk ${i}...`);
      const chunk = playersToUpsert.slice(i, i + chunkSize);
      await transaction
        .insert(apexTierPlayers)
        .values(chunk)
        .onDuplicateKeyUpdate({
          set: {
            summonerName: sql`VALUES(${apexTierPlayers.summonerName})`,
            rankTier: sql`VALUES(${apexTierPlayers.rankTier})`,
            currentLp: sql`VALUES(${apexTierPlayers.currentLp})`,
            wins: sql`VALUES(${apexTierPlayers.wins})`,
            losses: sql`VALUES(${apexTierPlayers.losses})`,
            updatedAt: sql`NOW()`,
          },
        });
    }
  } else {
    logger.info("No new players to upsert, skipping...");
  }
}

/* TODO: update account information if it is older than X days */
export async function updateAccountsData(
  dodges: Dodge[],
  transaction: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
  >,
): Promise<void> {
  let summonersToFetch = new Map<string, string>();
  let promises = dodges.map((dodge) => {
    summonersToFetch.set(dodge.summonerId, dodge.region);
    return lolApi.Summoner.getById(dodge.summonerId, dodge.region);
  });

  logger.info(
    `Fetching summoner data for ${summonersToFetch.size} summoners...`,
  );
  const summonerResults = await Promise.all(promises);

  let puuidsAndRegion: string[][] = [];
  let summonersToInsert: {
    puuid: string;
    summonerId: string;
    region: string;
    accountId: string;
    profileIconId: number;
    summonerLevel: number;
  }[] = summonerResults.map((result) => {
    if (result && result.response) {
      let summonerData = result.response;

      let region = summonersToFetch.get(summonerData.id)?.toUpperCase();
      if (!region) {
        throw new Error(
          `Region not found for summoner ${summonerData.id} (should never happen)`,
        );
      }

      puuidsAndRegion.push([summonerData.puuid, region]);
      return {
        puuid: summonerData.puuid,
        summonerId: summonerData.id,
        region: region,
        accountId: summonerData.accountId,
        profileIconId: summonerData.profileIconId,
        summonerLevel: summonerData.summonerLevel,
      };
    } else {
      throw new Error("Summoner not found");
    }
  });

  if (summonersToInsert.length > 0) {
    await transaction
      .insert(summoners)
      .values(summonersToInsert)
      .onDuplicateKeyUpdate({
        set: {
          summonerId: sql`VALUES(${summoners.summonerId})`,
          region: sql`VALUES(${summoners.region})`,
          accountId: sql`VALUES(${summoners.accountId})`,
          profileIconId: sql`VALUES(${summoners.profileIconId})`,
          summonerLevel: sql`VALUES(${summoners.summonerLevel})`,
          updatedAt: sql`NOW()`,
        },
      });
  } else {
    logger.info("No new summoners to insert into summoners table, skipping...");
  }

  let accountInfoPromises = puuidsAndRegion.map((puuid) => {
    if (!puuid) throw new Error("Puuid not found");
    return riotApi.Account.getByPUUID(
      puuid[0],
      regionToRegionGroup(Regions.EU_WEST), // nearest region
    )
      .then((response) => {
        return response;
      })
      .catch((error) => {
        logger.error(`Error fetching account data for ${puuid[0]}: ${error}`);
        return null;
      });
  });

  logger.info(
    `Fetching account data for ${puuidsAndRegion.length} accounts...`,
  );
  let accountResults = await Promise.all(accountInfoPromises);

  let accountsToUpsert: { puuid: string; gameName: string; tagLine: string }[] =
    accountResults
      .filter((result) => result !== null && result.response !== null)
      .map((result) => {
        let accountData = result!.response;
        return {
          puuid: accountData.puuid,
          gameName: accountData.gameName,
          tagLine: accountData.tagLine,
        };
      });

  let euwAccounts: { puuid: string; gameName: string; tagLine: string }[] = [];
  accountsToUpsert.forEach((account, index) => {
    if (puuidsAndRegion[index][1] === Regions.EU_WEST) {
      euwAccounts.push(account);
    }
  });

  accountsToUpsert = accountsToUpsert.filter((account) => account !== null);

  if (accountsToUpsert.length > 0) {
    await transaction
      .insert(riotIds)
      .values(accountsToUpsert)
      .onDuplicateKeyUpdate({
        set: {
          gameName: sql`VALUES(${riotIds.gameName})`,
          tagLine: sql`VALUES(${riotIds.tagLine})`,
          updatedAt: sql`NOW()`,
        },
      });
  } else {
    logger.info("No new accounts to upsert into riot_ids table, skipping...");
  }

  // TODO: break this into a separate function
  const lolprosPromises = euwAccounts.map((account) =>
    getLolprosSlug(account.gameName, account.tagLine),
  );
  const lolProsSlugs: (string | null)[] = await Promise.all(lolprosPromises);

  const slugsToUpsert: { puuid: string; lolprosSlug: string }[] = [];
  lolProsSlugs.forEach((slug, index) => {
    if (slug) {
      slugsToUpsert.push({
        puuid: euwAccounts[index].puuid,
        lolprosSlug: slug,
      });
    }
  });

  if (slugsToUpsert.length > 0) {
    logger.info(
      `There are ${slugsToUpsert.length} LolPros.gg slugs to upsert into riot_ids table:`,
      slugsToUpsert.map((slug) => slug.lolprosSlug).join(", "),
    );
    await transaction
      .insert(riotIds)
      .values(slugsToUpsert)
      .onDuplicateKeyUpdate({
        set: {
          lolprosSlug: sql`VALUES(${riotIds.lolprosSlug})`,
          updatedAt: sql`NOW()`,
        },
      });
    logger.info(
      `${slugsToUpsert.length} LolPros.gg slugs upserted into riot_ids table.`,
    );
  } else {
    logger.info(
      "No LolPros.gg slugs to upsert into riot_ids table, skipping...",
    );
  }

  logger.info("All summoner and account data updated.");
}

async function getLolprosSlug(
  gameName: string,
  tagLine: string,
): Promise<string | null> {
  const url = `https://api.lolpros.gg/es/search?query=${encodeURIComponent(`${gameName}#${tagLine}`)}`;
  logger.info(`Lolpros.gg API request: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("LolPros API request failed!");
  }

  const data = await response.json();
  if (data.length === 0) {
    return null;
  }

  const slug = data[0].slug;
  if (!slug) {
    return null;
  }

  return slug;
}