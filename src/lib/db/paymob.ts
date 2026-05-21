import { db } from "@/lib/db";
import { hospitalSettings } from "@db/schema/core";
import { eq } from "drizzle-orm";
import { decryptField } from "@/lib/utils/security";

/**
 * Server-only helper to fetch and decrypt a hospital's Paymob credentials.
 * This is kept outside of Next.js Server Actions ("use server") to prevent public exposure.
 */
export async function getDecryptedPaymobCredentials(hospitalId: string) {
  try {
    const [settings] = await db
      .select({
        paymobApiKey: hospitalSettings.paymobApiKey,
        paymobHmacSecret: hospitalSettings.paymobHmacSecret,
      })
      .from(hospitalSettings)
      .where(eq(hospitalSettings.hospitalId, hospitalId))
      .limit(1);

    if (!settings) {
      return {
        paymobApiKey: null,
        paymobHmacSecret: null,
      };
    }

    const decryptedApiKey = settings.paymobApiKey ? decryptField(settings.paymobApiKey) : null;
    const decryptedHmacSecret = settings.paymobHmacSecret ? decryptField(settings.paymobHmacSecret) : null;

    return {
      paymobApiKey: decryptedApiKey,
      paymobHmacSecret: decryptedHmacSecret,
    };
  } catch (error) {
    console.error(`[DB_PAYMOB] Failed to decrypt Paymob credentials for hospital ${hospitalId}:`, error);
    return {
      paymobApiKey: null,
      paymobHmacSecret: null,
    };
  }
}
