import Fuse from 'fuse.js';

/**
 * HMS Egypt Clinical Coding Utility
 * Handles ICD-10, LOINC, and CPT codes with Arabic support.
 */

interface Icd10Code {
  code: string;
  descriptionEn: string;
  descriptionAr: string;
  category: string;
}

interface LoincCode {
  loincCode: string;
  longCommonName: string;
  arabicName: string;
  component: string;
  system: string;
  scaleType: string;
}

interface CptCode {
  code: string;
  descriptionEn: string;
  descriptionAr: string;
  category: string;
  egyptInsurancePrice: number;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'mild' | 'moderate' | 'severe';
  mechanismEn: string;
  mechanismAr: string;
  clinicalEffectEn: string;
  clinicalEffectAr: string;
  managementAr: string;
  category: string;
}

let icd10Cache: Icd10Code[] | null = null;
let loincCache: LoincCode[] | null = null;
let cptCache: CptCode[] | null = null;
let drugInteractionCache: DrugInteraction[] | null = null;

let icd10Fuse: Fuse<Icd10Code> | null = null;
let cptFuse: Fuse<CptCode> | null = null;

/**
 * Loads ICD-10 codes from the local JSON file.
 * Memoizes the result.
 */
export async function loadIcd10Codes(): Promise<Icd10Code[]> {
  if (icd10Cache) return icd10Cache;
  
  try {
    const response = await fetch('/db/clinical-data/icd10-ar.json');
    if (!response.ok) throw new Error('Failed to load ICD-10 codes');
    icd10Cache = await response.json();
    return icd10Cache || [];
  } catch (error) {
    console.error('Error loading ICD-10 codes:', error);
    return [];
  }
}

/**
 * Fuzzy search for ICD-10 codes using English or Arabic descriptions/codes.
 */
export async function searchIcd10(query: string, limit: number = 20): Promise<Icd10Code[]> {
  const codes = await loadIcd10Codes();
  if (!query) return codes.slice(0, limit);

  if (!icd10Fuse) {
    icd10Fuse = new Fuse(codes, {
      keys: ['code', 'descriptionEn', 'descriptionAr'],
      threshold: 0.3,
    });
  }

  return icd10Fuse.search(query, { limit }).map(result => result.item);
}

/**
 * Loads LOINC codes from the local JSON file.
 */
export async function loadLoincCodes(): Promise<LoincCode[]> {
  if (loincCache) return loincCache;
  
  try {
    const response = await fetch('/db/clinical-data/loinc-common.json');
    if (!response.ok) throw new Error('Failed to load LOINC codes');
    loincCache = await response.json();
    return loincCache || [];
  } catch (error) {
    console.error('Error loading LOINC codes:', error);
    return [];
  }
}

/**
 * Lookup helper for LOINC codes by test name.
 */
export async function getLoincForTest(labTestName: string): Promise<LoincCode | undefined> {
  const codes = await loadLoincCodes();
  const normalized = labTestName.toLowerCase();
  return codes.find(c => 
    c.longCommonName.toLowerCase().includes(normalized) || 
    c.arabicName.includes(normalized) ||
    c.component.toLowerCase().includes(normalized)
  );
}

/**
 * Loads CPT codes from the local JSON file.
 */
export async function loadCptCodes(): Promise<CptCode[]> {
  if (cptCache) return cptCache;
  
  try {
    const response = await fetch('/db/clinical-data/cpt-egypt.json');
    if (!response.ok) throw new Error('Failed to load CPT codes');
    cptCache = await response.json();
    return cptCache || [];
  } catch (error) {
    console.error('Error loading CPT codes:', error);
    return [];
  }
}

/**
 * Fuzzy search for CPT codes.
 */
export async function searchCptCodes(query: string): Promise<CptCode[]> {
  const codes = await loadCptCodes();
  if (!query) return codes;

  if (!cptFuse) {
    cptFuse = new Fuse(codes, {
      keys: ['code', 'descriptionEn', 'descriptionAr', 'category'],
      threshold: 0.3,
    });
  }

  return cptFuse.search(query).map(result => result.item);
}

/**
 * Loads Drug Interactions from the local JSON file.
 */
export async function loadDrugInteractions(): Promise<DrugInteraction[]> {
  if (drugInteractionCache) return drugInteractionCache;
  
  try {
    const response = await fetch('/db/clinical-data/drug-interactions.json');
    if (!response.ok) throw new Error('Failed to load drug interactions');
    drugInteractionCache = await response.json();
    return drugInteractionCache || [];
  } catch (error) {
    console.error('Error loading drug interactions:', error);
    return [];
  }
}
