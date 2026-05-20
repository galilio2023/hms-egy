import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Fuse from "fuse.js";

let cptCache: any[] | null = null;
let fuseInstance: Fuse<any> | null = null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ data: [] });
  }

  if (!cptCache) {
    const filePath = path.join(process.cwd(), "db/clinical-data/cpt-egypt.json");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    cptCache = JSON.parse(fileContent);
    fuseInstance = new Fuse(cptCache!, {
      keys: ["code", "descriptionEn", "descriptionAr"],
      threshold: 0.3,
    });
  }

  const results = fuseInstance!.search(query).slice(0, 15).map(r => r.item);

  return NextResponse.json({ data: results });
}
