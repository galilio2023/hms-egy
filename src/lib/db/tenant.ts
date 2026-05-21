/**
 * HMS Egypt - Multi-Tenant Transaction Context Wrappers
 * 
 * Provides wrappers to scope queries inside PostgreSQL transactions and automatically
 * set the app.current_hospital_id session variable for Row-Level Security isolation.
 */

import { db } from "./index";
import { sql } from "drizzle-orm";

// Dynamically extract Drizzle transaction client type
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Executes a callback within a PostgreSQL transaction scoped to a specific hospital ID
 * for Row-Level Security tenant isolation.
 * 
 * Scopes the database session using `set_config('app.current_hospital_id', ..., true)`
 * which limits connection leakage outside the active transaction boundaries.
 * 
 * @param hospitalId The UUID of the hospital to isolate queries to.
 * @param callback A function returning a promise that accepts the transaction client.
 */
export async function withTenantContext<T>(
  hospitalId: string,
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  if (!hospitalId) {
    throw new Error("withTenantContext: hospitalId is required for tenant isolation.");
  }
  
  return await db.transaction(async (tx) => {
    // Set the app.current_hospital_id local session variable
    await tx.execute(sql`SELECT set_config('app.current_hospital_id', ${hospitalId}, true)`);
    return await callback(tx);
  });
}

/**
 * Executes a callback within a PostgreSQL transaction with RLS bypassed.
 * ONLY for background workflows, super-admin overrides, and system-level batch scripts.
 * 
 * Scopes the database session using `set_config('app.bypass_rls', 'true', true)`.
 * 
 * @param callback A function returning a promise that accepts the transaction client.
 */
export async function withBypassContext<T>(
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Set the app.bypass_rls local session variable
    await tx.execute(sql`SELECT set_config('app.bypass_rls', 'true', true)`);
    return await callback(tx);
  });
}
