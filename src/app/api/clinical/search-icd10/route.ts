import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Fuse from "fuse.js";
import { Icd10Code } from "@/lib/utils/clinical-codes";

let icd10Cache: Icd10Code[] | null = null;
let fuseInstance: Fuse<Icd10Code> | null = null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ data: [] });
  }

  if (!icd10Cache) {
    const filePath = path.join(process.cwd(), "db/clinical-data/icd10-ar.json");
    const fileContent = await fs.readFile(filePath, "utf-8");
    icd10Cache = JSON.parse(fileContent);
    fuseInstance = new Fuse(icd10Cache!, {
      keys: ["code", "descriptionEn", "descriptionAr"],
      threshold: 0.3,
    });
  }

  const results = fuseInstance!.search(query).slice(0, 15).map(r => r.item);

  return NextResponse.json({ data: results });
}
