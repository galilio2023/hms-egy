import { NextRequest, NextResponse } from "next/server";
import { queryCptLocally } from "@/lib/utils/clinical-search-engine";
import { searchLimiter } from "@/lib/utils/ratelimit";

export async function GET(request: NextRequest) {
  // Rate limiting (IP-based)
  if (searchLimiter) {
    try {
      const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";
      const { success } = await searchLimiter.limit(ip);
      if (!success) {
        return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
      }
    } catch (error) {
      console.error("[RATE_LIMITER_ERROR] Failing open:", error);
    }
  }

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
