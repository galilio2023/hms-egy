import { cache } from "react";
import { db } from "./index";
import { hospitals } from "@db/schema/core";
import { eq } from "drizzle-orm";

/**
 * Retrieves hospital tenant details by URL slug.
 * Wrapped in React's cache to deduplicate database queries across a single request lifecycle
 * (e.g. eliminating redundant fetches between generateMetadata and the main Page component).
 */
export const getHospitalBySlug = cache(async (slug: string) => {
  const [hospital] = await db
    .select({
      id: hospitals.id,
      nameAr: hospitals.nameAr,
      nameEn: hospitals.nameEn,
      slug: hospitals.slug,
    })
    .from(hospitals)
    .where(eq(hospitals.slug, slug))
    .limit(1);
    
  return hospital || null;
});
