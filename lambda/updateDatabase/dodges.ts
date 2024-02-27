import { Regions } from "twisted/dist/constants";
import {
    LeagueItemDTOWithRegionAndTier,
    constructSummonerAndRegionKey,
} from "./players";
import { PoolConnection } from "mysql2/promise";
import logger from "./logger";

export interface Dodge {
    summonerId: string;
    lp_before: number;
    lp_after: number;
    region: Regions;
    rankTier: string;
    atGamesPlayed: number;
}

const DECAY_LP_LOSS = 75;

export async function getDodges(
    oldPlayersData: Map<string, { lp: number; gamesPlayed: number }>,
    newPlayersData: LeagueItemDTOWithRegionAndTier[],
): Promise<Dodge[]> {
    logger.info("Getting dodges...");
    let dodges: Dodge[] = [];
    let notFound = 0;
    newPlayersData.forEach((newData) => {
        const oldData = oldPlayersData.get(
            constructSummonerAndRegionKey(newData.summonerId, newData.region),
        );
        if (oldData) {
            const newGamesPlayed = newData.wins + newData.losses;
            if (
                newData.leaguePoints < oldData.lp &&
                newGamesPlayed == oldData.gamesPlayed &&
                oldData.lp - newData.leaguePoints != DECAY_LP_LOSS
            ) {
                dodges.push({
                    summonerId: newData.summonerId,
                    lp_before: oldData.lp,
                    lp_after: newData.leaguePoints,
                    region: newData.region,
                    rankTier: newData.rankTier,
                    atGamesPlayed: oldData.gamesPlayed,
                });
            }
        } else {
            notFound++;
        }
    });
    logger.info(`Old data not found for ${notFound} players`);
    logger.info(`Found ${dodges.length} dodges`);
    return dodges;
}

export async function insertDodges(
    dodges: Dodge[],
    connection: PoolConnection,
): Promise<void> {
    const query = `
        INSERT INTO dodges (summoner_id, lp_before, lp_after, region, rank_tier, at_games_played)
        VALUES ?
    `;

    await connection.query(query, [
        dodges.map((dodge) => Object.values(dodge)),
    ]);
}
