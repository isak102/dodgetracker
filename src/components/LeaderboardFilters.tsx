"use client";

import { useSearchParams } from "next/navigation";
import { useQueryState } from "nuqs";
import posthog from "posthog-js";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { seasons } from "../seasons";
import { LeaderboardSearchParamsSchema } from "../types";

export default function LeaderboardFilters() {
  const [_, startTransition] = useTransition();
  const [season, setSeason] = useQueryState("season", { startTransition });
  const [page, setPage] = useQueryState("page", { startTransition });

  const validatedSearchParams = LeaderboardSearchParamsSchema.parse(
    Object.fromEntries(useSearchParams()),
  );

  const onSeasonChange = (value: string) => {
    setSeason(value);
    setPage("1");
    posthog.capture("leaderboard_filters_season_change", { season: value });
  };

  return (
    <>
      {
        <Select
          defaultValue={validatedSearchParams.season}
          onValueChange={onSeasonChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Season" />
          </SelectTrigger>
          <SelectContent
            ref={(ref) =>
              // Temporary workaround from https://github.com/shadcn-ui/ui/issues/1220
              // Radix UI issue https://github.com/radix-ui/primitives/pull/2403
              // Credits to https://github.com/citizenofjustice/ocean-goods/pull/24/files
              ref?.addEventListener("touchend", (e) => e.preventDefault())
            }
          >
            <SelectGroup>
              {seasons.map((season) => (
                <SelectItem key={season.value} value={season.value}>
                  {season.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      }
    </>
  );
}
