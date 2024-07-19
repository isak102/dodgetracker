import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type Tier } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeDiffString(utcTime: Date): string {
  const timeDiff = Date.now() - new Date(utcTime).getTime();

  const diffInSeconds: number = timeDiff / 1000;
  const diffInMinutes: number = diffInSeconds / 60;
  const diffInHours: number = diffInMinutes / 60;
  const diffInDays: number = diffInHours / 24;

  if (diffInDays > 1) {
    const remainingHours = Math.floor(diffInHours % 24);
    return remainingHours === 0
      ? `${Math.floor(diffInDays)}d ago`
      : `${Math.floor(diffInDays)}d ${Math.floor(remainingHours)}h ago`;
  } else if (diffInHours > 1) {
    const remainingMinutes = Math.floor(diffInMinutes % 60);
    return remainingMinutes === 0
      ? `${Math.floor(diffInHours)}h ago`
      : `${Math.floor(diffInHours)}h ${remainingMinutes}min ago`;
  } else if (diffInMinutes > 1) {
    const remainingSeconds = diffInSeconds % 60;
    return diffInMinutes < 5
      ? `${Math.floor(diffInMinutes)}min ${Math.floor(remainingSeconds)}s ago`
      : `${Math.floor(diffInMinutes)}min ago`;
  } else {
    return `${Math.floor(diffInSeconds)}s ago`;
  }
}

export function decodeRiotIdURIComponent(
  riotIdURIComponent: string,
): [string, string] {
  if (riotIdURIComponent.indexOf("-") === -1) {
    return [riotIdURIComponent, ""];
  }

  const decodedString = decodeURIComponent(riotIdURIComponent);
  const lastDashIdx = decodedString.lastIndexOf("-");
  return [
    decodedString.substring(0, lastDashIdx),
    decodedString.substring(lastDashIdx + 1),
  ];
}

export function getRankEmblem(rankTier: Tier) {
  const rankTierStr = rankTier.toLowerCase();
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${rankTierStr}.svg`;
}

export function isWithinDays(
  oldDate: Date,
  now: Date,
  dayLimit: number,
): boolean {
  const differenceInMillis = Math.abs(now.getTime() - oldDate.getTime());
  const differenceInDays = differenceInMillis / (1000 * 60 * 60 * 24);
  return differenceInDays < dayLimit;
}

export function profileIconUrl(profileIconID: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${profileIconID}.jpg`;
}

export function secondsBetween(from: Date, to: Date): number {
  return Math.abs(from.getTime() - to.getTime()) / 1000;
}
