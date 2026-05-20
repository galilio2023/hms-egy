import { NextResponse } from "next/server";
import Fuse from "fuse.js";
import cptData from "@db/clinical-data/cpt-egypt.json";
import { CptCode } from "@/lib/utils/clinical-codes";

let fuseInstance: Fuse<CptCode> | null = null;

function getFuse() {
  if (!fuseInstance) {
    fuseInstance = new Fuse(cptData as CptCode[], {
      keys: ["nameEn", "nameAr", "code"],
      threshold: 0.3,
    });
  }
  return fuseInstance;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Truncate to reasonable length to prevent DoS (Fuse.js is CPU intensive)
  const sanitizedQuery = query.substring(0, 64).trim();
  const results = getFuse().search(sanitizedQuery).slice(0, 15).map(r => r.item);

  return NextResponse.json({ data: results });
}
