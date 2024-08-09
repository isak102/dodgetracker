import Image from "next/image";
import { type Tier } from "../lib/types";
import { cn, getRankEmblem } from "../lib/utils";

export default function RankInfo(props: {
  rankTier: Tier;
  lp: number;
  disableCol?: boolean;
}) {
  return (
    <>
      <section
        className={cn(
          "flex flex-col items-center justify-center gap-1 text-sm lg:flex-row lg:justify-start lg:text-base",
          {
            "flex-row": props.disableCol,
          },
        )}
      >
        <Image
          src={getRankEmblem(props.rankTier)}
          alt={props.rankTier}
          height={40}
          width={40}
          quality={100}
        />
        <p className="text-nowrap">{props.lp} LP</p>
      </section>
    </>
  );
}
