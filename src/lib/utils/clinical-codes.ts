/**
 * HMS Egypt - Clinical Code Search Utility (Client Proxy)
 */

export interface Icd10Code {
  code: string;
  nameEn: string;
  nameAr: string;
  category: string;
}

export interface CptCode {
  code: string;
  nameEn: string;
  nameAr: string;
  category: string;
  egyptInsurancePrice?: number;
}

import { queryIcd10Locally, queryCptLocally } from "./clinical-search-engine";

/**
 * Searches for ICD-10 codes.
 * Uses local engine if server-side to avoid HTTP loopback; uses API if client-side.
 */
export async function searchIcd10(query: string): Promise<Icd10Code[]> {
  if (typeof window === "undefined") {
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
    return queryCptLocally(query);
  }

  const response = await fetch(`/api/clinical/search-cpt?q=${encodeURIComponent(query)}`);
  const { data } = await response.json();
  return data;
}
