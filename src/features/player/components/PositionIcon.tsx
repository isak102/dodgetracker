import { type dodgeSchema } from "@/src/lib/types";
import Image from "next/image";
import { type z } from "zod";
import { positionIconURL } from "../utils";

export default function PositionIcon(props: {
  position: Exclude<z.infer<typeof dodgeSchema.shape.lolProsPosition>, null>;
}) {
  return (
    <Image
      alt={`${props.position}`}
      src={positionIconURL(props.position)}
      quality={100}
      width={23}
      height={23}
    ></Image>
  );
}
