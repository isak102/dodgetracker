"use client";

import posthog from "posthog-js";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import { StatSite, getDeeplolUrl, getOpggUrl } from "../../../statSites";
import useDodgeTrackedEvent from "../../dodges/hooks/useDodgeTrackedEvent";

export interface StatSiteButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  statSite: StatSite;
  riotRegion: string;
  gameName: string;
  tagLine: string;
  lolProsSlug?: string; /// If the stat site is lolPros, then this is the slug
  dodgeTime?: Date;
  clientServerTimeDiff?: number;
}

export default function StatSiteButton({
  className,
  ...props
}: StatSiteButtonProps) {
  const dodgeTrackedEvent = useDodgeTrackedEvent();

  const url = (function () {
    switch (props.statSite) {
      case StatSite.OPGG:
        return getOpggUrl(props.riotRegion, props.gameName, props.tagLine);
      case StatSite.DEEPLOL:
        return getDeeplolUrl(props.riotRegion, props.gameName, props.tagLine);
      case StatSite.LOLPROS:
        return `https://lolpros.gg/player/${props.lolProsSlug}`;
    }
  })();

  const handleClick = () => {
    posthog.capture("statsite_button_clicked", {
      statSite: props.statSite,
      gameName: props.gameName,
      tagLine: props.tagLine,
      region: props.riotRegion,
      siteUrl: url,
    });

    if (props.dodgeTime && props.clientServerTimeDiff) {
      dodgeTrackedEvent(
        props.gameName,
        props.tagLine,
        props.riotRegion,
        props.dodgeTime,
        props.clientServerTimeDiff,
      );
    }
  };

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" tabIndex={-1}>
      <Button
        variant={"secondary"}
        className={cn(
          "h-auto px-2 py-1 align-middle text-xs font-light shadow-sm",
          {
            "dark:bg-yellow-800 dark:shadow-zinc-800 dark:enabled:hover:bg-yellow-800/80":
              props.statSite === StatSite.LOLPROS,
          },
          className,
        )}
        onClick={handleClick}
      >
        {props.statSite}
      </Button>
    </a>
  );
}
