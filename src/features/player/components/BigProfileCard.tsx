import RankInfo from "@/src/components/RankInfo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { type Tier, type dodgeSchema } from "@/src/lib/types";
import { cn, isWithinDays, profileIconUrl } from "@/src/lib/utils";
import { InfoIcon } from "lucide-react";
import Image from "next/image";
import { type z } from "zod";
import PlayerFlag from "./PlayerFlag";
import PositionIcon from "./PositionIcon";

export default async function BigProfileCard(props: {
  profileIconId: number;
  summonerLevel: number;
  gameName: string;
  tagLine: string;
  lolProsSlug: string | null;
  lolProsName: string | null;
  lolProsCountry: string | null;
  lolProsPosition: z.infer<typeof dodgeSchema.shape.lolProsPosition>;
  rankTier: Tier;
  currentLp: number;
  lastUpdateTime: Date;
}) {
  // TODO: show more information if summoner not found
  const recentlyUpdated = isWithinDays(props.lastUpdateTime, new Date(), 3);

  const hasLolProsInfo =
    props.lolProsSlug &&
    props.lolProsName &&
    props.lolProsPosition &&
    props.lolProsCountry;

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
        <div
          className={cn("flex flex-col pl-2", {
            "justify-between": hasLolProsInfo,
            "justify-center": !hasLolProsInfo,
          })}
        >
          <div>
            <p className="text-lg font-bold md:text-xl">
              {props.gameName}#{props.tagLine}
            </p>
            {hasLolProsInfo && (
              <section className="flex items-center gap-[2px] text-sm font-light">
                <PlayerFlag countryCode={props.lolProsCountry!} />
                <PositionIcon position={props.lolProsPosition!} />
                <p>{props.lolProsName}</p>
              </section>
            )}
          </div>
          <div className="flex text-sm md:text-base">
            {recentlyUpdated ? (
              <>
                <RankInfo
                  rankTier={props.rankTier}
                  lp={props.currentLp}
                  disableCol
                />
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
