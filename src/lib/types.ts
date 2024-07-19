import { z } from "zod";
import { getCurrentSeason, seasons } from "../seasons";

export enum Tier {
  MASTER = "MASTER",
  GRANDMASTER = "GRANDMASTER",
  CHALLENGER = "CHALLENGER",
}

const currentSeason = getCurrentSeason();
export const LeaderboardSearchParamsSchema = z.object({
  page: z.coerce.number().optional().default(1).catch(1),
  season: z
    .enum(seasons.map((season) => season.value) as [string, ...string[]])
    .optional()
    .default(currentSeason)
    .catch(currentSeason),
});

export const dodgeSchema = z.object({
  dodgeId: z.coerce.bigint(),
  gameName: z.string(),
  tagLine: z.string(),
  lolProsSlug: z.union([z.string(), z.undefined()]).transform((value) => {
    if (value === undefined) return null;
    return value;
    // return value === undefined ?? null : value
  }),
  profileIconId: z.number(),
  riotRegion: z.string(),
  rankTier: z.enum(["CHALLENGER", "GRANDMASTER", "MASTER"]),
  lp: z.number(),
  lpLost: z.number(),
  time: z.string().datetime({ offset: true }).pipe(z.coerce.date()),
});
export type Dodge = z.infer<typeof dodgeSchema>;