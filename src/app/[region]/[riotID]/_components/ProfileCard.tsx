import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { type Tier } from "@/src/lib/types";
import { getRankEmblem, isWithinDays, profileIconUrl } from "@/src/lib/utils";
import { InfoIcon } from "lucide-react";
import Image from "next/image";

export default async function ProfileCard(props: {
  profileIconId: number;
  summonerLevel: number;
  gameName: string;
  tagLine: string;
  rankTier: Tier;
  currentLp: number;
  lastUpdateTime: Date;
}) {
  // TODO: show more information if summoner not found
  const recentlyUpdated = isWithinDays(props.lastUpdateTime, new Date(), 3);

  return (
    <section>
      <section className="flex">
        <div className="relative size-20 md:size-28">
          <Image
            src={profileIconUrl(props.profileIconId)}
            alt="Profile Icon"
            className="rounded-md"
            quality={100}
            fill
            unoptimized
          />
          <div className="absolute bottom-0 flex w-full translate-y-1/3 items-center justify-center">
            <div className="rounded-xl bg-zinc-900 bg-opacity-90 p-1 px-2 text-[9px] md:text-xs">
              {props.summonerLevel}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center pl-2">
          <div className="text-lg font-bold md:text-xl">
            {props.gameName}#{props.tagLine}
          </div>
          <div className="flex items-center justify-center text-sm md:text-base">
            {recentlyUpdated ? (
              <>
                <div className="relative mr-2 size-8 md:size-12">
                  <Image
                    src={getRankEmblem(props.rankTier)}
                    alt={props.rankTier}
                    fill
                    quality={100}
                    unoptimized
                  />
                </div>
                {props.currentLp}LP
              </>
            ) : (
              <Popover>
                <PopoverTrigger className="flex items-center gap-1">
                  <InfoIcon className="md:size-6" />
                  <p>Demoted</p>
                </PopoverTrigger>
                <PopoverContent className="border-zinc-700 bg-zinc-800 text-white">
                  <h1 className="font-semibold">Demoted</h1>
                  <p className="text-sm">
                    This player has demoted from master. The account is kept in
                    the database because it has previous dodges in master+.
                  </p>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
