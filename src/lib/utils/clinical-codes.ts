/**
 * HMS Egypt - Clinical Code Search Utility (Client Proxy)
 *
 * Server-side: dynamically imports the heavy Fuse.js search engine to avoid
 * bundling JSON datasets and fuse.js into the client-side JavaScript.
 * Client-side: uses lightweight fetch() calls to the API routes.
 */

export interface Icd10Code {
  code: string;
  nameEn: string;
  nameAr: string;
  category: string;
}

export interface CptCode {
  code: string;
  descriptionEn: string;
  descriptionAr: string;
  category: string;
  egyptInsurancePrice?: number;
}

/**
 * Searches for ICD-10 codes.
 * Uses local engine if server-side to avoid HTTP loopback; uses API if client-side.
 */
export async function searchIcd10(query: string): Promise<Icd10Code[]> {
  if (typeof window === "undefined") {
    // Dynamic import keeps fuse.js + JSON datasets out of the client bundle
    const { queryIcd10Locally } = await import("./clinical-search-engine");
    return queryIcd10Locally(query);
  }

  const response = await fetch(`/api/clinical/search-icd10?q=${encodeURIComponent(query)}`);
  const { data } = await response.json();
  return data;
}

/**
 * Searches for CPT codes.
 * Uses local engine if server-side to avoid HTTP loopback; uses API if client-side.
 */
export async function searchCptCodes(query: string): Promise<CptCode[]> {
  if (typeof window === "undefined") {
    // Dynamic import keeps fuse.js + JSON datasets out of the client bundle
    const { queryCptLocally } = await import("./clinical-search-engine");
    return queryCptLocally(query);
  }

  const response = await fetch(`/api/clinical/search-cpt?q=${encodeURIComponent(query)}`);
  const { data } = await response.json();
  return data;
}
