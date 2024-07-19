import DodgeList from "@/src/components/DodgeList";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import StatSiteButton from "@/src/components/StatSiteButton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { getSummoner } from "@/src/data";
import { type Tier } from "@/src/lib/types";
import { decodeRiotIdURIComponent } from "@/src/lib/utils";
import { supportedUserRegions, userRegionToRiotRegion } from "@/src/regions";
import { StatSite } from "@/src/statSites";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import DodgeCounts from "./_components/DodgeCounts";
import DodgeTypes from "./_components/DodgeTypes";
import ProfileCard from "./_components/ProfileCard";

// FIXME: Add metadata

export type SummonerPageProps = {
  params: {
    region: string;
    riotID: string;
  };
  searchParams: {
    page?: string;
  };
};

export async function generateMetadata({
  params,
}: SummonerPageProps): Promise<Metadata> {
  const [gameName, tagLine] = decodeRiotIdURIComponent(params.riotID);

  return {
    title: `${gameName}#${tagLine} (${params.region.toUpperCase()}) - Dodge History`,
    description: `Dodge history of ${gameName}#${tagLine} (${params.region.toUpperCase()}) in League of Legends`,
  };
}

export default async function Summoner({
  params,
  searchParams,
}: SummonerPageProps) {
  const pageNumber = parseInt(searchParams.page ?? "1", 10);
  const [gameName, tagLine] = decodeRiotIdURIComponent(params.riotID);
  const region = (function () {
    if (!supportedUserRegions.has(params.region)) {
      notFound();
    }
    return params.region;
  })();
  const summoner = await getSummoner(gameName, tagLine, region);

  if (!summoner) {
    notFound();
  }

  return (
    <section>
      <section className="flex min-h-[25vh] flex-wrap items-center justify-center border-b-4 border-zinc-900 bg-zinc-600">
        <div className="flex flex-col items-center justify-center">
          <div className="m-2 my-4 md:mx-14">
            <ProfileCard
              gameName={summoner.gameName}
              tagLine={summoner.tagLine}
              rankTier={summoner.rankTier as Tier}
              currentLp={summoner.currentLp}
              profileIconId={summoner.profileIconId}
              summonerLevel={summoner.summonerLevel}
              lastUpdateTime={summoner.lastUpdateTime}
            />
          </div>
          <section className="flex items-center justify-center gap-1">
            {summoner.lolProsSlug && (
              <StatSiteButton
                statSite={StatSite.LOLPROS}
                gameName={gameName}
                tagLine={tagLine}
                riotRegion={userRegionToRiotRegion(region)}
                lolProsSlug={summoner.lolProsSlug}
              />
            )}
            <StatSiteButton
              statSite={StatSite.OPGG}
              gameName={gameName}
              tagLine={tagLine}
              riotRegion={userRegionToRiotRegion(region)}
            />
            <StatSiteButton
              statSite={StatSite.DEEPLOL}
              gameName={gameName}
              tagLine={tagLine}
              riotRegion={userRegionToRiotRegion(region)}
            />
          </section>
        </div>
        <div className="flex h-36 w-80 items-center justify-center p-2 md:h-52 md:py-6">
          <DodgeCounts gameName={gameName} tagLine={tagLine} />
        </div>
      </section>
      <section className="w-full">
        <Tabs defaultValue="history" className="py-2">
          <div className="flex justify-center">
            <TabsList className="mx-auto">
              <TabsTrigger value="history">Dodge History</TabsTrigger>
              <TabsTrigger value="stats">Dodge Statistics</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent
            value="stats"
            className="flex items-center justify-center"
          >
            <Suspense
              fallback={
                <div className="size-16">
                  <LoadingSpinner />
                </div>
              }
            >
              <div className="flex flex-wrap items-center justify-center">
                <div className="flex flex-col items-center justify-center">
                  <p className="font-semibold">Short/long Dodge Ratio</p>
                  <div className="flex w-96 items-center justify-center">
                    <DodgeTypes gameName={gameName} tagLine={tagLine} />
                  </div>
                </div>
              </div>
            </Suspense>
          </TabsContent>
          <TabsContent value="history">
            <Suspense
              key={`${gameName}#${tagLine}-${region}`}
              fallback={
                <div className="flex h-[70vh] items-center justify-center">
                  <LoadingSpinner />
                </div>
              }
            >
              <div className="mx-auto lg:w-5/6">
                <DodgeList
                  userRegion={region}
                  pageNumber={pageNumber}
                  gameName={gameName}
                  tagLine={tagLine}
                  statSiteButtons={false}
                  profileLink={false}
                />
              </div>
            </Suspense>
          </TabsContent>
        </Tabs>
      </section>
    </section>
  );
}
