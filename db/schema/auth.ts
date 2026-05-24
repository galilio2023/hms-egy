import { pgTable, text, timestamp, boolean, integer, uuid, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { hospitals, departments } from "./core";

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  role: text("role").notNull(), // Matches roleEnum values
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  isPasswordExpired: boolean("is_password_expired").default(false).notNull(),
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
  lockoutUntil: timestamp("lockout_until"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { 
      for: "all", 
      to: "public", 
      using: sql`(current_setting('app.bypass_rls', true) = 'true') 
                 OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)
                 OR (current_setting('app.auth_lookup_active', true) = 'true')` 
    }),
    hospitalIdIdx: index("user_hospital_idx").on(table.hospitalId),
    emailIdx: index("user_email_idx").on(table.email),
  };
}).enableRLS();

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activeHospitalId: uuid("active_hospital_id").references(() => hospitals.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
}, (table) => {
  return {
    userIdIdx: index("session_user_idx").on(table.userId),
    tokenIdx: index("session_token_idx").on(table.token),
  };
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
}, (table) => {
  return {
    userIdIdx: index("account_user_idx").on(table.userId),
  };
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
}, (table) => {
  return {
    identifierIdx: index("verification_identifier_idx").on(table.identifier),
  };
});
