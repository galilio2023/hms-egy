import { pgTable, text, uuid, timestamp, boolean, varchar, index, decimal } from "drizzle-orm/pg-core";
import { hospitals, staff } from "./core";
import { patients } from "./patients";
import { admissions } from "./clinical";

export const radiologyOrders = pgTable("radiology_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  doctorId: uuid("doctor_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  admissionId: uuid("admission_id").references(() => admissions.id, { onDelete: "set null" }),
  procedureNameAr: text("procedure_name_ar").notNull(),
  procedureNameEn: text("procedure_name_en").notNull(),
  cptCode: varchar("cpt_code", { length: 50 }),
  priority: varchar("priority", { length: 50 }).default("routine").notNull(), // routine, urgent, stat
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, scheduled, completed, cancelled
  clinicalNotes: text("clinical_notes"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(), // standard price in EGP
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalPatIdx: index("rado_hospital_patient_idx").on(table.hospitalId, table.patientId),
  };
});

export const radiologyReports = pgTable("radiology_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  radiologyOrderId: uuid("radiology_order_id").references(() => radiologyOrders.id, { onDelete: "cascade" }).notNull().unique(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  radiologistId: uuid("radiologist_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  findingsAr: text("findings_ar").notNull(),
  findingsEn: text("findings_en").notNull(),
  impressionAr: text("impression_ar").notNull(),
  impressionEn: text("impression_en").notNull(),
  imageUrl: text("image_url"), // URL link to the scanned images/artifacts
  isCritical: boolean("is_critical").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalReportIdx: index("radr_hospital_patient_idx").on(table.hospitalId, table.patientId),
  };
});
