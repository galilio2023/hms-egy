/**
 * sms/client.ts
 * Resilient Egyptian SMS & WhatsApp Notification Gateway Client.
 * Implements primary provider routing with automated failover (CEQUENS <-> VictoryLink),
 * out-of-band WhatsApp alerts for STAT clinical triggers, database logging,
 * and rate-limit guardrails.
 */

import { db } from "@/lib/db";
import { sentReminders } from "@db/schema/system";
import { hospitalSettings } from "@db/schema/core";
import { eq, and, sql } from "drizzle-orm";
import { MAX_DAILY_SMS_PER_PATIENT } from "@/lib/utils/constants";
import { toZonedTime } from "date-fns-tz";

// Provider configs
const CEQUENS_API_URL = process.env.CEQUENS_API_URL || "https://api.cequens.com/sms/v1/messages";
const CEQUENS_API_KEY = process.env.CEQUENS_API_KEY || "";
const VICTORYLINK_API_URL = process.env.VICTORYLINK_API_URL || "https://smsvas.victorylink.com.eg/SMS/SendSMS";
const VICTORYLINK_USERNAME = process.env.VICTORYLINK_USERNAME || "";
const VICTORYLINK_PASSWORD = process.env.VICTORYLINK_PASSWORD || "";
const SENDER_ID = process.env.EGYPT_SMS_SENDER_ID || "HMSEgypt";

// WhatsApp config
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v17.0";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

export interface OutboundMessagePayload {
  hospitalId: string;
  patientId?: string;
  userId?: string; // Recipient staff user ID
  phoneNumber: string;
  messageAr: string;
  messageEn: string;
  reminderType: string; // e.g., "high_mews_alert", "stat_lab_order", "appointment_reminder"
  entityType: "appointment" | "invoice" | "clinical_alert" | "system";
  entityId: string; // UUID of related admission, lab order, or appointment
  channelPriority?: ("whatsapp" | "sms")[];
  whatsappTemplate?: {
    name: string;
    languageCode: string;
    parameters: string[];
  };
  approvedWhatsappTemplates?: string[]; // Optional: pass pre-fetched templates to avoid DB lookup
}

export interface SendResult {
  success: boolean;
  channel: "sms" | "whatsapp";
  providerUsed?: string;
  errorMessage?: string;
}

/**
 * Validates and normalizes Egyptian phone numbers.
 * Formats standard local mobile numbers (e.g. 010..., 011..., 012..., 015...) to international country code +20.
 */
export function normalizeEgyptianPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  
  // Handle international double zero prefixes
  if (cleaned.startsWith("0020")) {
    cleaned = cleaned.slice(4);
  } else if (cleaned.startsWith("20")) {
    cleaned = cleaned.slice(2);
  }
  
  // Egyptian mobile numbers must be 10 digits after removing leading zero/country prefix
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }

  // Check valid prefix codes in Egypt: 10, 11, 12, 15
  if (!/^(10|11|12|15)\d{8}$/.test(cleaned)) {
    throw new Error(`Invalid Egyptian mobile number format: ${phone}`);
  }

  return `+20${cleaned}`;
}

/**
 * Resiliently dispatches out-of-band alerts with failover and rate-limiting.
 */
export async function sendResilientClinicalAlert(payload: OutboundMessagePayload): Promise<SendResult> {
  const {
    hospitalId,
    patientId,
    userId,
    phoneNumber,
    messageAr,
    messageEn,
    reminderType,
    entityType,
    entityId,
    channelPriority = ["whatsapp", "sms"],
    approvedWhatsappTemplates,
  } = payload;

  const isRtl = true; // Defaulting to Arabic for Egyptian clinical staff out-of-band alerts
  const messageText = isRtl ? messageAr : messageEn;

  // 1. Verify Rate Limiting for Patient (preventing loops and billing drain)
  if (patientId) {
    try {
      const [sentTodayCount] = await db
        .select({ count: sql<number>`count(*)::integer` })
        .from(sentReminders)
        .where(
          and(
            eq(sentReminders.patientId, patientId),
            eq(sentReminders.success, true),
            sql`timezone('Africa/Cairo', ${sentReminders.sentAt})::date = CURRENT_DATE`
          )
        );

      if (sentTodayCount && sentTodayCount.count >= MAX_DAILY_SMS_PER_PATIENT) {
        console.warn(`[SMS GUARDRAIL] Daily notification limit (${MAX_DAILY_SMS_PER_PATIENT}) exceeded for patient: ${patientId}`);
        return {
          success: false,
          channel: "sms",
          errorMessage: "Daily alert rate limit exceeded for this recipient.",
        };
      }
    } catch (err) {
      console.warn("[SMS GUARDRAIL] Failed to query daily reminder count, proceeding anyway for medical safety:", err);
    }
  }

  let formattedPhone = "";
  try {
    formattedPhone = normalizeEgyptianPhoneNumber(phoneNumber);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      channel: "sms",
      errorMessage: message || "Invalid phone number.",
    };
  }

  // 2. Resilient Channel Routing
  for (const channel of channelPriority) {
    if (channel === "whatsapp") {
      const waResult = await sendWhatsAppMessage(
        hospitalId,
        formattedPhone,
        messageText,
        payload.whatsappTemplate,
        approvedWhatsappTemplates
      );
      if (waResult.success) {
        await logSentReminder(payload, "whatsapp", true, waResult.providerUsed);
        return waResult;
      } else {
        console.warn(`[NOTIFICATION GATEWAY] WhatsApp delivery failed: ${waResult.errorMessage}. Falling back to SMS.`);
      }
    }

    if (channel === "sms") {
      const smsResult = await sendSmsWithFailover(formattedPhone, messageText);
      await logSentReminder(payload, "sms", smsResult.success, smsResult.providerUsed, smsResult.errorMessage);
      return smsResult;
    }
  }

  return {
    success: false,
    channel: "sms",
    errorMessage: "All communication channels failed.",
  };
}

/**
 * Attempts sending an SMS through CEQUENS.
 * Fails over to VictoryLink if CEQUENS returns errors or experiences latency/timeout.
 */
async function sendSmsWithFailover(phone: string, text: string): Promise<SendResult> {
  const isSimulationMode = !CEQUENS_API_KEY && !VICTORYLINK_USERNAME;

  if (isSimulationMode) {
    console.log(`\n--- 📱 [SMS SIMULATION] ---`);
    console.log(`Recipient: ${phone}`);
    console.log(`Sender: ${SENDER_ID}`);
    console.log(`Content: ${text}`);
    console.log(`---------------------------\n`);
    return {
      success: true,
      channel: "sms",
      providerUsed: "SIMULATOR",
    };
  }

  // Method 1: Try Primary Provider (CEQUENS)
  if (CEQUENS_API_KEY) {
    try {
      const cequensResult = await sendCequensSms(phone, text);
      if (cequensResult.success) return cequensResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[SMS ROUTING] Primary provider (CEQUENS) failed: ${message}. Initiating failover to VictoryLink.`);
    }
  }

  // Method 2: Failover Provider (VictoryLink)
  if (VICTORYLINK_USERNAME) {
    try {
      return await sendVictoryLinkSms(phone, text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SMS ROUTING] Secondary provider (VictoryLink) also failed: ${message}.`);
      return {
        success: false,
        channel: "sms",
        errorMessage: `Primary (CEQUENS) and Secondary (VictoryLink) SMS gateways failed. Last error: ${message}`,
      };
    }
  }

  return {
    success: false,
    channel: "sms",
    errorMessage: "No SMS gateway credentials configured.",
  };
}

/**
 * Primary Sender: CEQUENS API Client
 */
async function sendCequensSms(phone: string, text: string): Promise<SendResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s response SLA

  try {
    const res = await fetch(CEQUENS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CEQUENS_API_KEY}`,
      },
      body: JSON.stringify({
        senderName: SENDER_ID,
        messageText: text,
        recipients: [phone.replace("+", "")], // Cequens expects international digits without plus
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      return { success: true, channel: "sms", providerUsed: "CEQUENS" };
    } else {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Secondary/Failover Sender: VictoryLink API Client
 */
async function sendVictoryLinkSms(phone: string, text: string): Promise<SendResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000); // 6s SLA

  try {
    // VictoryLink legacy API expects parameters in a query-string format or x-www-form-urlencoded
    const params = new URLSearchParams({
      UserName: VICTORYLINK_USERNAME,
      Password: VICTORYLINK_PASSWORD,
      SMSText: text,
      SMSReceiver: phone,
      SenderName: SENDER_ID,
    });

    const res = await fetch(VICTORYLINK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      return { success: true, channel: "sms", providerUsed: "VictoryLink" };
    } else {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Out-of-band WhatsApp Business API Client
 */
async function sendWhatsAppMessage(
  hospitalId: string,
  phone: string,
  text: string,
  template?: { name: string; languageCode: string; parameters: string[] },
  preFetchedTemplates?: string[]
): Promise<SendResult> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    // If not configured, immediately return failure to let the system trigger SMS failover
    return {
      success: false,
      channel: "whatsapp",
      errorMessage: "WhatsApp Business API is not configured.",
    };
  }

  // Strict template validator for Meta Business API template-matching constraints
  if (template) {
    // Code Review Fix: Move APPROVED_TEMPLATES to DB-backed hospital_settings
    let approvedTemplates: string[] = preFetchedTemplates || [];
    
    // Only query DB if templates were not passed (distinguish between undefined and explicitly empty [])
    if (preFetchedTemplates === undefined) {
      try {
        const settings = await db
          .select({ approvedWhatsappTemplates: hospitalSettings.approvedWhatsappTemplates })
          .from(hospitalSettings)
          .where(eq(hospitalSettings.hospitalId, hospitalId))
          .limit(1)
          .then(res => res[0]);

        if (settings?.approvedWhatsappTemplates && settings.approvedWhatsappTemplates.length > 0) {
          approvedTemplates = settings.approvedWhatsappTemplates;
        } else if (process.env.APPROVED_WHATSAPP_TEMPLATES) {
          // Fallback to Env if DB settings are empty
          approvedTemplates = process.env.APPROVED_WHATSAPP_TEMPLATES.split(",").map((t) => t.trim());
        }
      } catch (dbErr) {
        console.warn("[WHATSAPP VALIDATOR] Failed to fetch hospital settings, falling back to defaults:", dbErr);
        if (process.env.APPROVED_WHATSAPP_TEMPLATES) {
          approvedTemplates = process.env.APPROVED_WHATSAPP_TEMPLATES.split(",").map((t) => t.trim());
        }
      }
    }

    if (!approvedTemplates.includes(template.name)) {
      return {
        success: false,
        channel: "whatsapp",
        errorMessage: `Unapproved Meta WhatsApp template: '${template.name}'. Only pre-registered templates are allowed by Meta in production.`,
      };
    }
    // Validation: MEWS critical alert requires exactly 2 parameters (Patient Name, Score)
    if (template.name === "mews_critical_alert" && template.parameters.length !== 2) {
      return {
        success: false,
        channel: "whatsapp",
        errorMessage: `Parameter mismatch for template 'mews_critical_alert'. Expected exactly 2 parameters, got ${template.parameters.length}.`,
      };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    const requestBody = template
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "template",
          template: {
            name: template.name,
            language: { code: template.languageCode },
            components: [
              {
                type: "body",
                parameters: template.parameters.map((param) => ({
                  type: "text",
                  text: param,
                })),
              },
            ],
          },
        }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { body: text },
        };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      return { success: true, channel: "whatsapp", providerUsed: "WhatsApp Business API" };
    } else {
      const errorData = await res.json().catch(() => ({}));
      const errMsg = errorData.error?.message || `HTTP ${res.status}`;
      return { success: false, channel: "whatsapp", errorMessage: errMsg };
    }
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      channel: "whatsapp",
      errorMessage: message || String(error),
    };
  }
}

/**
 * Securely audits the out-of-band notification log to sent_reminders table.
 */
async function logSentReminder(
  payload: OutboundMessagePayload,
  channel: "sms" | "whatsapp",
  success: boolean,
  provider?: string,
  error?: string
) {
  try {
    await db.insert(sentReminders).values({
      hospitalId: payload.hospitalId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      reminderType: payload.reminderType,
      channel: channel,
      patientId: payload.patientId || null,
      userId: payload.userId || null,
      success: success,
      errorMessage: error ? `${provider || "Gateway"}: ${error}` : `Delivered via ${provider || "Unknown Provider"}`,
    });
  } catch (err) {
    console.error("[NOTIFICATION LOGGING] Failed to record reminder delivery audit in database:", err);
  }
}
