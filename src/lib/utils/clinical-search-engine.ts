import Fuse from "fuse.js";
import icd10Data from "@db/clinical-data/icd10-ar.json";
import cptData from "@db/clinical-data/cpt-egypt.json";
import type { Icd10Code, CptCode } from "./clinical-codes";

let icdFuse: Fuse<Icd10Code> | null = null;
let cptFuse: Fuse<CptCode> | null = null;

function getIcdFuse() {
  if (!icdFuse) {
    icdFuse = new Fuse(icd10Data as Icd10Code[], {
      keys: ["nameEn", "nameAr", "code"],
      threshold: 0.3,
    });
  }
  return icdFuse;
}

function getCptFuse() {
  if (!cptFuse) {
    cptFuse = new Fuse(cptData as CptCode[], {
      keys: ["nameEn", "nameAr", "code"],
      threshold: 0.3,
    });
  }
  return cptFuse;
}

/**
 * Executes a local fuzzy search for ICD-10 codes.
 * Safe for server-side execution.
 */
export function queryIcd10Locally(query: string): Icd10Code[] {
  if (!query || query.trim().length === 0) return [];
  const sanitized = query.substring(0, 64).trim();
  return getIcdFuse().search(sanitized).slice(0, 15).map(r => r.item);
}

/**
 * Executes a local fuzzy search for CPT codes.
 * Safe for server-side execution.
 */
export function queryCptLocally(query: string): CptCode[] {
  if (!query || query.trim().length === 0) return [];
  const sanitized = query.substring(0, 64).trim();
  return getCptFuse().search(sanitized).slice(0, 15).map(r => r.item);
}
