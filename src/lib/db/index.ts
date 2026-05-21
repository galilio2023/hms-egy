/**
 * HMS Egypt - Drizzle ORM + Neon PostgreSQL Connection
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, sql } from "drizzle-orm";
import * as schema from "../../../db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Enable websocket support for Node / serverless environments
/* eslint-disable-next-line no-eval */
neonConfig.webSocketConstructor = globalThis.WebSocket || (() => {
  try {
    return eval('require')("ws");
  } catch {
    return undefined;
  }
})();

// Cache connection pool to prevent exhausting connection slots during serverless warm-starts/hot-reloads
let pool: Pool;
if (process.env.NODE_ENV === "production") {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} else {
  if (!(global as any)._neonPool) {
    (global as any)._neonPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  pool = (global as any)._neonPool;
}

/**
 * Main database instance with transaction support.
 */
export const db = drizzle(pool, { schema });

/**
 * Scopes a query to a specific hospital.
 */
export function scopeToHospital(hospitalId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (table: { hospitalId: any }) => eq(table.hospitalId, hospitalId);
}

/**
 * Checks if the database connection is active.
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    // Basic ping
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

export * from "./tenant";

