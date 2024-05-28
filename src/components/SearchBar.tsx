"use client";

import { useQuery } from "@tanstack/react-query";
import { useClickAway, useDebounce } from "@uidotdev/usehooks";
import { Dot } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { useState } from "react";
import { z } from "zod";
import { cn, getRankEmblem } from "../lib/utils";
import { userRegionToRiotRegion } from "../regions";
import { Tier } from "../types";
import { Input } from "./ui/input";

interface SearchBarProps extends React.HTMLAttributes<HTMLDivElement> {}

const playerSchema = z.object({
  players: z.array(
    z.object({
      gameName: z.string(),
      tagLine: z.string(),
      rankTier: z.string(),
      lp: z.number(),
      summonerLevel: z.number(),
      profileIconId: z.number(),
      lastUpdatedAt: z.coerce.date(),
    }),
  ),
});

const fetchPlayers = async (searchFilter: string, userRegion: string) => {
  const riotRegion = userRegionToRiotRegion(userRegion);
  return fetch(
    `/api/players?search=${encodeURIComponent(searchFilter)}&region=${riotRegion}`,
  )
    .then((res) => res.json())
    .then((data) => {
      return playerSchema.parse(data);
    });
};

function isWithinDays(oldDate: Date, now: Date, dayLimit: number): boolean {
  const differenceInMillis = Math.abs(now.getTime() - oldDate.getTime());
  const differenceInDays = differenceInMillis / (1000 * 60 * 60 * 24);
  return differenceInDays < dayLimit;
}

export default function SearchBar({ className }: SearchBarProps) {
  const [inputHasFocus, setInputHasFocus] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const debouncedSearchFilter = useDebounce(searchFilter, 250);
  const region = usePathname().split("/")[1];

  const ref = useClickAway(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    setInputHasFocus(false);
  });

  const { data, isPending } = useQuery({
    queryKey: ["players", debouncedSearchFilter, region],
    queryFn: () => fetchPlayers(debouncedSearchFilter!, region),
    enabled: debouncedSearchFilter.length > 0,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const inputHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchFilter(e.target.value);
    setInputHasFocus(true);
  };

  return (
    <>
      <div className="relative">
        <Input
          className={cn("w-96", className)}
          placeholder="Search players..."
          value={searchFilter}
          onChange={inputHandleChange}
          onClick={() => setInputHasFocus(true)}
          onFocus={() => {
            setInputHasFocus(true);
            posthog.capture("searchbar_focused");
          }}
          ref={ref as any}
        />
        <div className="absolute top-10 z-[100] flex w-full flex-col justify-center rounded-sm bg-zinc-900 shadow-sm shadow-zinc-900">
          {inputHasFocus && data && data.players.length > 0 && (
            <ul>
              {data.players.map((player) => (
                <li
                  className="hover:bg-zinc-800"
                  key={`${player.gameName}#${player.tagLine}`}
                >
                  <Link
                    className="flex items-center border-b border-zinc-800 p-1"
                    href={`/${region}/${player.gameName}-${player.tagLine}`}
                    onClick={() => {
                      setSearchFilter("");
                      posthog.capture("searched_player", {
                        region: region,
                        gameName: player.gameName,
                        tagLine: player.tagLine,
                      });
                    }}
                  >
                    <div className="flex items-center">
                      <Image
                        className="pr-1"
                        alt="Profile Icon"
                        src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${player.profileIconId}.jpg`}
                        width={32}
                        height={32}
                        unoptimized
                      />
                      <div className="flex flex-col">
                        <p className="font-semibold">
                          {player.gameName}#{player.tagLine}
                        </p>
                        <div className="text-xs font-light">
                          <div className="flex items-center gap-1">
                            {isWithinDays(
                              player.lastUpdatedAt,
                              new Date(),
                              3,
                            ) && (
                              <>
                                <Image
                                  src={getRankEmblem(player.rankTier as Tier)}
                                  alt={player.rankTier}
                                  quality={100}
                                  width={16}
                                  height={16}
                                  unoptimized
                                />
                                <p>{player.lp} LP</p>
                                <Dot size={10} />
                              </>
                            )}
                            <p>LVL {player.summonerLevel}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {inputHasFocus && isPending && searchFilter.length > 0 && (
            <div className="flex items-center justify-center p-2">
              <p>Loading...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
