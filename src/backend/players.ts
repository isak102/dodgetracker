import { count, sql } from "drizzle-orm";
import { Constants } from "twisted";
import { Regions, regionToRegionGroup } from "twisted/dist/constants/regions";
import { type LeagueItemDTO } from "twisted/dist/models-dto";
import { z } from "zod";
import {
  apexTierPlayers,
  demotions,
  playerCounts,
  promotions,
  riotIds,
  summoners,
} from "../db/schema";
import { lolApi, riotApi } from "./api";
import { type Dodge } from "./dodges";
import logger from "./logger";
import { type Tier, type Transaction } from "./types";
import { promiseWithTimeout } from "./util";

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
    region: string;
  }
>;

async function getPlayersForRegion(
  region: Regions,
  transaction: Transaction,
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
  transaction: Transaction,
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

/**
 * Fetches all apex tier players currently in the database.
 *
 * @param transaction - The transaction to execute the query in
 * @returns All apex tier players currently in the database
 */
export async function fetchCurrentPlayers(
  transaction: Transaction,
): Promise<PlayersFromDbMap> {
  const rows = await transaction.select().from(apexTierPlayers);

  const currentPlayersData = new Map<
    SummonerIdAndRegionKey,
    {
      lp: number;
      wins: number;
      losses: number;
      updatedAt: Date;
      region: string;
    }
  >();

  rows.forEach((row) => {
    const key = constructSummonerAndRegionKey(row.summonerId, row.region);
    currentPlayersData.set(key, {
      lp: row.currentLp,
      wins: row.wins,
      losses: row.losses,
      updatedAt: row.updatedAt,
      region: row.region,
    });
  });

  return currentPlayersData;
}

export class RegionError extends Error {
  region: string;

  constructor(message: string, region: string) {
    super(message);
    this.region = region;
  }
}

/**
 * Fetches all apex tier players from the league of legends API for all supported regions.
 *
 * @param transaction - The database transaction
 * @returns A map of apex tier  players from the league of legends API and a list of regions that errored
 */
export async function getPlayers(transaction: Transaction): Promise<{
  playersFromApiMap: PlayersFromApiMap;
  erroredRegions: string[];
}> {
  const promises = supportedRegions.map(
    (region) =>
      promiseWithTimeout(getPlayersForRegion(region, transaction), 10 * 1000)
        .then((data) => ({ status: "success", data }) as const) // Using 'as const' for literal type inference
        .catch((error) => ({ status: "error", region, error }) as const), // eslint-disable-line
  );
  const players = await Promise.all(promises);

  const playersMap = new Map<
    SummonerIdAndRegionKey,
    LeagueItemDTOWithRegionAndTier
  >();

  const erroredRegions: string[] = [];

  players.forEach((result) => {
    if (result.status === "error") {
      const erroredRegion = result.region;
      logger.error(
        `Region ${erroredRegion} errored: ${result.error}, skipping...`,
      );
      erroredRegions.push(erroredRegion);
    } else if (result.status === "success") {
      result.data.forEach((player) => {
        playersMap.set(
          constructSummonerAndRegionKey(player.summonerId, player.region),
          player,
        );
      });
    }
  });

  return { playersFromApiMap: playersMap, erroredRegions };
}

async function getDemotions(
  transaction: Transaction,
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

/**
 * Inserts promotions for players that have promoted into master.
 *
 * @param playersFromDb - Player data currently in the database
 * @param playersFromApi - Player data fetched from the league API
 * @param transaction - Transaction to execute the query in
 */
export async function registerPromotions(
  playersFromDb: PlayersFromDbMap,
  playersFromApi: PlayersFromApiMap,
  transaction: Transaction,
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

/**
 * Inserts demotions for players that have demoted from master.
 *
 * @param playersFromDb - Player data currently in the database
 * @param playersFromApi - Player data fetched from the league API
 * @param regionsToSkip - Regions to skip demotions for (for example due to an error in API response)
 * @param transaction - Transaction to execute the query in
 */
export async function registerDemotions(
  playersFromDb: PlayersFromDbMap,
  playersFromApi: PlayersFromApiMap,
  regionsToSkip: string[],
  transaction: Transaction,
): Promise<void> {
  const playersNotInApi = new Map<
    SummonerIdAndRegionKey,
    { updatedAt: Date; wins: number; losses: number }
  >();

  if (regionsToSkip.length > 0) {
    logger.info(`Skipping demotions for ${regionsToSkip.join(", ")}.`);
  }

  playersFromDb.forEach((playerFromDb, key) => {
    if (regionsToSkip.includes(playerFromDb.region)) return;

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

  const demotedPlayers = Array.from(playersNotInApi)
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
    const chunkSize = 20000; // On season reset, there are a lot of demotions
    for (let i = 0; i < demotedPlayers.length; i += chunkSize) {
      logger.info(`Inserting chunk ${i}...`);
      const chunk = demotedPlayers.slice(i, i + chunkSize);
      await transaction.insert(demotions).values(chunk);
    }
  }
}

/**
 * Updates the database wtih the new player data fetched from the league API.
 *
 * @param players - Players to upsert into the database
 * @param transaction - Transaction to execute the query in
 */
export async function upsertPlayers(
  players: PlayersFromApiMap,
  transaction: Transaction,
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
/**
 * Update the accounts data for all summoners in the dodges list. This includes updating the summoners table and the riot_ids table.
 * Will also fetch the LolPros.gg slug for all EUW accounts and update the riot_ids table with the slug.
 *
 * @param dodges - List of dodges to update accounts data for
 * @param transaction - Transaction to execute the query in
 */
export async function updateAccountsData(
  dodges: Dodge[],
  transaction: Transaction,
): Promise<void> {
  const summonersToFetch = new Map<string, string>();
  const promises = dodges.map((dodge) => {
    summonersToFetch.set(dodge.summonerId, dodge.region);
    return lolApi.Summoner.getById(dodge.summonerId, dodge.region);
  });

  logger.info(
    `Fetching summoner data for ${summonersToFetch.size} summoners...`,
  );
  const summonerResults = await Promise.all(promises);

  const puuidsAndRegion: string[][] = [];
  const summonersToInsert = summonerResults.map((result) => {
    if (result?.response) {
      const summonerData = result.response;

      const region = summonersToFetch.get(summonerData.id)?.toUpperCase();
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

  const accountInfoPromises = puuidsAndRegion.map(async (puuid) => {
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
  const accountResults = await Promise.all(accountInfoPromises);

  const accountsToUpsert = accountResults
    .filter((result) => result?.response !== null)
    .map((result) => {
      const accountData = result!.response;
      return {
        puuid: accountData.puuid,
        gameName: accountData.gameName,
        tagLine: accountData.tagLine,
      };
    });

  // Add all EUW accounts to a separate array to fetch LolPros.gg slugs
  const euwAccounts = accountsToUpsert.filter((_account, index) => {
    return (puuidsAndRegion[index][1] as Regions) === Regions.EU_WEST;
  });

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

  await upsertLolProsSlugs(euwAccounts, transaction);

  logger.info("All summoner and account data updated.");
}

async function upsertLolProsSlugs(
  euwAccounts: {
    puuid: string;
    gameName: string;
    tagLine: string;
  }[],
  transaction: Transaction,
) {
  const lolProsPromises = euwAccounts.map((account) =>
    promiseWithTimeout(
      getLolProsSlug(account.gameName, account.tagLine),
      5 * 1000,
    )
      .then(
        (slug) =>
          ({
            status: "success",
            gameName: account.gameName,
            tagLine: account.tagLine,
            puuid: account.puuid,
            slug,
          }) as const,
      )
      .catch(
        (error) =>
          ({
            status: "error",
            error, // eslint-disable-line
            gameName: account.gameName,
            tagLine: account.tagLine,
            puuid: account.puuid,
          }) as const,
      ),
  );
  const lolProsSlugs = await Promise.all(lolProsPromises);

  const slugsToUpsert: { puuid: string; lolprosSlug: string }[] = [];
  lolProsSlugs.forEach((result, _) => {
    if (result.status === "success" && result.slug) {
      slugsToUpsert.push({
        puuid: result.puuid,
        lolprosSlug: result.slug,
      });
      logger.info(
        `Got lolpros.gg slug for ${result.gameName}#${result.tagLine}: ${result.slug}`,
      );
    } else if (result.status === "error") {
      logger.error(
        `Error fetching LolPros.gg slug for ${result.gameName}#${result.tagLine}: ${JSON.stringify(result.error)}`,
      );
    }
  });

  if (slugsToUpsert.length > 0) {
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
      `${slugsToUpsert.length} lolpros.gg slugs upserted into riot_ids table.`,
    );
  } else {
    logger.info(
      "No lolpros.gg slugs to upsert into riot_ids table, skipping...",
    );
  }
}

async function getLolProsSlug(
  gameName: string,
  tagLine: string,
): Promise<string | null> {
  const lolProsResponseSchema = z.array(
    z
      .object({
        slug: z.string(),
      })
      .passthrough(),
  );
  const url = `https://api.lolpros.gg/es/search?query=${encodeURIComponent(`${gameName}#${tagLine}`)}`;
  logger.info(`Lolpros.gg API request URL: ${url}`);

  const response = await fetch(url);
  const validatedData = lolProsResponseSchema.parse(await response.json());

  if (validatedData.length === 0) {
    return null;
  } else {
    if (validatedData.length > 1) {
      logger.warn(
        `Got multiple lolpros.gg results for ${gameName}#${tagLine}, using the first one... (results: ${JSON.stringify(validatedData)})`,
      );
    }
    return validatedData[0].slug;
  }
}

/**
 * Simple check to see if the number of accounts and summoners in the database match. Does not do anything, only logs a warning.
 *
 * @param transaction - Transaction to execute the query in
 */
export async function checkAccountsAndSummonersCount(transaction: Transaction) {
  const summonersResult = await transaction
    .select({ count: count() })
    .from(summoners);

  const accountsResult = await transaction
    .select({ count: count() })
    .from(riotIds);

  const summonersCount = summonersResult[0].count;
  const accountsCount = accountsResult[0].count;

  if (summonersResult[0].count !== accountsResult[0].count) {
    logger.warn(
      `Summoners count (${summonersCount}) and accounts count (${accountsCount}) do not match!`,
    );
  }
}
