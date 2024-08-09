import { type dodgeSchema } from "@/src/lib/types";
import { cn, profileIconUrl } from "@/src/lib/utils";
import Image from "next/image";
import { type z } from "zod";
import PlayerFlag from "./PlayerFlag";
import PositionIcon from "./PositionIcon";

export default function SmallProfileCard(props: {
  gameName: string;
  tagLine: string;
  profileIconId: number;
  lolProsSlug: string | null;
  lolProsName: string | null;
  lolProsCountry: string | null;
  lolProsPosition: z.infer<typeof dodgeSchema.shape.lolProsPosition>;
  showLolProsInfo: boolean;
  userRegion: string;
  profileLink: boolean;
  scale?: boolean;
}) {
  return (
    <section
      className={cn(
        "group mr-2 flex origin-right transform items-center justify-center gap-2 transition-transform sm:justify-start",
        {
          "md:hover:scale-105": props.scale,
        },
      )}
    >
      <Image
        alt="Profile Icon"
        src={profileIconUrl(props.profileIconId)}
        height={48}
        width={48}
        quality={100}
      ></Image>
      <section className="flex flex-col">
        <div className="flex flex-wrap break-all font-semibold underline-offset-2 group-hover:underline">
          <p>{props.gameName}</p>
          <p>#{props.tagLine}</p>
        </div>
        {props.showLolProsInfo &&
          props.lolProsName &&
          props.lolProsCountry &&
          props.lolProsPosition && (
            <section className="flex flex-wrap items-center gap-[2px] text-sm font-light">
              <PlayerFlag countryCode={props.lolProsCountry} />
              <PositionIcon position={props.lolProsPosition} />
              <p>{props.lolProsName}</p>
            </section>
          )}
      </section>
    </section>
  );
}
