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

/**
 * Searches for ICD-10 codes via server-side API.
 * Safe for both client and server (requires NEXT_PUBLIC_APP_URL for SSR).
 */
export async function searchIcd10(query: string): Promise<Icd10Code[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const response = await fetch(`${baseUrl}/api/clinical/search-icd10?q=${encodeURIComponent(query)}`);
  const { data } = await response.json();
  return data;
}

/**
 * Searches for CPT codes via server-side API.
 * Safe for both client and server (requires NEXT_PUBLIC_APP_URL for SSR).
 */
export async function searchCptCodes(query: string): Promise<CptCode[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const response = await fetch(`${baseUrl}/api/clinical/search-cpt?q=${encodeURIComponent(query)}`);
  const { data } = await response.json();
  return data;
}
