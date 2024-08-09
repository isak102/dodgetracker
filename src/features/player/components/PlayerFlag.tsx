import Image from "next/image";
import { countryFlagURL } from "../utils";

export default function PlayerFlag(props: { countryCode: string }) {
  const height = 20;
  const width = Math.floor(height * 1.5);

  return (
    <Image
      alt={`${props.countryCode} Flag`}
      src={countryFlagURL(props.countryCode)}
      quality={100}
      height={height}
      width={width}
    ></Image>
  );
}
