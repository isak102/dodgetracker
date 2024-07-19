import Leaderboard from "@/src/components/Leaderboard";
import LeaderboardFilters from "@/src/components/LeaderboardFilters";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { LeaderboardSearchParamsSchema } from "@/src/lib/types";
import { supportedUserRegions } from "@/src/regions";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type Props = {
  params: {
    region: string;
  };
  searchParams: {
    page?: string;
    season?: string;
  };
};

// TODO: add page number ?
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Leaderboard - ${params.region.toUpperCase()}`,
    description: `Leaderboard of players with the most dodges in master+ in League of Legends`,
  };
}

export default async function page({ params, searchParams }: Props) {
  const userRegion = (function () {
    if (!supportedUserRegions.has(params.region)) {
      // TODO: show error message instead ?
      notFound();
    }
    return params.region;
  })();

  const validatedSearchParams =
    LeaderboardSearchParamsSchema.parse(searchParams);

  return (
    <section className="p-2">
      <h2 className="flex items-center justify-center text-xl font-medium md:text-2xl">
        {userRegion.toUpperCase()} Dodge Leaderboard
      </h2>
      <div className="mx-auto flex border-b border-zinc-900 p-2 lg:w-3/4">
        <LeaderboardFilters />
      </div>
      <Suspense
        key={`${userRegion}-${validatedSearchParams.page}-${validatedSearchParams.season}`}
        fallback={
          <div className="flex h-[75vh] items-center justify-center">
            <LoadingSpinner />
          </div>
        }
      >
        <div className="mx-auto lg:w-3/4">
          <Leaderboard
            userRegion={userRegion}
            pageNumber={validatedSearchParams.page}
            seasonValue={validatedSearchParams.season}
          />
        </div>
      </Suspense>
    </section>
  );
}
