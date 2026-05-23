import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env BEFORE any imports that instantiate the DB connection
config({ path: resolve(process.cwd(), ".env") });

async function runFix() {
  console.log("🛠 Starting database columns fix script...");

  try {
    const { db } = await import("../src/lib/db");
    const { sql } = await import("drizzle-orm");

    console.log("🌱 Executing DDL changes on remote database...");
    
    // 1. Add allergies column
    await db.execute(sql`
      ALTER TABLE patients 
      ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}'::text[] NOT NULL;
    `);
    console.log("✅ Column 'allergies' checked/added.");

    // 2. Add chronic_conditions column
    await db.execute(sql`
      ALTER TABLE patients 
      ADD COLUMN IF NOT EXISTS chronic_conditions text[] DEFAULT '{}'::text[] NOT NULL;
    `);
    console.log("✅ Column 'chronic_conditions' checked/added.");

    // 3. Add blood_type column
    await db.execute(sql`
      ALTER TABLE patients 
      ADD COLUMN IF NOT EXISTS blood_type varchar(5);
    `);
    console.log("✅ Column 'blood_type' checked/added.");

    // 4. Add UHIS columns
    await db.execute(sql`
      ALTER TABLE patients 
      ADD COLUMN IF NOT EXISTS uhis_number varchar(50);
    `);
    await db.execute(sql`
      ALTER TABLE patients 
      ADD COLUMN IF NOT EXISTS uhis_governorate text;
    `);
    await db.execute(sql`
      ALTER TABLE patients 
      ADD COLUMN IF NOT EXISTS is_uhis_active boolean DEFAULT false NOT NULL;
    `);
    console.log("✅ UHIS columns checked/added.");

    console.log("🎉 Database columns fixed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Fix failed with error:", error);
    process.exit(1);
  }
}

runFix();
