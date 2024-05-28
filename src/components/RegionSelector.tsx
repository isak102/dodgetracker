"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { useTransition } from "react";
import { cn } from "../lib/utils";
import { supportedUserRegions } from "../regions";

interface RegionSelectorProps extends React.HTMLAttributes<HTMLSelectElement> {}

export default function RegionSelector({ className }: RegionSelectorProps) {
  const pathname = usePathname();
  const router = useRouter();
  const userRegion = pathname.split("/")[1];
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    startTransition(() => {
      const path = pathname.split("/").slice(2)[0];
      if (["leaderboard", "about"].includes(path)) {
        router.push(`/${e.target.value}/${path}`);
      } else {
        router.push(`/${e.target.value}`);
      }
    });
  };

  return (
    <>
      <select
        className={cn(
          "ml-2 rounded-md bg-zinc-900 text-sm md:text-base",
          className,
        )}
        defaultValue={userRegion}
        onChange={handleChange}
        disabled={isPending}
      >
        {Array.from(supportedUserRegions).map((region) => (
          <option key={region} value={region}>
            {region.toUpperCase()}
          </option>
        ))}
      </select>
    </>
  );
}
