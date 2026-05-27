import { db } from "@/lib/db";
import { medications as medicationsTable, medicationInteractions, drugAllergyCrossReferences } from "@db/schema/pharmacy";
import { and, or, sql, inArray } from "drizzle-orm";

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
  aiAnalysisAr?: string;
  aiAnalysisEn?: string;
  isAiOptimized?: boolean;
  isAiBypassed?: boolean;
}

/**
 * Checks for drug-drug interactions and patient allergies using local database records.
 */
export async function checkDrugInteractions(
  medications: { name: string; genericName?: string }[],
  patientAllergies: string[],
  chronicConditions: string[] = [],
  tx: Omit<typeof db, "$client"> = db // Fallback to global db if called outside tx
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
    interface InteractionMatch {
      drug1Name: string;
      drug2Name: string;
      drug1Generic: string | null;
      drug2Generic: string | null;
      severity: string;
      mechanismAr: string | null;
      mechanismEn: string | null;
      clinicalEffectAr: string | null;
      clinicalEffectEn: string | null;
    }

    const fastPathMatches: InteractionMatch[] = await tx
      .select({
        drug1Name: medicationInteractions.drug1Name,
        drug2Name: medicationInteractions.drug2Name,
        drug1Generic: medicationInteractions.drug1Generic,
        drug2Generic: medicationInteractions.drug2Generic,
        severity: medicationInteractions.severity,
        mechanismAr: medicationInteractions.mechanismAr,
        mechanismEn: medicationInteractions.mechanismEn,
        clinicalEffectAr: medicationInteractions.clinicalEffectAr,
        clinicalEffectEn: medicationInteractions.clinicalEffectEn,
      })
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
    fastPathMatches.forEach((match) => {
      resolvedIds.add(match.drug1Generic?.toLowerCase() || match.drug1Name.toLowerCase());
      resolvedIds.add(match.drug2Generic?.toLowerCase() || match.drug2Name.toLowerCase());
      
      interactions.push({
        drug1: match.drug1Name,
        drug2: match.drug2Name,
        severity: match.severity as Interaction['severity'],
        mechanismAr: match.mechanismAr || undefined,
        mechanismEn: match.mechanismEn || undefined,
        effectAr: match.clinicalEffectAr || undefined,
        effectEn: match.clinicalEffectEn || undefined,
      });
    });

    // 2. Fuzzy Path: Resolve unresolved identifiers to canonical generics first
    const unresolvedIds = lowerIdentifiers.filter(id => !resolvedIds.has(id));

    if (unresolvedIds.length >= 1) {
      // 2a. Resolve identifiers to canonical catalog generic names
      const resolvedGenericsFromCatalog: { genericName: string }[] = await tx
        .select({ genericName: medicationsTable.genericName })
        .from(medicationsTable)
        .where(
          or(
            ...unresolvedIds.map(id => 
              or(
                sql`${medicationsTable.nameEn} % ${id}`,
                sql`${medicationsTable.nameAr} % ${id}`,
                sql`${medicationsTable.genericName} % ${id}`
              )
            )
          )
        )
        .limit(20);

      const resolvedGenerics = [...new Set(resolvedGenericsFromCatalog.map((m) => m.genericName.toLowerCase()))];
      const allResolvedGenerics = [...new Set([...Array.from(resolvedIds), ...resolvedGenerics])];

      if (allResolvedGenerics.length >= 2) {
        // 2b. Exact match on interactions table using canonical generics
        const fuzzyDdiMatches: InteractionMatch[] = await tx
          .select({
            drug1Name: medicationInteractions.drug1Name,
            drug2Name: medicationInteractions.drug2Name,
            drug1Generic: medicationInteractions.drug1Generic,
            drug2Generic: medicationInteractions.drug2Generic,
            severity: medicationInteractions.severity,
            mechanismAr: medicationInteractions.mechanismAr,
            mechanismEn: medicationInteractions.mechanismEn,
            clinicalEffectAr: medicationInteractions.clinicalEffectAr,
            clinicalEffectEn: medicationInteractions.clinicalEffectEn,
          })
          .from(medicationInteractions)
          .where(
            and(
              inArray(sql`lower(${medicationInteractions.drug1Generic})`, allResolvedGenerics),
              inArray(sql`lower(${medicationInteractions.drug2Generic})`, allResolvedGenerics)
            )
          );

        fuzzyDdiMatches.forEach((match) => {
          const isDuplicate = interactions.some(i => 
            (i.drug1 === match.drug1Name && i.drug2 === match.drug2Name) ||
            (i.drug1 === match.drug2Name && i.drug2 === match.drug1Name)
          );

          if (!isDuplicate) {
            interactions.push({
              drug1: match.drug1Name,
              drug2: match.drug2Name,
              severity: match.severity as Interaction['severity'],
              mechanismAr: match.mechanismAr || undefined,
              mechanismEn: match.mechanismEn || undefined,
              effectAr: match.clinicalEffectAr || undefined,
              effectEn: match.clinicalEffectEn || undefined,
            });
          }
        });
      }
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
      const reactingMeds: string[] = (match.crossReactingDrugs as string[]) || [];
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

  // Precompute local fallback clinical reasoning if AI is not used
  let aiAnalysisAr = "";
  let aiAnalysisEn = "";

  if (interactions.length > 0 || allergyAlerts.length > 0) {
    aiAnalysisEn = "LOCAL SAFETY CHECK RESULTS:\n\n";
    aiAnalysisAr = "نتائج فحص السلامة المحلي:\n\n";

    if (interactions.length > 0) {
      aiAnalysisEn += "DRUG-DRUG INTERACTIONS:\n";
      aiAnalysisAr += "التدخلات الدوائية المكتشفة:\n";
      
      interactions.forEach(i => {
        aiAnalysisEn += `- ${i.drug1} + ${i.drug2} [${i.severity.toUpperCase()}]: ${i.mechanismEn || i.effectEn || "No details available."}\n`;
        aiAnalysisAr += `- ${i.drug1} + ${i.drug2} [${i.severity === 'contraindicated' ? 'موانع استعمال مطلق' : i.severity === 'severe' ? 'شديد' : i.severity === 'moderate' ? 'متوسط' : 'خفيف'}]: ${i.mechanismAr || i.effectAr || "تفاصيل التداخل غير متوفرة محلياً."}\n`;
      });
    }

    if (allergyAlerts.length > 0) {
      aiAnalysisEn += "\nALLERGY ALERTS:\n";
      aiAnalysisAr += "\nتحذيرات الحساسية:\n";
      
      allergyAlerts.forEach(a => {
        aiAnalysisEn += `- ${a.medication}: Cross-reactivity with allergen ${a.allergen} (Severity: ${a.severity})\n`;
        aiAnalysisAr += `- ${a.medication}: تفاعل حساسية متقاطع مع ${a.allergen} (الشدة: ${a.severity})\n`;
      });
    }
  } else {
    aiAnalysisEn = "No known interactions or allergies detected in the local safety database.";
    aiAnalysisAr = "لم يتم الكشف عن تداخلات دوائية أو تحذيرات حساسية معروفة في قاعدة البيانات المحلية.";
  }

  return {
    interactions,
    allergyAlerts,
    overallRiskLevel,
    isApproved: !hasContraindication, // Hard stop on contraindicated
    requiresAiEnrichment,
    aiAnalysisAr,
    aiAnalysisEn,
    isAiOptimized: false,
  };
}
