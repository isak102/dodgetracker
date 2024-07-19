"use client";

import { Kbd } from "@nextui-org/kbd";
import { useQuery } from "@tanstack/react-query";
import { useClickAway, useDebounce } from "@uidotdev/usehooks";
import { Dot, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { type Tier } from "../lib/types";
import { cn, getRankEmblem, isWithinDays, profileIconUrl } from "../lib/utils";
import { userRegionToRiotRegion } from "../regions";
import { Input } from "./ui/input";

type SearchBarProps = React.HTMLAttributes<HTMLDivElement>;

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

  const response = await fetch(
    `/api/players?search=${encodeURIComponent(searchFilter)}&region=${riotRegion}`,
  );

  if (!response.ok)
    throw new Error(`Fetch failed with status: ${response.status}.`);

  const data = await response.json(); // eslint-disable-line
  return playerSchema.parse(data);
};

export default function SearchBar({ className }: SearchBarProps) {
  const [inputHasFocus, setInputHasFocus] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const debouncedSearchFilter = useDebounce(searchFilter, 250);

  const region = usePathname().split("/")[1];
  const router = useRouter();

  const wrapperRef = useClickAway<HTMLDivElement>(() => {
    setInputHasFocus(false);
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ["players", region, debouncedSearchFilter.toLowerCase()],
    queryFn: () => fetchPlayers(debouncedSearchFilter.toLowerCase(), region),
    enabled: !!debouncedSearchFilter && region !== "about",
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const inputHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchFilter(e.target.value);
    setInputHasFocus(true);
  };

  const captureSearch = (gameName: string, tagLine: string) => {
    posthog.capture("searched_player", {
      region: region,
      gameName: gameName,
      tagLine: tagLine,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    if (isPending || error || !data || data.players.length === 0) return; // eslint-disable-line

    const player = data.players[0];
    const url = `/${region}/${player.gameName}-${player.tagLine}`;
    router.push(url);

    setSearchFilter("");
    inputRef.current?.blur();

    captureSearch(player.gameName, player.tagLine);
    posthog.capture("searchbar_enter_search");
  };

  useEffect(() => {
    // Check if no search results and send analytics event if so
    if (
      data &&
      !isPending &&
      debouncedSearchFilter.length > 0 &&
      data.players.length === 0
    ) {
      posthog.capture("search_no_results", {
        region: region,
        searchFilter: debouncedSearchFilter,
      });
    }
  }, [data, isPending, debouncedSearchFilter, region]);

  return (
    <>
      <div className="relative">
        <div ref={wrapperRef}>
          <Input
            startIcon={Search}
            className={cn("w-96", className)}
            ref={inputRef}
            placeholder="Search players..."
            disabled={region === "about"} // FIXME: Temporary fix
            value={searchFilter}
            onChange={inputHandleChange}
            onClick={() => setInputHasFocus(true)}
            onFocus={() => {
              setInputHasFocus(true);
              posthog.capture("searchbar_focused");
            }}
            onKeyDown={handleKeyDown}
          />
          {inputHasFocus && searchFilter.length > 0 && (
            <div className="absolute top-10 z-[100] flex h-[50vh] w-full flex-col overflow-y-scroll rounded-sm bg-zinc-900 text-zinc-300 shadow-sm shadow-zinc-900 scrollbar scrollbar-track-zinc-800 scrollbar-thumb-zinc-900">
              {data && data.players.length > 0 && (
                <ol>
                  {data.players.map((player, index) => (
                    <li
                      className="flex w-full items-center justify-between px-1 hover:bg-zinc-800"
                      key={`${player.gameName}#${player.tagLine}`}
                    >
                      <Link
                        className="flex w-full items-center justify-between border-b border-zinc-800 p-1"
                        href={`/${region}/${player.gameName}-${player.tagLine}`}
                        onClick={() => {
                          setSearchFilter("");
                          captureSearch(player.gameName, player.tagLine);
                        }}
                      >
                        <section className="flex items-center">
                          <Image
                            className="pr-1"
                            alt="Profile Icon"
                            src={profileIconUrl(player.profileIconId)}
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
                                      src={getRankEmblem(
                                        player.rankTier as Tier,
                                      )}
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
                        </section>
                        {index == 0 && (
                          <Kbd
                            keys={"enter"}
                            className="rounded-md border border-zinc-300 p-1 text-center text-xs text-zinc-300"
                          >
                            Enter
                          </Kbd>
                        )}
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              {isPending && searchFilter.length > 0 && (
                <div className="flex items-center justify-center p-2">
                  <p className="font-semibold">Loading...</p>
                </div>
              )}
              {data && searchFilter.length > 0 && data.players.length === 0 && (
                <div className="flex items-center justify-center p-2">
                  <div className="flex w-3/4 flex-col items-center justify-center text-center">
                    <p className="font-semibold">No players found.</p>
                    <p className="text-sm font-light">
                      (Players without any dodges in master+ will not show up)
                    </p>
                  </div>
                </div>
              )}
              {error && searchFilter.length > 0 && (
                <div className="flex items-center justify-center p-2">
                  <p>Search error: {error.message}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
