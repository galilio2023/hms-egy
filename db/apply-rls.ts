/**
 * HMS Egypt - Dynamic Row-Level Security Application Script
 * प्रोग्रामेटिक रूप से सभी tables पर RLS और FORCE RLS लागू करता है जिनमें hospital_id column है।
 */

import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function applyRLS() {
  console.log("🔒 Starting Row-Level Security application via Drizzle...");

  try {
    // 1. Fetch all base tables in the public schema that have a column named 'hospital_id'
    const query = sql`
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON c.table_schema = t.table_schema AND c.table_name = t.table_name
      WHERE c.table_schema = 'public'
        AND c.column_name = 'hospital_id'
        AND t.table_type = 'BASE TABLE'
    `;

    const result = await db.execute(query);
    const rows = result.rows as unknown as { table_name: string }[];
    const tables = rows.map((row) => row.table_name);

    console.log(`Found ${tables.length} tables requiring tenant RLS isolation:`, tables);

    if (tables.length === 0) {
      console.log("⚠️ No tables with hospital_id found.");
      return;
    }

    // 2. Loop through each table and apply RLS, FORCE RLS, and tenant_isolation_policy
    for (const table of tables) {
      console.log(`🛡️ Securing table: "${table}"`);

      // Enable RLS
      await db.execute(sql.raw(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`));

      // Force RLS (Ensure DB owner/connection role is bound by policies)
      await db.execute(sql.raw(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`));

      // Drop existing policy to avoid conflict
      await db.execute(sql.raw(`DROP POLICY IF EXISTS tenant_isolation_policy ON "${table}";`));

      // Create policy
      await db.execute(sql.raw(`
        CREATE POLICY tenant_isolation_policy ON "${table}"
        FOR ALL
        USING (
          (current_setting('app.bypass_rls', true) = 'true') OR
          (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)
        );
      `));

      console.log(`✅ Table "${table}" secured with RLS.`);
    }

    console.log("🎉 Row-Level Security applied successfully to all multi-tenant tables!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error applying RLS:", error);
    process.exit(1);
  }
}

applyRLS();
