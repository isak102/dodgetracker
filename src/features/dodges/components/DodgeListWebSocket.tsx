"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { z } from "zod";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { dodgeSchema, regionUpdateScema } from "../../../lib/types";
import { userRegionToRiotRegion } from "../../../regions";
import DodgeList from "./DodgeList";
import LastUpdate from "./LastUpdate";

// @ts-expect-error: Overriding toJSON method for BigInt
BigInt.prototype.toJSON = function () {
  return this.toString();
};

type DodgeListWebSocketProps = {
  userRegion: string;
};

const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL!;

const dodgeMessageSchema = z.object({
  type: z.literal("dodge"),
  data: dodgeSchema,
});
const regionUpdateMessage = z.object({
  type: z.literal("region_update"),
  serverTime: z.string().datetime({ offset: true }).pipe(z.coerce.date()),
  data: regionUpdateScema,
});
const websocketMessageSchema = z.discriminatedUnion("type", [
  regionUpdateMessage,
  dodgeMessageSchema,
]);

const dodgesApiResponseSchema = z.object({
  dodges: z.array(dodgeSchema),
  serverTime: z.string().datetime({ offset: true }).pipe(z.coerce.date()),
});
type DodgesApiResponse = z.infer<typeof dodgesApiResponseSchema>;

function calculateTimeDifference(serverTime: Date) {
  return serverTime.getTime() - Date.now();
}

async function fetchDodges(riotRegion: string) {
  const response = await fetch(`/api/dodges?region=${riotRegion}`);
  if (!response.ok)
    throw new Error(`Fetch failed with status: ${response.status}.`);

  const data = await response.json(); // eslint-disable-line
  return dodgesApiResponseSchema.parse(data);
}

export default function DodgeListWebSocket(props: DodgeListWebSocketProps) {
  const [clientServerTimeDiff, setClientServerTimeDiff] = useState(0);
  const riotRegion = userRegionToRiotRegion(props.userRegion);
  const queryKey = useMemo(() => ["dodges", riotRegion], [riotRegion]);
  const [lastUpdate, setLastUpdate] = useState<{
    lastUpdateTime: Date;
    serverTime: Date;
  } | null>(null);

  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchDodges(riotRegion),
    staleTime: Infinity,
  });

  function invalidateQuery() {
    queryClient
      .invalidateQueries({ queryKey, exact: true })
      .catch(console.error);
  }

  const { lastJsonMessage, readyState } = useWebSocket(
    `${websocketUrl}/?region=${riotRegion}`,
    {
      onOpen: () => {
        invalidateQuery();
      },
      onClose: () => {
        invalidateQuery();
      },
      onError: (event) => {
        console.error("WebSocket error", event);
      },
      shouldReconnect: (_) => true,
    },
  );

  useEffect(() => {
    if (data?.serverTime) {
      setClientServerTimeDiff(calculateTimeDifference(data.serverTime));
    }
  }, [data?.serverTime]);

  useEffect(() => {
    if (lastJsonMessage !== null) {
      try {
        const message = websocketMessageSchema.parse(lastJsonMessage);

        if (message.type === "region_update") {
          setLastUpdate({
            lastUpdateTime: message.data.update_time,
            serverTime: message.serverTime,
          });
          queryClient.setQueryData(queryKey, (oldData: DodgesApiResponse) => {
            return {
              dodges: oldData.dodges,
              serverTime: message.serverTime,
            };
          });
        } else if (message.type === "dodge") {
          queryClient.setQueryData(queryKey, (oldData: DodgesApiResponse) => {
            return {
              dodges: [message.data, ...oldData.dodges],
              serverTime: oldData.serverTime,
            };
          });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    }
  }, [lastJsonMessage, queryClient, queryKey]);

  if (!data && isFetching) {
    return (
      <div className="flex h-[75vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  if (!data) return;
  return (
    <>
      <div className="flex min-h-8 items-center justify-center">
        {readyState !== ReadyState.OPEN && (
          <div>Connecting to real time updates...</div>
        )}
        {readyState === ReadyState.OPEN && lastUpdate && (
          <LastUpdate
            lastUpdatedAt={lastUpdate.lastUpdateTime}
            clientServerTimeDiff={clientServerTimeDiff}
          />
        )}
      </div>
      <DodgeList
        showLolProsInfo={true}
        dodges={data.dodges}
        userRegion={props.userRegion}
        profileLink={true}
        statSiteButtons={true}
        clientServerTimeDiff={clientServerTimeDiff}
      />
    </>
  );
}
