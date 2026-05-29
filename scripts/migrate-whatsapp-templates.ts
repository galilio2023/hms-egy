import { db } from "../src/lib/db";
import { hospitalSettings } from "../db/schema/core";
import { sql, eq } from "drizzle-orm";

/**
 * Migration script to ensure all existing hospitals have 'mews_critical_alert'
 * in their approved WhatsApp templates list.
 *
 * Run with: DATABASE_URL=... npx tsx scripts/migrate-whatsapp-templates.ts
 */
async function migrate() {
  console.log("🚀 Starting migration: Adding 'mews_critical_alert' to all existing hospital settings...");

  try {
    // This query appends 'mews_critical_alert' only if it's not already present in the array.
    // It handles the case where the array might be null by using COALESCE.
    const result = await db
      .update(hospitalSettings)
      .set({
        approvedWhatsappTemplates: sql`array_append(COALESCE(${hospitalSettings.approvedWhatsappTemplates}, ARRAY[]::text[]), 'mews_critical_alert')`
      })
      .where(sql`NOT ('mews_critical_alert' = ANY(COALESCE(${hospitalSettings.approvedWhatsappTemplates}, ARRAY[]::text[])))`);

    console.log("✅ Migration completed successfully.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
  process.exit(0);
}

if (require.main === module) {
  migrate();
}
