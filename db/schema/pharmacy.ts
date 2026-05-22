import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, boolean, varchar, index, uniqueIndex, integer, decimal , pgPolicy} from "drizzle-orm/pg-core";
import { hospitals, staff } from "./core";
import { patients } from "./patients";
import { admissions } from "./clinical";

export const medications = pgTable("medications", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  genericName: text("generic_name").notNull(),
  form: varchar("form", { length: 50 }).notNull(), // tablet, capsule, syrup, injection, cream
  strength: varchar("strength", { length: 50 }).notNull(), // e.g. "500 mg", "10 ml"
  barcode: varchar("barcode", { length: 100 }),
  stockCount: integer("stock_count").default(0).notNull(),
  minStockLevel: integer("min_stock_level").default(10).notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(), // unit price in EGP
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalMedEnIdx: uniqueIndex("med_hospital_name_en_idx").on(table.hospitalId, sql`lower(${table.nameEn})`).where(sql`name_en IS NOT NULL AND name_en != ''`),
    hospitalMedArIdx: uniqueIndex("med_hospital_name_ar_idx").on(table.hospitalId, table.nameAr).where(sql`name_ar IS NOT NULL AND name_ar != ''`),
    barcodeIdx: index("med_barcode_idx").on(table.barcode),
  };
}).enableRLS();

export const prescriptions = pgTable("prescriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  doctorId: uuid("doctor_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  admissionId: uuid("admission_id").references(() => admissions.id, { onDelete: "set null" }),
  status: varchar("status", { length: 50 }).default("active").notNull(), // active, completed, cancelled
  notes: text("notes"),
  hasDdiOverride: boolean("has_ddi_override").default(false).notNull(),
  ddiOverrideReason: text("ddi_override_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalPatIdx: index("rx_hospital_patient_idx").on(table.hospitalId, table.patientId),
  };
}).enableRLS();

export const prescriptionItems = pgTable("prescription_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  prescriptionId: uuid("prescription_id").references(() => prescriptions.id, { onDelete: "cascade" }).notNull(),
  medicationId: uuid("medication_id").references(() => medications.id, { onDelete: "restrict" }).notNull(),
  dosage: text("dosage").notNull(), // e.g. "1 tablet"
  frequency: text("frequency").notNull(), // e.g. "three times daily"
  durationDays: integer("duration_days").notNull(),
  instructions: text("instructions"),
  dispensedCount: integer("dispensed_count").default(0).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, dispensed, partial, cancelled
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    prescriptionIdIdx: index("rxi_prescription_idx").on(table.prescriptionId),
    hospitalIdx: index("rxi_hospital_idx").on(table.hospitalId),
  };
}).enableRLS();

export const stockTransactions = pgTable("stock_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  medicationId: uuid("medication_id").references(() => medications.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // stock_in, dispense, return, adjustment, waste
  quantity: integer("quantity").notNull(), // positive for additions, negative for dispensations
  notes: text("notes"),
  performedBy: uuid("performed_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalMedTxIdx: index("stock_hospital_med_idx").on(table.hospitalId, table.medicationId),
  };
}).enableRLS();

export const medicationInteractions = pgTable("medication_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  drug1Name: text("drug1_name").notNull(),
  drug2Name: text("drug2_name").notNull(),
  drug1Generic: text("drug1_generic"),
  drug2Generic: text("drug2_generic"),
  severity: varchar("severity", { length: 50 }).notNull(), // mild, moderate, severe, contraindicated
  mechanismEn: text("mechanism_en"),
  mechanismAr: text("mechanism_ar"),
  clinicalEffectEn: text("clinical_effect_en"),
  clinicalEffectAr: text("clinical_effect_ar"),
  managementAr: text("management_ar"),
  category: text("category"),
  source: text("source"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    exactDrugMatchIdx: index("ddi_exact_drugs_idx").on(table.drug1Name, table.drug2Name),
    genericDrugMatchIdx: index("ddi_generic_drugs_idx").on(table.drug1Generic, table.drug2Generic),
  };
});

export const drugAllergyCrossReferences = pgTable("drug_allergy_cross_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  allergenName: text("allergen_name").notNull(),
  crossReactingDrugs: text("cross_reacting_drugs").array().notNull(), // e.g. ["Amoxicillin", "Ampicillin"]
  crossReactionSeverity: varchar("cross_reaction_severity", { length: 50 }),
  notesAr: text("notes_ar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    allergenIdx: index("allergy_name_idx").on(table.allergenName),
  };
});
