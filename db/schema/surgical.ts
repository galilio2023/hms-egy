import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, varchar, index, integer, jsonb, boolean, time , pgPolicy} from "drizzle-orm/pg-core";
import { hospitals, staff, departments, operatingRooms } from "./core";
import { patients } from "./patients";
import { admissions } from "./clinical";
import { anesthesiaTypeEnum, asaClassEnum, surgicalCaseStatusEnum, checklistItemStatusEnum } from "./enums";

export const surgicalCases = pgTable("surgical_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseNumber: varchar("case_number", { length: 50 }).unique().notNull(), // e.g. SC-YYYY-NNNNNN
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  admissionId: uuid("admission_id").references(() => admissions.id, { onDelete: "set null" }),
  orRoomId: uuid("or_room_id").references(() => operatingRooms.id, { onDelete: "restrict" }).notNull(),
  leadSurgeonId: uuid("lead_surgeon_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  assistantSurgeonIds: uuid("assistant_surgeon_ids").array(), // Array of assisting surgeon staff IDs
  anesthesiologistId: uuid("anesthesiologist_id").references(() => staff.id, { onDelete: "restrict" }),
  scrubNurseId: uuid("scrub_nurse_id").references(() => staff.id, { onDelete: "set null" }),
  circulatingNurseId: uuid("circulating_nurse_id").references(() => staff.id, { onDelete: "set null" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "restrict" }).notNull(),
  procedureName: text("procedure_name").notNull(),
  procedureNameAr: text("procedure_name_ar").notNull(),
  cptCode: varchar("cpt_code", { length: 50 }),
  icdDiagnosisCodes: text("icd_diagnosis_codes").array(),
  anesthesiaType: anesthesiaTypeEnum("anesthesia_type").notNull(),
  asaClass: asaClassEnum("asa_class").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  scheduledStartTime: time("scheduled_start_time").notNull(), // e.g. "08:30:00"
  estimatedDurationMinutes: integer("estimated_duration_minutes").notNull(),
  status: surgicalCaseStatusEnum("status").default("scheduled").notNull(),
  orBlockId: uuid("or_block_id"), // block schedule link (optional)
  actualStartTime: timestamp("actual_start_time"),
  actualEndTime: timestamp("actual_end_time"),
  cancellationReason: text("cancellation_reason"),
  postponedReason: text("postponed_reason"),
  bloodLossML: integer("blood_loss_ml"),
  transfusionUnits: integer("transfusion_units"),
  complications: text("complications"),
  surgeonNotes: text("surgeon_notes"),
  anesthesiaNotes: text("anesthesia_notes"),
  createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalOrDateIdx: index("sc_hospital_or_date_idx").on(table.hospitalId, table.orRoomId, table.scheduledDate),
    hospitalSurgDateIdx: index("sc_hospital_surg_date_idx").on(table.hospitalId, table.leadSurgeonId, table.scheduledDate),
    hospitalPatIdx: index("sc_hospital_patient_idx").on(table.hospitalId, table.patientId),
  };
});

export const surgicalChecklistTemplates = pgTable("surgical_checklist_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  phase: varchar("phase", { length: 50 }).notNull(), // pre_op_sign_in, time_out, sign_out
  items: jsonb("items").notNull(), // Template list items: [{id, itemAr: string, itemEn: string, requiresInitials: boolean, category: string}]
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalPhaseIdx: index("sct_hospital_phase_idx").on(table.hospitalId, table.phase),
  };
});

export const surgicalChecklists = pgTable("surgical_checklists", {
  id: uuid("id").primaryKey().defaultRandom(),
  surgicalCaseId: uuid("surgical_case_id").references(() => surgicalCases.id, { onDelete: "cascade" }).notNull(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  phase: varchar("phase", { length: 50 }).notNull(), // pre_op_sign_in, time_out, sign_out
  templateId: uuid("template_id").references(() => surgicalChecklistTemplates.id, { onDelete: "restrict" }).notNull(),
  completedBy: uuid("completed_by").references(() => staff.id, { onDelete: "set null" }),
  completedAt: timestamp("completed_at"),
  status: checklistItemStatusEnum("status").default("pending").notNull(),
  items: jsonb("items").notNull(), // Checklist values list: [{templateItemId, status: 'pending'|'completed'|'not_applicable'|'failed', initialsBy?: uuid, notes?: string}]
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalIdIdx: index("scl_hospital_idx").on(table.hospitalId),
    casePhaseIdx: index("scl_case_phase_idx").on(table.surgicalCaseId, table.phase),
  };
});

export const anesthesiaRecords = pgTable("anesthesia_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  surgicalCaseId: uuid("surgical_case_id").references(() => surgicalCases.id, { onDelete: "cascade" }).notNull().unique(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  anesthesiologistId: uuid("anesthesiologist_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  preAssessmentDate: timestamp("pre_assessment_date"),
  asaClassification: asaClassEnum("asa_classification").notNull(),
  npoStatus: text("npo_status"), // last oral intake record
  preMedicationGiven: text("pre_medication_given").array(),
  inductionAgents: text("induction_agents").array(),
  maintenanceAgents: text("maintenance_agents").array(),
  intubationType: varchar("intubation_type", { length: 50 }), // none, ett, lma, spinal, epidural
  vascularAccess: text("vascular_access").array(), // e.g. ["18G IV right hand"]
  totalFluidML: integer("total_fluid_ml"),
  bloodLossEstimateML: integer("blood_loss_estimate_ml"),
  transfusionProducts: text("transfusion_products").array(),
  vitalsTrend: jsonb("vitals_trend"), // intraoperative vitals snapshots: [{time: timestamp, bp_systolic: int, bp_diastolic: int, hr: int, spo2: int}]
  airwayEvents: text("airway_events"),
  anesthesiaStartTime: timestamp("anesthesia_start_time"),
  anesthesiaEndTime: timestamp("anesthesia_end_time"),
  recoveryScore: integer("recovery_score"), // Aldrete score (0-10) for extubation readiness
  complications: text("complications"),
  postOpPainManagement: text("post_op_pain_management"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalPatientIdx: index("anes_hospital_patient_idx").on(table.hospitalId, table.patientId),
  };
});
