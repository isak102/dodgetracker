import RankInfo from "@/src/components/RankInfo";
import { type getLeaderboard } from "@/src/data";
import { type Tier } from "@/src/lib/types";
import { cn } from "@/src/lib/utils";
import { StatSite } from "@/src/statSites";
import ProfileLink from "../../player/components/ProfileLink";
import SmallProfileCard from "../../player/components/SmallProfileCard";
import StatSiteButton from "../../player/components/StatSiteButton";

export default function LeaderboardEntry(props: {
  entry: Awaited<ReturnType<typeof getLeaderboard>>["data"][number];
  index: number;
  userRegion: string;
  pageNumber: number;
  pageSize: number;
  includeRankInfo: boolean;
}) {
  return (
    <div
      key={props.index}
      className={cn("grid gap-2 border-b border-zinc-900 p-2", {
        "grid-cols-[0.15fr,2.5fr,0.7fr,0.7fr]": props.includeRankInfo,
        "grid-cols-[0.15fr,2.5fr,0.7fr]": !props.includeRankInfo,
      })}
    >
      <p className="flex items-center justify-center font-bold md:text-lg">
        {(props.pageNumber - 1) * props.pageSize + props.index + 1}.
      </p>
      <section className="flex flex-wrap items-center md:text-xl">
        <ProfileLink
          href={`/${props.userRegion}/${props.entry.gameName}-${props.entry.tagLine}`}
          profileLink={true}
        >
          <SmallProfileCard
            showLolProsInfo={true}
            lolProsSlug={props.entry.lolProsSlug}
            lolProsName={props.entry.lolProsName}
            lolProsCountry={props.entry.lolProsCountry}
            lolProsPosition={props.entry.lolProsPosition}
            gameName={props.entry.gameName}
            tagLine={props.entry.tagLine}
            profileIconId={props.entry.profileIconId}
            userRegion={props.userRegion}
            profileLink={true}
          />
        </ProfileLink>
        <div className="flex flex-wrap md:items-center md:justify-center">
          {props.entry.lolProsSlug && (
            <div className="mr-1">
              <StatSiteButton
                className="text-xs"
                riotRegion={props.entry.riotRegion}
                gameName={props.entry.gameName}
                tagLine={props.entry.tagLine}
                statSite={StatSite.LOLPROS}
                lolProsSlug={props.entry.lolProsSlug}
              />
            </div>
          )}
          <div>
            <StatSiteButton
              statSite={StatSite.OPGG}
              riotRegion={props.entry.riotRegion}
              gameName={props.entry.gameName}
              tagLine={props.entry.tagLine}
            />
          </div>
          <div className="pl-1">
            <StatSiteButton
              statSite={StatSite.DEEPLOL}
              riotRegion={props.entry.riotRegion}
              gameName={props.entry.gameName}
              tagLine={props.entry.tagLine}
            />
          </div>
        </div>
      </section>
      {props.includeRankInfo && (
        <RankInfo
          rankTier={props.entry.rankTier as Tier}
          lp={props.entry.currentLP}
        />
      )}
      <div className="flex justify-end">
        <div className="flex w-fit flex-col items-center justify-center">
          <p>{props.entry.numberOfDodges}</p>
          <p className="text-xs">dodges</p>
        </div>
      </div>
    </div>
  );
}
