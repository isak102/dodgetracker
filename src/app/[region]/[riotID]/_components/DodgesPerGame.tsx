import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { getDodgesPerGame } from "@/src/data";

type DodgesPerGameProps = {
  gameName: string;
  tagLine: string;
  userRegion?: string;
};

export default async function DodgesPerGame({
  gameName,
  tagLine,
  userRegion,
}: DodgesPerGameProps) {
  const dodgesPerGame = await getDodgesPerGame(gameName, tagLine);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dodges per game</CardTitle>
        <CardDescription>Only games in master+ are counted</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card Content</p>
      </CardContent>
    </Card>
  );
}
