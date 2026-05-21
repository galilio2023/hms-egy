import { NextRequest, NextResponse } from "next/server";
import { queryIcd10Locally } from "@/lib/utils/clinical-search-engine";
import { searchLimiter } from "@/lib/utils/ratelimit";

interface RequestWithIp extends NextRequest {
  ip?: string;
}

export async function GET(request: NextRequest) {
  // Rate limiting (IP-based)
  if (searchLimiter) {
    const ip = (request as RequestWithIp).ip ?? request.headers.get("x-real-ip") ?? "127.0.0.1";
    const { success } = await searchLimiter.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    }
  }

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
