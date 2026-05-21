import { pgTable, text, uuid, timestamp, boolean, varchar, index, unique , pgPolicy} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { hospitals } from "./core";
import { genderEnum } from "./enums";

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  patientNumber: varchar("patient_number", { length: 50 }).notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  nationalId: varchar("national_id", { length: 14 }).notNull(),
  dob: timestamp("dob").notNull(),
  gender: genderEnum("gender").notNull(),
  contactPhone: text("contact_phone").notNull(),
  email: text("email"),
  address: text("address").notNull(),
  governorate: text("governorate").notNull(),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  uhisNumber: varchar("uhis_number", { length: 50 }),
  uhisGovernorate: text("uhis_governorate"),
  isUhisActive: boolean("is_uhis_active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalNidUnique: unique("pat_hospital_nid_unique").on(table.hospitalId, table.nationalId),
    hospitalNumIdx: index("pat_hospital_num_idx").on(table.hospitalId, table.patientNumber),
    govIdx: index("pat_gov_idx").on(table.governorate),
    nationalIdNumericCheck: sql`CHECK (national_id ~ '^[0-9]{14}$')`,
  };
});

export const patientConsents = pgTable("patient_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // general, surgical, telemedicine
  version: varchar("version", { length: 10 }).notNull(), // e.g. "v1.0"
  isSigned: boolean("is_signed").default(false).notNull(),
  signedAt: timestamp("signed_at"),
  signatureUrl: text("signature_url"),
  witnessName: text("witness_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalIdIdx: index("consent_hospital_idx").on(table.hospitalId),
    patientTypeIdx: index("consent_patient_type_idx").on(table.patientId, table.type),
  };
});
