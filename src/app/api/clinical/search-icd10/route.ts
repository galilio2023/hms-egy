import { NextResponse } from "next/server";
import { queryIcd10Locally } from "@/lib/utils/clinical-search-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  const results = queryIcd10Locally(query);

  return NextResponse.json(
    { data: results },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=60",
      },
    }
  );
}
