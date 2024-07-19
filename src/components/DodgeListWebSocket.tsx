"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import useWebSocket from "react-use-websocket";
import { dodgeSchema, type Dodge, type Tier } from "../lib/types";
import { cn, profileIconUrl } from "../lib/utils";
import { userRegionToRiotRegion } from "../regions";
import { StatSite } from "../statSites";
import ProfileLink from "./ProfileLink";
import RankInfo from "./RankInfo";
import StatSiteButton from "./StatSiteButton";
import TimeString from "./TimeString";

type DodgeListWebSocketProps = {
  userRegion: string;
};

const websocketUrl = "ws://localhost:8080";

export default function DodgeListWebSocket(props: DodgeListWebSocketProps) {
  const riotRegion = userRegionToRiotRegion(props.userRegion);
  const [dodges, setDodges] = useState<Dodge[]>([]); // Initialize state to store dodges
  const { lastJsonMessage } = useWebSocket(
    `${websocketUrl}/?region=${riotRegion}`,
    {
      onOpen: () => console.log("WebSocket connection opened"),
      onClose: () => console.log("WebSocket connection closed"),
      onError: (event) => console.error("WebSocket error", event),
      shouldReconnect: (_) => true, // Reconnect on close
    },
  );

  // Effect to handle incoming messages
  useEffect(() => {
    if (lastJsonMessage !== null) {
      try {
        const parsedData = dodgeSchema.parse(lastJsonMessage);
        setDodges((prevDodges) => [parsedData, ...prevDodges]);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    }
  }, [lastJsonMessage]);

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
