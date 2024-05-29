import {
  apexTierPlayers,
  demotions,
  dodges,
  playerCounts,
  promotions,
  riotIds,
  summoners,
} from "@/src/db/schema";
import "dotenv/config";
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { userRegionToRiotRegion } from "./regions";
import { seasons } from "./seasons";
import { Tier } from "./types"; // Assuming Dodge is properly defined to match the query results

export function profileIconUrl(profileIconID: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${profileIconID}.jpg`;
}

export async function getDodges(
  riotRegion: string,
  pageSize: number,
  page: number,
) {
  return await db
    .select({
      dodgeId: dodges.dodgeId,
      gameName: riotIds.gameName,
      tagLine: riotIds.tagLine,
      lolProsSlug: riotIds.lolprosSlug,
      profileIconId: summoners.profileIconId,
      riotRegion: dodges.region,
      rankTier: dodges.rankTier,
      lp: dodges.lpBefore,
      lpLost: sql<number>`${dodges.lpBefore} - ${dodges.lpAfter}`,
      time: dodges.createdAt,
    })
    .from(dodges)
    .innerJoin(
      summoners,
      and(
        eq(dodges.summonerId, summoners.summonerId),
        eq(dodges.region, summoners.region),
      ),
    )
    .innerJoin(riotIds, eq(summoners.puuid, riotIds.puuid))
    .where(eq(dodges.region, riotRegion))
    .orderBy(desc(dodges.createdAt))
    .limit(pageSize)
    .offset(pageSize * (page - 1));
}

export async function getDodgesByPlayer(
  gameName: string,
  tagLine: string,
  pageSize: number,
  page: number,
) {
  return await db
    .select({
      dodgeId: dodges.dodgeId,
      gameName: riotIds.gameName,
      tagLine: riotIds.tagLine,
      lolProsSlug: riotIds.lolprosSlug,
      profileIconId: summoners.profileIconId,
      riotRegion: dodges.region,
      rankTier: dodges.rankTier,
      lp: dodges.lpBefore,
      lpLost: sql<number>`${dodges.lpBefore} - ${dodges.lpAfter}`,
      time: dodges.createdAt,
    })
    .from(dodges)
    .innerJoin(
      summoners,
      and(
        eq(dodges.summonerId, summoners.summonerId),
        eq(dodges.region, summoners.region),
      ),
    )
    .innerJoin(riotIds, eq(summoners.puuid, riotIds.puuid))
    .where(and(eq(riotIds.gameName, gameName), eq(riotIds.tagLine, tagLine)))
    .orderBy(desc(dodges.createdAt))
    .limit(pageSize)
    .offset(pageSize * (page - 1));
}

export async function getAllDodgesByPlayer(gameName: string, tagLine: string) {
  return await db
    .select({
      dodgeId: dodges.dodgeId,
      gameName: riotIds.gameName,
      tagLine: riotIds.tagLine,
      lolProsSlug: riotIds.lolprosSlug,
      profileIconId: summoners.profileIconId,
      riotRegion: dodges.region,
      rankTier: dodges.rankTier,
      lp: dodges.lpBefore,
      lpLost: sql<number>`${dodges.lpBefore} - ${dodges.lpAfter}`,
      time: dodges.createdAt,
    })
    .from(dodges)
    .innerJoin(
      summoners,
      and(
        eq(dodges.summonerId, summoners.summonerId),
        eq(dodges.region, summoners.region),
      ),
    )
    .innerJoin(riotIds, eq(summoners.puuid, riotIds.puuid))
    .where(and(eq(riotIds.gameName, gameName), eq(riotIds.tagLine, tagLine)))
    .orderBy(desc(dodges.createdAt));
}

export interface Summoner {
  gameName: string | null;
  tagLine: string | null;
  summonerLevel: number | null;
  profileIconId: number | null;
  rankTier: Tier | null;
  currentLp: number | null;
  wins: number;
  losses: number;
  lastUpdateTime: Date | null;
  isInLatestUpdate: boolean | null;
}

export async function getSummoner(
  gameName: string,
  tagLine: string,
  userRegion: string,
) {
  const res = await db
    .select({
      gameName: riotIds.gameName,
      tagLine: riotIds.tagLine,
      riotRegion: summoners.region,
      summonerLevel: summoners.summonerLevel,
      profileIconId: summoners.profileIconId,
      rankTier: apexTierPlayers.rankTier,
      currentLp: apexTierPlayers.currentLp,
      wins: apexTierPlayers.wins,
      losses: apexTierPlayers.losses,
      lastUpdateTime: apexTierPlayers.updatedAt,
      isInLatestUpdate: sql<boolean>`(${apexTierPlayers.updatedAt} = (SELECT MAX(${apexTierPlayers.updatedAt}) FROM ${apexTierPlayers}))`,
    })
    .from(riotIds)
    .innerJoin(summoners, eq(riotIds.puuid, summoners.puuid))
    .innerJoin(
      apexTierPlayers,
      and(
        eq(summoners.summonerId, apexTierPlayers.summonerId),
        eq(summoners.region, apexTierPlayers.region),
      ),
    )
    .where(and(eq(riotIds.gameName, gameName), eq(riotIds.tagLine, tagLine)))
    .limit(1);

  if (res.length === 0) return null;
  const summoner = res[0];
  if (summoner.riotRegion !== userRegionToRiotRegion(userRegion)) return null;
  return summoner;
}

export async function getDodgeCounts(gameName: string, tagLine: string) {
  let res = await db
    .select({
      last24Hours: sql<number>`COUNT(CASE WHEN ${dodges.createdAt} >= CURRENT_TIMESTAMP - INTERVAL 1 DAY THEN 1 END)`,
      last7Days: sql<number>`COUNT(CASE WHEN ${dodges.createdAt} >= CURRENT_TIMESTAMP - INTERVAL 7 DAY THEN 1 END)`,
      last30Days: sql<number>`COUNT(CASE WHEN ${dodges.createdAt} >= CURRENT_TIMESTAMP - INTERVAL 30 DAY THEN 1 END)`,
    })
    .from(riotIds)
    .innerJoin(summoners, eq(riotIds.puuid, summoners.puuid))
    .innerJoin(dodges, eq(summoners.summonerId, dodges.summonerId))
    .where(and(eq(riotIds.gameName, gameName), eq(riotIds.tagLine, tagLine)))
    .having(sql<number>`COUNT(${dodges.dodgeId}) > 0`);

  switch (res.length) {
    case 0:
      return null;
    case 1:
      return res[0];
    default:
      throw new Error(
        `Expected 0 or 1 dodge counts, but received ${res.length} dodge counts.`,
      );
  }
}

export async function getLeaderboard(
  riotRegion: string,
  pageSize: number,
  page: number,
  seasonValue: string,
) {
  const season = seasons.find((s) => s.value === seasonValue)!;

  const startDate =
    season.startDate[riotRegion as keyof typeof season.startDate]!;
  const endDate = season.endDate[riotRegion as keyof typeof season.endDate]!;

  const totalEntriesQuery = db
    .select({
      total: sql<number>`COUNT(DISTINCT ${riotIds.gameName})`,
    })
    .from(dodges)
    .innerJoin(
      summoners,
      and(
        eq(dodges.summonerId, summoners.summonerId),
        eq(dodges.region, summoners.region),
      ),
    )
    .innerJoin(riotIds, eq(summoners.puuid, riotIds.puuid))
    .where(
      and(
        eq(dodges.region, riotRegion),
        and(gt(dodges.createdAt!, startDate), lt(dodges.createdAt!, endDate)),
      ),
    );

  const leaderboardQuery = db
    .select({
      gameName: riotIds.gameName,
      tagLine: riotIds.tagLine,
      riotRegion: summoners.region,
      lolProsSlug: riotIds.lolprosSlug,
      rankTier: apexTierPlayers.rankTier,
      currentLP: apexTierPlayers.currentLp,
      profileIconId: summoners.profileIconId,
      wins: apexTierPlayers.wins,
      losses: apexTierPlayers.losses,
      numberOfDodges: sql<number>`COUNT(${dodges.dodgeId})`,
      profileIconID: summoners.profileIconId,
    })
    .from(dodges)
    .innerJoin(
      summoners,
      and(
        eq(dodges.summonerId, summoners.summonerId),
        eq(dodges.region, summoners.region),
      ),
    )
    .innerJoin(riotIds, eq(summoners.puuid, riotIds.puuid))
    .innerJoin(
      apexTierPlayers,
      and(
        eq(summoners.summonerId, apexTierPlayers.summonerId),
        eq(summoners.region, apexTierPlayers.region),
      ),
    )
    .where(
      and(
        eq(dodges.region, riotRegion),
        and(gt(dodges.createdAt!, startDate), lt(dodges.createdAt!, endDate)),
      ),
    )
    .groupBy(riotIds.gameName, riotIds.tagLine)
    .orderBy(
      desc(sql<number>`COUNT(${dodges.dodgeId})`),
      asc(sql<number>`(${apexTierPlayers.wins} + ${apexTierPlayers.losses})`),
    )
    .limit(pageSize)
    .offset(pageSize * (page - 1));

  const [totalEntriesResult, leaderboardResult] = await Promise.all([
    totalEntriesQuery,
    leaderboardQuery,
  ]);

  const totalEntries = totalEntriesResult[0]?.total || 0;

  return {
    totalEntries,
    data: leaderboardResult,
  };
}
export async function getAccounts() {
  return await db
    .select({
      gameName: riotIds.gameName,
      tagLine: riotIds.tagLine,
      riotRegion: summoners.region,
      lastDodgeTime: sql<Date>`(SELECT MAX(${dodges.createdAt}) FROM ${dodges} WHERE ${dodges.summonerId} = ${summoners.summonerId} AND ${dodges.region} = ${summoners.region})`,
    })
    .from(riotIds)
    .innerJoin(summoners, eq(riotIds.puuid, summoners.puuid));
}

export function getRankEmblem(rankTier: Tier) {
  const rankTierStr = rankTier.toLowerCase();
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${rankTierStr}.svg`;
}

/**
 * Get the dodges per game for a player in the current split. Dodges per came can not be calculated for
 * older as the games played data is not available.
 *
 * @param gameName - Game name of the player
 * @param tagLine - Tag line of the player
 */
export async function getDodgesPerGame(gameName: string, tagLine: string) {
  const time = new Date();

  const [promotionsResult, demotionsResult] = await Promise.all([
    db
      .select({
        createdAt: promotions.createdAt,
        atGames: sql<number>`(${apexTierPlayers.wins} + ${apexTierPlayers.losses})`,
      })
      .from(promotions)
      .innerJoin(
        summoners,
        and(
          eq(promotions.summonerId, summoners.summonerId),
          eq(promotions.region, summoners.region),
        ),
      )
      .innerJoin(riotIds, eq(summoners.puuid, riotIds.puuid))
      .innerJoin(
        apexTierPlayers,
        and(
          eq(summoners.summonerId, apexTierPlayers.summonerId),
          eq(summoners.region, apexTierPlayers.region),
        ),
      )
      .where(and(eq(riotIds.gameName, gameName), eq(riotIds.tagLine, tagLine))),

    db
      .select({
        createdAt: demotions.createdAt,
        atGames: sql<number>`(${apexTierPlayers.wins} + ${apexTierPlayers.losses})`,
      })
      .from(demotions)
      .innerJoin(
        summoners,
        and(
          eq(demotions.summonerId, summoners.summonerId),
          eq(demotions.region, summoners.region),
        ),
      )
      .innerJoin(riotIds, eq(summoners.puuid, riotIds.puuid))
      .innerJoin(
        apexTierPlayers,
        and(
          eq(summoners.summonerId, apexTierPlayers.summonerId),
          eq(summoners.region, apexTierPlayers.region),
        ),
      )
      .where(and(eq(riotIds.gameName, gameName), eq(riotIds.tagLine, tagLine))),
  ]);

  console.log(`Query took ${new Date().getTime() - time.getTime()}ms`);
}

export async function getDodgesCount(
  riotRegion: string,
  gameName?: string,
  tagLine?: string,
) {
  let result;

  if (gameName && tagLine) {
    result = await db
      .select({
        count: sql<number>`COUNT(${dodges.dodgeId})`,
      })
      .from(dodges)
      .innerJoin(
        summoners,
        and(
          eq(dodges.summonerId, summoners.summonerId),
          eq(dodges.region, summoners.region),
        ),
      )
      .innerJoin(riotIds, eq(summoners.puuid, riotIds.puuid))
      .where(
        and(
          eq(dodges.region, riotRegion),
          eq(riotIds.gameName, gameName),
          eq(riotIds.tagLine, tagLine),
        ),
      );
  } else {
    result = await db
      .select({
        count: sql<number>`COUNT(${dodges.dodgeId})`,
      })
      .from(dodges)
      .where(and(eq(dodges.region, riotRegion)));
  }

  return result[0].count;
}

export async function getLatestPlayerCount(riotRegion: string): Promise<{
  masterCount: number;
  grandmasterCount: number;
  challengerCount: number;
  atTime: Date;
  riotRegion: string;
}> {
  const masterRes = await db
    .select()
    .from(playerCounts)
    .where(
      and(
        eq(playerCounts.region, riotRegion),
        eq(playerCounts.rankTier, "MASTER"),
      ),
    )
    .orderBy(desc(playerCounts.playerCountId))
    .limit(1);
  const grandmasterRes = await db
    .select()
    .from(playerCounts)
    .where(
      and(
        eq(playerCounts.region, riotRegion),
        eq(playerCounts.rankTier, "GRANDMASTER"),
      ),
    )
    .orderBy(desc(playerCounts.playerCountId))
    .limit(1);
  const challengerRes = await db
    .select()
    .from(playerCounts)
    .where(
      and(
        eq(playerCounts.region, riotRegion),
        eq(playerCounts.rankTier, "CHALLENGER"),
      ),
    )
    .orderBy(desc(playerCounts.playerCountId))
    .limit(1);

  const masterCount = masterRes[0]?.playerCount!;
  const grandmasterCount = grandmasterRes[0]?.playerCount!;
  const challengerCount = challengerRes[0]?.playerCount!;

  const atTime =
    masterRes[0]?.atTime ||
    grandmasterRes[0]?.atTime ||
    challengerRes[0]?.atTime!;
  const region = riotRegion;

  return {
    masterCount,
    grandmasterCount,
    challengerCount,
    atTime,
    riotRegion: region,
  };
}
