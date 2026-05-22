import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, boolean, varchar, index, uniqueIndex, decimal , pgPolicy} from "drizzle-orm/pg-core";
import { hospitals, staff } from "./core";
import { patients } from "./patients";
import { admissions } from "./clinical";

export const labTests = pgTable("lab_tests", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  loincCode: varchar("loinc_code", { length: 50 }),
  cptCode: varchar("cpt_code", { length: 50 }),
  normalRange: text("normal_range"),
  unit: varchar("unit", { length: 50 }),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(), // standard price in EGP
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalTestEnIdx: uniqueIndex("lab_hospital_name_en_idx").on(table.hospitalId, sql`lower(${table.nameEn})`).where(sql`name_en IS NOT NULL AND name_en != ''`),
    hospitalTestArIdx: uniqueIndex("lab_hospital_name_ar_idx").on(table.hospitalId, sql`lower(${table.nameAr})`).where(sql`name_ar IS NOT NULL AND name_ar != ''`),
    loincIdx: index("lab_loinc_idx").on(table.loincCode),
  };
}).enableRLS();

export const labOrders = pgTable("lab_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  doctorId: uuid("doctor_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  admissionId: uuid("admission_id").references(() => admissions.id, { onDelete: "set null" }),
  priority: varchar("priority", { length: 50 }).default("routine").notNull(), // routine, urgent, stat
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, collected, processing, completed, cancelled
  clinicalNotes: text("clinical_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalPatIdx: index("labo_hospital_patient_idx").on(table.hospitalId, table.patientId),
  };
}).enableRLS();

export const labOrderItems = pgTable("lab_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  labOrderId: uuid("lab_order_id").references(() => labOrders.id, { onDelete: "cascade" }).notNull(),
  labTestId: uuid("lab_test_id").references(() => labTests.id, { onDelete: "restrict" }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, collected, completed
  resultValue: text("result_value"),
  isCritical: boolean("is_critical").default(false).notNull(),
  resultRecordedBy: uuid("result_recorded_by").references(() => staff.id, { onDelete: "set null" }),
  resultRecordedAt: timestamp("result_recorded_at"),
  notes: text("notes"),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    labOrderIdIdx: index("laboi_order_idx").on(table.labOrderId),
    hospitalIdx: index("laboi_hospital_idx").on(table.hospitalId),
  };
}).enableRLS();

export const criticalValueAlerts = pgTable("critical_value_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  labOrderItemId: uuid("lab_order_item_id").references(() => labOrderItems.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  notifiedDoctorId: uuid("notified_doctor_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  notifiedAt: timestamp("notified_at").defaultNow().notNull(),
  method: varchar("method", { length: 50 }).notNull(), // call, sms, in_app
  acknowledgedByDoctor: boolean("acknowledged_by_doctor").default(false).notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  notes: text("notes"),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalAlertIdx: index("crit_hospital_ack_idx").on(table.hospitalId, table.acknowledgedByDoctor),
  };
}).enableRLS();
