import posthog from "posthog-js";
import { useLocalStorage } from "usehooks-ts";

function trackedDodgeKey(
  gameName: string,
  tagLine: string,
  riotRegion: string,
  timestampISO: string,
) {
  return `${gameName}#${tagLine}-${riotRegion}_${timestampISO}`;
}

// The time limit for it to be considered as a tracked dodge
const TIME_LIMIT = 30;

export default function useDodgeTrackedEvent() {
  const [trackedDodges, setTrackedDodges] = useLocalStorage(
    "trackedDodges",
    new Set<string>(),
    {
      serializer: (value) => JSON.stringify(Array.from(value)),
      deserializer: (value) => new Set(JSON.parse(value) as string[]),
    },
  );

  function dodgeTrackedEvent(
    gameName: string,
    tagLine: string,
    riotRegion: string,
    dodgeTime: Date,
    clientServerTimeDiff: number,
  ) {
    if (
      (Date.now() - dodgeTime.getTime() + clientServerTimeDiff) / 1000 >
      TIME_LIMIT
    ) {
      // Dodge happened more than too long ago so it is not considered as a tracked dodge
      return;
    }

    const newTrackedDodge = trackedDodgeKey(
      gameName,
      tagLine,
      riotRegion,
      dodgeTime.toISOString(),
    );

    if (trackedDodges.has(newTrackedDodge)) {
      // Dodge has already been tracked by this user so we don't need to register analytics event
      return;
    }

    setTrackedDodges(new Set(trackedDodges).add(newTrackedDodge));
    posthog.capture("dodge_tracked", {
      gameName,
      tagLine,
      riotRegion,
    });
  }

  return dodgeTrackedEvent;
}
