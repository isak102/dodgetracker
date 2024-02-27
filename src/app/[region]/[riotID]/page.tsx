import DodgeList from "@/src/components/DodgeList";
import DodgeStats from "@/src/components/DodgeStats";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import ProfileCard from "@/src/components/ProfileCard";
import { supportedUserRegions } from "@/src/regions";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export default async function Summoner({
    params,
}: {
    params: {
        region: string;
        riotID: string;
    };
}) {
    const [gameName, tagLine] = (function () {
        if (params.riotID.indexOf("-") === -1) {
            return [params.riotID, ""];
        }

        const decodedString = decodeURIComponent(params.riotID);
        const lastDashIdx = decodedString.lastIndexOf("-");
        return [
            decodedString.substring(0, lastDashIdx),
            decodedString.substring(lastDashIdx + 1),
        ];
    })();

    const region = (function () {
        if (!supportedUserRegions.has(params.region)) {
            // TODO: show error message instead ?
            notFound();
        }
        return params.region;
    })();

    return (
        <main>
            <section className="flex min-h-[20vh] flex-wrap items-center justify-center border-b-4 border-zinc-900 bg-zinc-600">
                <Suspense
                    fallback={
                        <div className="size-16">
                            <LoadingSpinner />
                        </div>
                    }
                >
                    <div className="m-2 md:mx-14">
                        <ProfileCard gameName={gameName} tagLine={tagLine} />
                    </div>
                    <div className="m-2 md:mx-14">
                        <DodgeStats gameName={gameName} tagLine={tagLine} />
                    </div>
                </Suspense>
            </section>

            <Suspense
                fallback={
                    <div className="flex h-[70vh] items-center justify-center">
                        <div className="size-16">
                            <LoadingSpinner />
                        </div>
                    </div>
                }
            >
                <div className="mx-auto lg:w-5/6">
                    <DodgeList
                        userRegion={region}
                        pageNumber={1}
                        gameName={gameName}
                        tagLine={tagLine}
                        statSiteButtons={false}
                        profileLink={false}
                    />
                </div>
            </Suspense>
        </main>
    );
}
