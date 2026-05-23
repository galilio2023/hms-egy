import { db } from "@/lib/db";
import { medicationInteractions, drugAllergyCrossReferences } from "@/db/schema/pharmacy";
import { eq, and, or, ilike, sql, inArray } from "drizzle-orm";

export interface Interaction {
  drug1: string;
  drug2: string;
  severity: 'mild' | 'moderate' | 'severe' | 'contraindicated';
  mechanismAr?: string;
  mechanismEn?: string;
  effectAr?: string;
  effectEn?: string;
}

export interface AllergyAlert {
  medication: string;
  allergen: string;
  severity: string;
  notes?: string;
}

export interface DdiResult {
  interactions: Interaction[];
  allergyAlerts: AllergyAlert[];
  overallRiskLevel: 'low' | 'medium' | 'high';
  isApproved: boolean;
  requiresAiEnrichment: boolean;
}

/**
 * Checks for drug-drug interactions and patient allergies using local database records.
 */
export async function checkDrugInteractions(
  medications: { name: string; genericName?: string }[],
  patientAllergies: string[],
  chronicConditions: string[] = [],
  renalFunction: string = "normal",
  hepaticFunction: string = "normal"
): Promise<DdiResult> {
  const interactions: Interaction[] = [];
  const allergyAlerts: AllergyAlert[] = [];
  
  if (medications.length < 1) {
    return {
      interactions: [],
      allergyAlerts: [],
      overallRiskLevel: 'low',
      isApproved: true,
      requiresAiEnrichment: false,
    };
  }

  const names = medications.map(m => m.name);
  const generics = medications.map(m => m.genericName).filter(Boolean) as string[];
  const allIdentifiers = [...new Set([...names, ...generics])];

  // 1. Check for Drug-Drug Interactions (DDI)
  // Query all pairs in the list
  // NOTE: lower() on columns is used for safety. For production scale, 
  // ensure a functional index exists to maintain performance:
  // CREATE INDEX idx_medication_interactions_lower_drug1 ON medication_interactions (LOWER(drug1_name));
  // CREATE INDEX idx_medication_interactions_lower_drug2 ON medication_interactions (LOWER(drug2_name));
  if (allIdentifiers.length >= 2) {
    const ddiMatches = await db
      .select()
      .from(medicationInteractions)
      .where(
        or(
          and(
            inArray(sql`lower(${medicationInteractions.drug1Name})`, allIdentifiers.map(n => n.toLowerCase())),
            inArray(sql`lower(${medicationInteractions.drug2Name})`, allIdentifiers.map(n => n.toLowerCase()))
          ),
          and(
            inArray(sql`lower(${medicationInteractions.drug1Generic})`, allIdentifiers.map(n => n.toLowerCase())),
            inArray(sql`lower(${medicationInteractions.drug2Generic})`, allIdentifiers.map(n => n.toLowerCase()))
          )
        )
      );

    ddiMatches.forEach(match => {
      interactions.push({
        drug1: match.drug1Name,
        drug2: match.drug2Name,
        severity: match.severity as any,
        mechanismAr: match.mechanismAr || undefined,
        mechanismEn: match.mechanismEn || undefined,
        effectAr: match.clinicalEffectAr || undefined,
        effectEn: match.clinicalEffectEn || undefined,
      });
    });
  }

  // 2. Check for Patient Allergies
  if (patientAllergies.length > 0) {
    const allergyMatches = await db
      .select()
      .from(drugAllergyCrossReferences)
      .where(
        inArray(sql`lower(${drugAllergyCrossReferences.allergenName})`, patientAllergies.map(a => a.toLowerCase()))
      );

    for (const match of allergyMatches) {
      // Check if any prescribed med is in the cross-reacting list
      const reactingMeds = match.crossReactingDrugs || [];
      const foundReaction = allIdentifiers.find(id => 
        reactingMeds.some(rm => rm.toLowerCase() === id.toLowerCase())
      );

      if (foundReaction) {
        allergyAlerts.push({
          medication: foundReaction,
          allergen: match.allergenName,
          severity: match.crossReactionSeverity || "unknown",
          notes: match.notesAr || undefined,
        });
      }
    }
  }

  // 3. Determine Overall Risk and AI Necessity
  const hasContraindication = interactions.some(i => i.severity === 'contraindicated');
  const hasSevereInteraction = interactions.some(i => i.severity === 'severe');
  const hasSevereAllergy = allergyAlerts.length > 0; // Any allergy is serious

  let overallRiskLevel: 'low' | 'medium' | 'high' = 'low';
  if (hasContraindication || hasSevereInteraction || hasSevereAllergy) {
    overallRiskLevel = 'high';
  } else if (interactions.some(i => i.severity === 'moderate')) {
    overallRiskLevel = 'medium';
  }

  // AI enrichment criteria:
  // - More than 5 medications (polypharmacy)
  // - Complex clinical context (> 3 chronic conditions)
  // - High risk without local contraindicated match
  const requiresAiEnrichment = 
    medications.length > 5 || 
    chronicConditions.length > 3 ||
    (overallRiskLevel === 'high' && !hasContraindication);

  return {
    interactions,
    allergyAlerts,
    overallRiskLevel,
    isApproved: !hasContraindication, // Hard stop on contraindicated
    requiresAiEnrichment,
  };
}
