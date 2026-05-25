import { db } from "@/lib/db";
import { medicationInteractions, drugAllergyCrossReferences } from "@db/schema/pharmacy";
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
  tx: any = db // Fallback to global db if called outside tx
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
  if (allIdentifiers.length >= 2) {
    const lowerIdentifiers = allIdentifiers.map(n => n.toLowerCase());

    // Optimization: First attempt an exact case-insensitive match for generic names (Fast Path)
    // This handles the majority of standard interactions without trigram overhead.
    const fastPathMatches = await tx
      .select()
      .from(medicationInteractions)
      .where(
        or(
          // Brand name exact match
          and(
            inArray(sql`lower(${medicationInteractions.drug1Name})`, lowerIdentifiers),
            inArray(sql`lower(${medicationInteractions.drug2Name})`, lowerIdentifiers)
          ),
          // Generic name exact match
          and(
            inArray(sql`lower(${medicationInteractions.drug1Generic})`, lowerIdentifiers),
            inArray(sql`lower(${medicationInteractions.drug2Generic})`, lowerIdentifiers)
          )
        )
      );

    // Track which identifiers were resolved via fast path
    const resolvedIds = new Set<string>();
    fastPathMatches.forEach((match: any) => {
      resolvedIds.add(match.drug1Generic?.toLowerCase() || match.drug1Name.toLowerCase());
      resolvedIds.add(match.drug2Generic?.toLowerCase() || match.drug2Name.toLowerCase());
      
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

    // 2. Fuzzy Path: Only for unresolved identifiers to prevent polypharmacy query blow-up
    const unresolvedIds = lowerIdentifiers.filter(id => !resolvedIds.has(id));

    if (unresolvedIds.length >= 1) {
      const fuzzyMatches = await tx
        .select()
        .from(medicationInteractions)
        .where(
          or(
            ...unresolvedIds.map(id => 
              or(
                sql`similarity(${medicationInteractions.drug1Generic}, ${id}) > 0.4`,
                sql`similarity(${medicationInteractions.drug2Generic}, ${id}) > 0.4`
              )
            )
          )
        );

      fuzzyMatches.forEach((match: any) => {
        const d1 = match.drug1Generic?.toLowerCase() || match.drug1Name.toLowerCase();
        const d2 = match.drug2Generic?.toLowerCase() || match.drug2Name.toLowerCase();
        
        // Ensure BOTH drugs are in our prescribed list (one might be fuzzy, other might be exact)
        const isDrug1Present = lowerIdentifiers.some(id => d1.includes(id) || id.includes(d1));
        const isDrug2Present = lowerIdentifiers.some(id => d2.includes(id) || id.includes(d2));

        if (isDrug1Present && isDrug2Present) {
          // Avoid duplicate interactions already found in fast path
          const isDuplicate = interactions.some(i => 
            (i.drug1 === match.drug1Name && i.drug2 === match.drug2Name) ||
            (i.drug1 === match.drug2Name && i.drug2 === match.drug1Name)
          );

          if (!isDuplicate) {
            interactions.push({
              drug1: match.drug1Name,
              drug2: match.drug2Name,
              severity: match.severity as any,
              mechanismAr: match.mechanismAr || undefined,
              mechanismEn: match.mechanismEn || undefined,
              effectAr: match.clinicalEffectAr || undefined,
              effectEn: match.clinicalEffectEn || undefined,
            });
          }
        }
      });
    }
  }

  // 2. Check for Patient Allergies
  if (patientAllergies.length > 0) {
    const allergyMatches = await tx
      .select()
      .from(drugAllergyCrossReferences)
      .where(
        inArray(sql`lower(${drugAllergyCrossReferences.allergenName})`, patientAllergies.map(a => a.toLowerCase()))
      );

    for (const match of allergyMatches) {
      // Check if any prescribed med is in the cross-reacting list
      const reactingMeds: string[] = match.crossReactingDrugs || [];
      const foundReaction = allIdentifiers.find(id => 
        reactingMeds.some((rm: string) => rm.toLowerCase() === id.toLowerCase())
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
