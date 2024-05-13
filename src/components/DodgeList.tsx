import Image from "next/image";
import {
  getDodges,
  getDodgesByPlayer,
  getRankEmblem,
  profileIconUrl,
} from "../data";
import { cn } from "../lib/utils";
import { userRegionToRiotRegion } from "../regions";
import { StatSite } from "../statSites";
import { Tier } from "../types";
import PaginationControls from "./PaginationControls";
import ProfileLink from "./ProfileLink";
import StatSiteButton from "./StatSiteButton";
import TimeString from "./TimeString";

interface DodgeListProps {
  pageNumber: number;
  userRegion: string;
  gameName?: string;
  tagLine?: string;
  statSiteButtons?: boolean;
  profileLink?: boolean;
}

export default async function DodgeList({
  pageNumber,
  userRegion,
  gameName,
  tagLine,
  statSiteButtons = true,
  profileLink = true,
}: DodgeListProps) {
  const dodges = await (async function () {
    if (gameName === undefined || tagLine === undefined) {
      return getDodges(userRegionToRiotRegion(userRegion));
    }
    return getDodgesByPlayer(gameName, tagLine);
  })();

  const entriesPerPage = 50;
  const totalPageCount = Math.ceil(dodges.length / entriesPerPage);

  /* Makes sure the pageNumber variable is valid and inside of bounds */
  pageNumber = (function () {
    if (isNaN(pageNumber)) {
      return 1;
    }
    return Math.min(Math.max(pageNumber, 1), totalPageCount);
  })();

  const startEntryIdx = (Number(pageNumber) - 1) * Number(entriesPerPage);
  const endEntryIdx = startEntryIdx + Number(entriesPerPage);
  const visibleDodgeEntries = dodges.slice(startEntryIdx, endEntryIdx);

  return (
    <>
      <ul className="p-2">
        {visibleDodgeEntries.map((dodge, _) => (
          <li key={dodge.dodgeId} className="border-b border-zinc-900 py-2">
            <div className="grid grid-cols-[3fr,1.2fr,0.9fr,0.8fr] gap-1 md:grid-cols-[2fr,0.8fr,0.3fr,0.6fr] md:gap-2">
              <section className="flex flex-wrap items-center md:text-xl">
                <ProfileLink
                  href={`/${userRegion}/${dodge.gameName}-${dodge.tagLine}`}
                  profileLink={profileLink}
                >
                  <section className="mr-2 flex origin-right transform items-center justify-center underline-offset-4 transition-transform hover:underline sm:justify-start md:hover:scale-105">
                    <div className="relative size-10 self-center md:size-12">
                      <Image
                        alt="Profile Icon"
                        src={profileIconUrl(dodge.profileIconId)}
                        fill
                        quality={100}
                        unoptimized // save vercel bandwidth
                      ></Image>
                    </div>
                    <p className="break-all pl-2 font-bold">
                      {dodge.gameName}#{dodge.tagLine}
                    </p>
                  </section>
                </ProfileLink>
                {statSiteButtons && (
                  <>
                    {dodge.lolProsSlug && (
                      <div className="mr-1">
                        <StatSiteButton
                          riotRegion={dodge.riotRegion}
                          gameName={dodge.gameName}
                          tagLine={dodge.tagLine}
                          statSite={StatSite.LOLPROS}
                          lolProsSlug={dodge.lolProsSlug}
                        />
                      </div>
                    )}
                    <div className="mr-1">
                      <StatSiteButton
                        riotRegion={dodge.riotRegion}
                        gameName={dodge.gameName}
                        tagLine={dodge.tagLine}
                        statSite={StatSite.OPGG}
                      />
                    </div>
                    <StatSiteButton
                      riotRegion={dodge.riotRegion}
                      gameName={dodge.gameName}
                      tagLine={dodge.tagLine}
                      statSite={StatSite.DEEPLOL}
                    />
                  </>
                )}
              </section>
              <section className="flex flex-wrap items-center justify-center text-sm sm:justify-start md:text-base">
                <div className="relative mr-1 size-7 md:size-10">
                  <Image
                    src={getRankEmblem(dodge.rankTier as Tier)}
                    alt={dodge.rankTier}
                    fill
                    quality={100}
                    unoptimized // save vercel bandwidth
                  />
                </div>
                {dodge.lp} LP
              </section>
              <section className="flex items-center justify-center text-left text-sm sm:justify-start md:text-base">
                <p
                  className={cn(
                    "text-nowrap rounded-xl bg-opacity-35 p-1 text-xs md:px-2 md:text-sm",
                    {
                      "border-2 border-yellow-400 border-opacity-30 bg-yellow-400":
                        dodge.lpLost <= 5,
                      "border-2 border-red-400 border-opacity-30 bg-red-400":
                        dodge.lpLost > 5,
                    },
                  )}
                >
                  -{dodge.lpLost} LP
                </p>
              </section>
              <section className="flex flex-wrap items-center justify-end text-right text-xs md:text-sm">
                <TimeString utcTime={dodge.time} />
              </section>
            </div>
          </li>
        ))}
      </ul>
      {totalPageCount > 1 && (
        <div className="flex justify-center">
          <PaginationControls
            currentPage={pageNumber}
            hasNextPage={endEntryIdx < dodges.length}
            hasPrevPage={startEntryIdx > 0}
            totalPageCount={totalPageCount}
          />
        </div>
      )}
    </>
  );
}
