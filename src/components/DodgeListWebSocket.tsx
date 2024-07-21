"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useMemo } from "react";
import useWebSocket from "react-use-websocket";
import { z } from "zod";
import { dodgeSchema, type Dodge, type Tier } from "../lib/types";
import { cn, profileIconUrl } from "../lib/utils";
import { userRegionToRiotRegion } from "../regions";
import { StatSite } from "../statSites";
import LoadingSpinner from "./LoadingSpinner";
import ProfileLink from "./ProfileLink";
import RankInfo from "./RankInfo";
import StatSiteButton from "./StatSiteButton";
import TimeString from "./TimeString";

/* eslint-disable */
interface BigInt {
  /** Convert to BigInt to string form in JSON.stringify */
  toJSON: () => string;
}
// @ts-ignore
BigInt.prototype.toJSON = function () {
  return this.toString();
};
/* eslint-enable */

type DodgeListWebSocketProps = {
  userRegion: string;
};

const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL!;
console.log(websocketUrl);

const dodgeListSchema = z.object({
  dodges: z.array(dodgeSchema),
});

async function fetchDodges(riotRegion: string) {
  const response = await fetch(`/api/dodges?region=${riotRegion}`);
  if (!response.ok)
    throw new Error(`Fetch failed with status: ${response.status}.`);

  const data = await response.json(); // eslint-disable-line
  return dodgeListSchema.parse(data).dodges;
}

export default function DodgeListWebSocket(props: DodgeListWebSocketProps) {
  const riotRegion = userRegionToRiotRegion(props.userRegion);
  const queryKey = useMemo(() => ["dodges", riotRegion], [riotRegion]);

  const queryClient = useQueryClient();

  const { data: dodges, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchDodges(riotRegion),
    staleTime: Infinity,
  });

  function invalidateQuery() {
    queryClient
      .invalidateQueries({ queryKey, exact: true })
      .catch(console.error);
  }

  const { lastJsonMessage } = useWebSocket(
    `${websocketUrl}/?region=${riotRegion}`,
    {
      onOpen: () => {
        console.log("WebSocket connection opened");
        invalidateQuery();
      },
      onClose: () => {
        console.log("WebSocket connection closed");
        invalidateQuery();
      },
      onError: (event) => {
        return console.error("WebSocket error", event);
      },
      shouldReconnect: (_) => true,
    },
  );

  // Effect to handle incoming messages
  useEffect(() => {
    if (lastJsonMessage !== null) {
      try {
        const parsedData = dodgeSchema.parse(lastJsonMessage);

        queryClient.setQueryData(queryKey, (oldData: Dodge[]) => {
          return [parsedData, ...oldData];
        });
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    }
  }, [lastJsonMessage, queryClient, queryKey]);

  if (!dodges && isFetching) {
    return (
      <div className="flex h-[75vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!dodges) return;
  return (
    <ul className="p-2">
      {dodges.map((dodge, _) => (
        <li key={dodge.dodgeId} className="border-b border-zinc-900 py-2">
          <div className="grid grid-cols-[3fr,1.2fr,0.9fr,0.8fr] gap-1 md:grid-cols-[2fr,0.8fr,0.3fr,0.6fr] md:gap-2">
            <section className="flex flex-wrap items-center md:text-xl">
              <ProfileLink
                href={`/${props.userRegion}/${dodge.gameName}-${dodge.tagLine}`}
                profileLink={true}
              >
                <section className="mr-2 flex origin-right transform items-center justify-center underline-offset-4 transition-transform hover:underline sm:justify-start md:hover:scale-105">
                  <div className="relative size-10 self-center md:size-12">
                    <Image
                      alt="Profile Icon"
                      src={profileIconUrl(dodge.profileIconId)}
                      quality={100}
                      unoptimized
                      layout="fill"
                      style={{ objectFit: "contain" }}
                    ></Image>
                  </div>
                  <div className="flex flex-wrap break-all pl-2 font-bold">
                    <p>{dodge.gameName}</p>
                    <p>#{dodge.tagLine}</p>
                  </div>
                </section>
              </ProfileLink>
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
            </section>
            <RankInfo rankTier={dodge.rankTier as Tier} lp={dodge.lp} />
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
            <section className="flex flex-wrap items-center justify-end text-right text-xs font-light md:text-sm">
              <TimeString utcTime={dodge.time} />
            </section>
          </div>
        </li>
      ))}
    </ul>
  );
}
