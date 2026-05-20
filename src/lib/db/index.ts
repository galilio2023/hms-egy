/**
 * HMS Egypt - Drizzle ORM + Neon PostgreSQL Connection
 */

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../../db/schema";

// Enable connection caching for serverless environments
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(process.env.DATABASE_URL);

/**
 * Main database instance.
 */
export const db = drizzle(sql, { schema });

/**
 * Scopes a query to a specific hospital.
 */
export function scopeToHospital(hospitalId: string) {
  return (table: any) => {
    // This is a simplified helper; in actual implementation, 
    // it would return a partial query filter.
    return table.hospitalId === hospitalId;
  };
}

/**
 * Checks if the database connection is active.
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    // Basic ping
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}
