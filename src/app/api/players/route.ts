import { db } from "@/src/db";
import { apexTierPlayers, riotIds, summoners } from "@/src/db/schema";
import { and, eq, like, or } from "drizzle-orm";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const search = searchParams.get("search");
  const region = searchParams.get("region");

  if (!search) {
    return Response.json(
      {},
      { status: 400, statusText: "Missing query parameter `search`" },
    );
  }
  if (!region) {
    return Response.json(
      {},
      { status: 400, statusText: "Missing query parameter `region`" },
    );
  }

  const [gameName, tagLine] = search.includes("#")
    ? search.split("#")
    : [search, ""];

  let players = await db
    .select({
      gameName: riotIds.gameName,
      tagLine: riotIds.tagLine,
      rankTier: apexTierPlayers.rankTier,
      lp: apexTierPlayers.currentLp,
      summonerLevel: summoners.summonerLevel,
      profileIconId: summoners.profileIconId,
      lastUpdatedAt: apexTierPlayers.updatedAt,
    })
    .from(riotIds)
    .innerJoin(summoners, eq(riotIds.puuid, summoners.puuid))
    .innerJoin(
      apexTierPlayers,
      and(
        eq(apexTierPlayers.summonerId, summoners.summonerId),
        eq(apexTierPlayers.region, region.toUpperCase()),
      ),
    )
    .where(
      or(
        and(
          eq(summoners.region, region.toUpperCase()),
          like(riotIds.gameName, gameName + "%"),
          like(riotIds.tagLine, tagLine + "%"),
        ),
        like(riotIds.lolprosSlug, gameName + "%"),
      ),
    )
    .limit(10);

  return Response.json({ players });
}
