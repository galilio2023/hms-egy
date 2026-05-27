"use server";

import { Interaction, AllergyAlert } from "@/lib/pharmacy/ddi";
import { z } from "zod";
import redis from "@/lib/utils/redis";
import { createHash } from "crypto";

const ClaudeResponseSchema = z.object({
  reasoningAr: z.string().default(""),
  reasoningEn: z.string().default(""),
  isApproved: z.boolean().default(true),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
});

interface ClaudeDdiPayload {
  medications: { name: string; genericName?: string }[];
  patientAllergies: string[];
  chronicConditions: string[];
}

export interface ClaudeAnalysisResult {
  success: boolean;
  reasoningAr?: string;
  reasoningEn?: string;
  isApproved: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  fallbackActive: boolean;
}

/**
 * Direct HTTPS caller to Claude AI (Anthropic) for Clinical Drug Safety and Reasoning.
 * Designed with a strict rule-based fallback if ANTHROPIC_API_KEY is missing or the request fails.
 */
export async function getClaudeClinicalAnalysis(
  payload: ClaudeDdiPayload
): Promise<ClaudeAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const { medications, patientAllergies, chronicConditions } = payload;

  // 1. Deterministic Caching Layer (Performance Review #4)
  // Prevents repeated high-latency AI calls for standard medication protocols
  const cacheKey = medications.length > 0 ? createHash("sha256")
    .update(JSON.stringify({
      meds: medications.map(m => m.name + (m.genericName || "")).sort(),
      allergies: [...patientAllergies].sort(),
      conditions: [...chronicConditions].sort()
    }))
    .digest("hex") : null;

  if (redis && cacheKey) {
    try {
      const cached = await redis.get<ClaudeAnalysisResult>(`ai-ddi-cache:${cacheKey}`);
      if (cached) {
        return { ...cached, fallbackActive: false };
      }
    } catch (err) {
      console.warn("Redis cache read failed, falling back to live AI call:", err);
    }
  }

  // fail-closed medical safety logic
  if (!apiKey) {
    return {
      success: false,
      isApproved: false,
      riskLevel: 'high',
      fallbackActive: true,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second strict SLA

  const prompt = `You are a clinical pharmacologist and medical AI. Perform a rigorous, multi-dimensional drug safety analysis.

CLINICAL CONTEXT:
1. Medications Prescribed:
${medications.map((m, index) => `   - [Medication ${index + 1}] Name: ${m.name} ${m.genericName ? `(Generic: ${m.genericName})` : ""}`).join("\n")}
2. Patient Known Allergies:
${patientAllergies.length > 0 ? patientAllergies.map(a => `   - ${a}`).join("\n") : "   - No known drug allergies."}
3. Patient Chronic Conditions:
${chronicConditions.length > 0 ? chronicConditions.map(c => `   - ${c}`).join("\n") : "   - No known chronic medical conditions."}

CRITICAL RULES:
1. Identify all Drug-Drug Interactions (DDIs) among the prescribed medications, including severity (mild, moderate, severe, contraindicated) and pharmacological mechanisms.
2. Check for Drug-Allergy cross-reactivity based on the patient's allergies.
3. Check for Drug-Disease contraindications based on the patient's chronic conditions.
4. Output your detailed clinical analysis.
5. Keep descriptions concise, structured, and clinically actionable. Highlight life-threatening or contraindicated items immediately.
6. Provide a final safety decision: IS_APPROVED (boolean: false if there are absolute contraindications) and RISK_LEVEL (low, medium, high).

Provide your response strictly as a JSON object matching this schema:
{
  "reasoningAr": "Detailed Arabic analysis",
  "reasoningEn": "Detailed English analysis",
  "isApproved": boolean,
  "riskLevel": "low" | "medium" | "high"
}
Do not include any markdown formatting or additional text outside the JSON object.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1500,
        messages: [
          { role: "user", content: prompt }
        ],
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Anthropic API responded with status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";

    // Robust JSON extraction to handle conversational noise, markdown blocks, or nested braces
    let jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude did not return a valid JSON object");
    
    // Safety check: if there are multiple top-level braces, find the last closing one for the first opening one
    let jsonString = jsonMatch[0];
    
    // Strip markdown formatting if present (Review #2)
    if (jsonString.startsWith("```json")) {
      jsonString = jsonString.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (jsonString.startsWith("```")) {
      jsonString = jsonString.replace(/^```/, "").replace(/```$/, "").trim();
    }

    let firstBrace = jsonString.indexOf('{');
    let lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }
    
    const parsed = JSON.parse(jsonString);
    const validated = ClaudeResponseSchema.parse(parsed);

    const result: ClaudeAnalysisResult = {
      success: true,
      reasoningAr: validated.reasoningAr,
      reasoningEn: validated.reasoningEn,
      isApproved: validated.isApproved,
      riskLevel: validated.riskLevel,
      fallbackActive: false,
    };

    // Cache the successful result in Redis for 24 hours
    if (redis && cacheKey) {
      redis.set(`ai-ddi-cache:${cacheKey}`, result, { ex: 60 * 60 * 24 }).catch(err => {
        console.warn("Failed to cache AI result in Redis:", err);
      });
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Failed to query Claude for clinical DDI:", error);
    // Unify to fail-closed for clinical safety (Review #1)
    return {
      success: false,
      isApproved: false, 
      riskLevel: 'high',
      fallbackActive: true,
    };
  }
}
