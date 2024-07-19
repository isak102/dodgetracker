import DodgeListWebSocket from "@/src/components/DodgeListWebSocket";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import PlayerCountAlert from "@/src/components/PlayerCountAlert";
import RegionPlayerCount from "@/src/components/RegionPlayerCount";
import { supportedUserRegions } from "@/src/regions";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import Notif from "./_components/Notif";

interface Props {
  params: {
    region: string;
  };
  searchParams: {
    page?: string;
  };
}

export default async function Region({ params, searchParams }: Props) {
  const pageNumber = parseInt(searchParams.page ?? "1", 10);
  if (supportedUserRegions.has(params.region) === false) {
    redirect("/euw");
  }

  // Key for suspense to re-fetch data when the region or page number changes
  const suspenseKey = `${params.region}-${pageNumber}`;

  return (
    <>
      <div className="flex w-full justify-end">
        <div className="border-b border-l border-zinc-900 px-2 text-sm font-light">
          <Suspense key={suspenseKey} fallback={<p>Loading player count...</p>}>
            <ErrorBoundary fallback={<p>Error loading player count.</p>}>
              <RegionPlayerCount userRegion={params.region} />
            </ErrorBoundary>
          </Suspense>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center">
            <header className="m-2 text-center text-2xl font-bold md:text-4xl">
              Dodges
            </header>
          </div>
          <Suspense key={suspenseKey}>
            <PlayerCountAlert userRegion={params.region} />
          </Suspense>
        </div>
      </div>
      <Suspense
        key={suspenseKey}
        fallback={
          <div className="flex h-[75vh] items-center justify-center">
            <LoadingSpinner />
          </div>
        }
      >
        <div className="mx-auto lg:w-3/4">
          <Notif />
          <ErrorBoundary
            fallback={
              <div className="flex w-full items-center justify-center">
                <p className="p-2 text-xl text-red-400">
                  Error loading dodges. The issue will be taken care of as soon
                  as possible.
                </p>
              </div>
            }
          >
            <DodgeListWebSocket userRegion={params.region}></DodgeListWebSocket>
          </ErrorBoundary>
        </div>
      </Suspense>
    </>
  );
}
