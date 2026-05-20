import { NextResponse } from "next/server";
import Fuse from "fuse.js";
import cptData from "@db/clinical-data/cpt-egypt.json";
import { CptCode } from "@/lib/utils/clinical-codes";

const fuseInstance = new Fuse(cptData as CptCode[], {
  keys: ["nameEn", "nameAr", "code"],
  threshold: 0.3,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ data: [] });
  }

  const results = fuseInstance.search(query).slice(0, 15).map(r => r.item);

  return NextResponse.json({ data: results });
}
