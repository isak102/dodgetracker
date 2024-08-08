"use client";

import Link from "next/link";
import posthog from "posthog-js";
import useDodgeTrackedEvent from "../../dodges/hooks/useDodgeTrackedEvent";

export interface ProfileLinkProps extends React.HTMLAttributes<HTMLDivElement> {
  gameName: string;
  tagLine: string;
  userRegion: string;
  riotRegion: string;
  profileLink: boolean;
  dodgeTime?: Date;
  clientServerTimeDiff?: number;
}

function captureEvent(eventName: string, href: string) {
  posthog.capture(eventName, { href });
}

export default function ProfileLink(props: ProfileLinkProps) {
  const dodgeTrackedEvent = useDodgeTrackedEvent();
  const link = `/${props.userRegion}/${props.gameName}-${props.tagLine}`;

  return (
    <Link
      onClick={(_e) => {
        captureEvent("profile_link_clicked", link);

        if (props.dodgeTime && props.clientServerTimeDiff) {
          dodgeTrackedEvent(
            props.gameName,
            props.tagLine,
            props.riotRegion,
            props.dodgeTime,
            props.clientServerTimeDiff,
          );
        }
      }}
      href={link}
      style={{
        pointerEvents: props.profileLink ? "auto" : "none",
      }}
    >
      {props.children}
    </Link>
  );
}
