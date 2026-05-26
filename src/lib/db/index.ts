/**
 * HMS Egypt - Drizzle ORM + Neon PostgreSQL Connection
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, sql } from "drizzle-orm";
import * as schema from "../../../db/schema";

declare global {
  var _neonPool: Pool | undefined;
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Enable websocket support for Node / serverless environments
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
  if (!globalThis._neonPool) {
    globalThis._neonPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  pool = globalThis._neonPool;
}

/**
 * Main database instance with transaction support.
 * This instance is subject to Row-Level Security (RLS) policies.
 */
export const db = drizzle(pool, { schema });

/**
 * Privileged database instance for authentication and system-level tasks.
 * Uses a separate connection pool (if SYSTEM_DATABASE_URL is provided) or the main pool.
 * NOTE: Queries using this client should be handled with extreme care as they may bypass RLS.
 */
const systemPool = process.env.SYSTEM_DATABASE_URL 
  ? new Pool({ connectionString: process.env.SYSTEM_DATABASE_URL })
  : pool;

export const systemDb = drizzle(systemPool, { schema });

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

