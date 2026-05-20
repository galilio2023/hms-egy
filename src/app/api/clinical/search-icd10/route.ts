import { NextResponse } from "next/server";
import Fuse from "fuse.js";
import icd10Data from "@db/clinical-data/icd10-ar.json";
import { Icd10Code } from "@/lib/utils/clinical-codes";

const fuseInstance = new Fuse(icd10Data as Icd10Code[], {
  keys: ["nameEn", "nameAr", "code"],
  threshold: 0.3,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Truncate to reasonable length to prevent DoS (Fuse.js is CPU intensive)
  const sanitizedQuery = query.substring(0, 64).trim();
  const results = fuseInstance.search(sanitizedQuery).slice(0, 15).map(r => r.item);

  return NextResponse.json({ data: results });
}
