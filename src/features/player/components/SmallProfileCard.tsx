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
      <div className="relative size-10 self-center md:size-12">
        <Image
          alt="Profile Icon"
          src={profileIconUrl(props.profileIconId)}
          quality={100}
          unoptimized
          layout="fill"
          style={{ objectFit: "contain" }}
        ></Image>
      </div>
      <section className="flex flex-col">
        <div className="flex flex-wrap break-all font-semibold underline-offset-2 group-hover:underline">
          <p>{props.gameName}</p>
          <p>#{props.tagLine}</p>
        </div>
        {props.showLolProsInfo &&
          props.lolProsName &&
          props.lolProsCountry &&
          props.lolProsPosition && (
            <section className="flex items-center gap-[2px] text-sm font-light">
              <PlayerFlag countryCode={props.lolProsCountry} height={28} />
              <PositionIcon position={props.lolProsPosition} size={23} />
              <p>{props.lolProsName}</p>
            </section>
          )}
      </section>
    </section>
  );
}
