/**
 * HMS Egypt - Clinical Code Search Utility (Client Proxy)
 */

export interface Icd10Code {
  code: string;
  descriptionEn: string;
  descriptionAr: string;
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
 * Searches for ICD-10 codes via server-side API.
 */
export async function searchIcd10(query: string): Promise<Icd10Code[]> {
  const response = await fetch(`/api/clinical/search-icd10?q=${encodeURIComponent(query)}`);
  const { data } = await response.json();
  return data;
}

/**
 * Searches for CPT codes via server-side API.
 */
export async function searchCptCodes(query: string): Promise<CptCode[]> {
  const response = await fetch(`/api/clinical/search-cpt?q=${encodeURIComponent(query)}`);
  const { data } = await response.json();
  return data;
}
