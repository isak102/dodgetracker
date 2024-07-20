import { getDodges } from "@/src/data";
import "json-bigint-patch";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const region = searchParams.get("region");

  if (!region) {
    return Response.json(
      {},
      { status: 400, statusText: "Missing query parameter `region`" },
    );
  }

  const dodges = await getDodges(region, 100, 1);

  return Response.json({ dodges });
}
