import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, boolean, varchar, index, integer, decimal, time , pgPolicy} from "drizzle-orm/pg-core";
import { hospitals, departments, staff } from "./core";
import { patients } from "./patients";
import { bedStatusEnum } from "./enums";

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  roomNumber: varchar("room_number", { length: 50 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // general, icu, pediatric, isolation, standard
  floor: text("floor").notNull(),
  wing: text("wing"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalRoomIdx: index("room_hospital_number_idx").on(table.hospitalId, table.roomNumber),
  };
}).enableRLS();

export const beds = pgTable("beds", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }).notNull(),
  bedNumber: varchar("bed_number", { length: 50 }).notNull(),
  status: bedStatusEnum("status").default("available").notNull(),
  lastDischargedAt: timestamp("last_discharged_at"),
  cleaningRequestedAt: timestamp("cleaning_requested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalStatusIdx: index("bed_hospital_status_idx").on(table.hospitalId, table.status),
  };
}).enableRLS();

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  doctorId: uuid("doctor_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "restrict" }).notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  startTime: time("start_time").notNull(), // e.g. "09:30:00"
  endTime: time("end_time").notNull(), // e.g. "10:00:00"
  type: varchar("type", { length: 50 }).notNull(), // checkup, consultation, follow_up, procedure
  status: varchar("status", { length: 50 }).default("scheduled").notNull(), // scheduled, completed, cancelled, no_show
  cancellationReason: text("cancellation_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalDocDateIdx: index("app_hospital_doc_date_idx").on(table.hospitalId, table.doctorId, table.scheduledDate),
    hospitalPatIdx: index("app_hospital_pat_idx").on(table.hospitalId, table.patientId),
    hospitalDateIdx: index("idx_appointments_tenant_date").on(table.hospitalId, table.scheduledDate, table.startTime),
  };
}).enableRLS();

export const waitingList = pgTable("waiting_list", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "restrict" }).notNull(),
  preferredDoctorId: uuid("preferred_doctor_id").references(() => staff.id, { onDelete: "set null" }),
  priority: varchar("priority", { length: 50 }).default("routine").notNull(), // routine, urgent, emergency
  status: varchar("status", { length: 50 }).default("active").notNull(), // active, scheduled, removed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalWaitingIdx: index("wl_hospital_dept_idx").on(table.hospitalId, table.departmentId),
  };
}).enableRLS();

export const admissions = pgTable("admissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  bedId: uuid("bed_id").references(() => beds.id, { onDelete: "set null" }),
  admittingDoctorId: uuid("admitting_doctor_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  admissionDate: timestamp("admission_date").notNull(),
  dischargeDate: timestamp("discharge_date"),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 50 }).default("active").notNull(), // active, discharged, transferred
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalAdmissionIdx: index("adm_hospital_patient_idx").on(table.hospitalId, table.patientId),
    hospitalBedIdx: index("adm_hospital_bed_idx").on(table.hospitalId, table.bedId),
  };
}).enableRLS();

export const dischargeSummaries = pgTable("discharge_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  admissionId: uuid("admission_id").references(() => admissions.id, { onDelete: "restrict" }).notNull().unique(),
  dischargingDoctorId: uuid("discharging_doctor_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  summaryAr: text("summary_ar").notNull(),
  summaryEn: text("summary_en").notNull(),
  dischargeCondition: varchar("discharge_condition", { length: 50 }).notNull(), // stable, improved, referred, deceased
  followUpInstructions: text("follow_up_instructions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalIdIdx: index("dis_hospital_idx").on(table.hospitalId),
  };
}).enableRLS();

export const medicalRecords = pgTable("medical_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  doctorId: uuid("doctor_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  encounterType: varchar("encounter_type", { length: 50 }).notNull(), // outpatient, inpatient, emergency
  symptoms: text("symptoms"),
  diagnosis: text("diagnosis"),
  soapNotes: text("soap_notes"), // Clinical SOAP notes format
  icdCodes: text("icd_codes").array(), // List of associated ICD-10 diagnosis codes
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalMedicalIdx: index("med_hospital_patient_idx").on(table.hospitalId, table.patientId),
    archivingIdx: index("med_archiving_idx").on(table.hospitalId, table.isArchived, table.createdAt),
  };
}).enableRLS();

export const vitalsFlowsheet = pgTable("vitals_flowsheet", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  recordedBy: uuid("recorded_by").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  recordedAt: timestamp("recorded_at").notNull(),
  bloodPressureSystolic: integer("blood_pressure_systolic"),
  bloodPressureDiastolic: integer("blood_pressure_diastolic"),
  heartRate: integer("heart_rate"),
  respiratoryRate: integer("respiratory_rate"),
  temperature: decimal("temperature", { precision: 4, scale: 1 }), // e.g. 37.5
  oxygenSaturation: integer("oxygen_saturation"), // percentage
  weightKg: decimal("weight_kg", { precision: 5, scale: 2 }), // e.g. 72.50
  heightCm: integer("height_cm"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalVitalsIdx: index("vit_hospital_patient_idx").on(table.hospitalId, table.patientId),
  };
}).enableRLS();
