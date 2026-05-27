/**
 * clinical/mews.ts
 * Clinical logic for calculating the Modified Early Warning Score (MEWS).
 * Used by inpatient nursing and medical dashboards to track patient deterioration risks.
 */

export interface MEWSInput {
  systolicBp?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  temperature?: number | string | null;
}

export interface MEWSResult {
  score: number;
  risk: "low" | "medium" | "high";
  labelAr: string;
  labelEn: string;
  color: string; // Tailwind class
  bgColor: string; // Tailwind class
  badgeStyle: string; // Complete Tailwind styling
}

/**
 * Calculates the MEWS score based on physiological parameters.
 * standard MEWS ranges:
 * - Systolic BP (mmHg): <=70 (3), 71-80 (2), 81-100 (1), 101-199 (0), >=200 (2)
 * - Heart Rate (bpm): <=40 (2), 41-50 (1), 51-100 (0), 101-110 (1), 111-129 (2), >=130 (3)
 * - Respiratory Rate (tpm): <=8 (2), 9-14 (0), 15-20 (1), 21-29 (2), >=30 (3)
 * - Temperature (°C): <=34.9 (2), 35.0-38.4 (0), >=38.5 (2)
 * Note: AVPU (level of consciousness) is not checked if not recorded, treating it as Alert (0).
 */
export function calculateMEWS(input: MEWSInput): MEWSResult {
  let score = 0;
  let parametersCount = 0;

  // 1. Systolic BP
  if (input.systolicBp !== undefined && input.systolicBp !== null) {
    parametersCount++;
    const sbp = input.systolicBp;
    if (sbp <= 70) score += 3;
    else if (sbp >= 71 && sbp <= 80) score += 2;
    else if (sbp >= 81 && sbp <= 100) score += 1;
    else if (sbp >= 101 && sbp <= 199) score += 0;
    else if (sbp >= 200) score += 2;
  }

  // 2. Heart Rate
  if (input.heartRate !== undefined && input.heartRate !== null) {
    parametersCount++;
    const hr = input.heartRate;
    if (hr <= 40) score += 2;
    else if (hr >= 41 && hr <= 50) score += 1;
    else if (hr >= 51 && hr <= 100) score += 0;
    else if (hr >= 101 && hr <= 110) score += 1;
    else if (hr >= 111 && hr <= 129) score += 2;
    else if (hr >= 130) score += 3;
  }

  // 3. Respiratory Rate
  if (input.respiratoryRate !== undefined && input.respiratoryRate !== null) {
    parametersCount++;
    const rr = input.respiratoryRate;
    if (rr <= 8) score += 2;
    else if (rr >= 9 && rr <= 14) score += 0;
    else if (rr >= 15 && rr <= 20) score += 1;
    else if (rr >= 21 && rr <= 29) score += 2;
    else if (rr >= 30) score += 3;
  }

  // 4. Temperature
  if (input.temperature !== undefined && input.temperature !== null) {
    const temp = typeof input.temperature === "string" ? parseFloat(input.temperature) : input.temperature;
    if (!isNaN(temp)) {
      parametersCount++;
      if (temp <= 34.9) score += 2;
      else if (temp >= 35.0 && temp <= 38.4) score += 0;
      else if (temp >= 38.5) score += 2;
    }
  }

  // If no parameters could be assessed, return a neutral score
  if (parametersCount === 0) {
    return {
      score: 0,
      risk: "low",
      labelAr: "مستقر",
      labelEn: "Stable",
      color: "text-gray-500",
      bgColor: "bg-gray-100 dark:bg-gray-800",
      badgeStyle: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200"
    };
  }

  let risk: "low" | "medium" | "high" = "low";
  let labelAr = "مستقر";
  let labelEn = "Stable";
  let color = "text-emerald-600 dark:text-emerald-400";
  let bgColor = "bg-emerald-500/10";
  let badgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200/50";

  // Score thresholds: 1-2 (low), 3-4 (medium), >= 5 (high / critical)
  if (score >= 5) {
    risk = "high";
    labelAr = "حرج - تنبيه طارئ";
    labelEn = "STAT Alert - Critical";
    color = "text-rose-600 dark:text-rose-400 font-extrabold";
    bgColor = "bg-rose-500/10";
    badgeStyle = "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200/50 animate-pulse border-rose-300 font-bold";
  } else if (score >= 3) {
    risk = "medium";
    labelAr = "مراقبة مستمرة";
    labelEn = "Observe - Medium Risk";
    color = "text-amber-600 dark:text-amber-400 font-bold";
    bgColor = "bg-amber-500/10";
    badgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50 font-semibold";
  }

  return { score, risk, labelAr, labelEn, color, bgColor, badgeStyle };
}
