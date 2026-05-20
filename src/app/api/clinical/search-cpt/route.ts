import { NextResponse } from "next/server";
import { queryCptLocally } from "@/lib/utils/clinical-search-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  const results = queryCptLocally(query);

  return NextResponse.json(
    { data: results },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=60",
      },
    }
  );
}
