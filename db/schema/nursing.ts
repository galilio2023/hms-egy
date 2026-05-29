import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, boolean, varchar, index, jsonb, pgPolicy } from "drizzle-orm/pg-core";
import { hospitals, staff, departments } from "./core";
import { patients } from "./patients";
import { admissions } from "./clinical";

export const nursingAssessments = pgTable("nursing_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  admissionId: uuid("admission_id").references(() => admissions.id, { onDelete: "set null" }),
  recordedBy: uuid("recorded_by").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // initial, physical, fall_risk, braden, pain
  data: jsonb("data").notNull(), // Flexible assessment data
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { 
      for: "all", 
      to: "public", 
      using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` 
    }),
    hospitalPatientIdx: index("assessment_hospital_patient_idx").on(table.hospitalId, table.patientId),
    hospitalTypeIdx: index("assessment_hospital_type_idx").on(table.hospitalId, table.type),
  };
}).enableRLS();

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }).notNull(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "restrict" }).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  status: varchar("status", { length: 50 }).default("active").notNull(), // active, completed, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { 
      for: "all", 
      to: "public", 
      using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` 
    }),
    hospitalStaffIdx: index("shift_hospital_staff_idx").on(table.hospitalId, table.staffId),
    hospitalDeptIdx: index("shift_hospital_dept_idx").on(table.hospitalId, table.departmentId),
  };
}).enableRLS();

export const handoverNotes = pgTable("handover_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  admissionId: uuid("admission_id").references(() => admissions.id, { onDelete: "cascade" }).notNull(),
  fromStaffId: uuid("from_staff_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  toStaffId: uuid("to_staff_id").references(() => staff.id, { onDelete: "set null" }), // Can be null if generic department handover
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "restrict" }).notNull(),
  content: text("content").notNull(),
  priority: varchar("priority", { length: 50 }).default("routine").notNull(), // routine, urgent, emergency
  isAcknowledged: boolean("is_acknowledged").default(false).notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { 
      for: "all", 
      to: "public", 
      using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` 
    }),
    hospitalPatientIdx: index("handover_hospital_patient_idx").on(table.hospitalId, table.patientId),
  };
}).enableRLS();

export const shiftAssignments = pgTable("shift_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  shiftId: uuid("shift_id").references(() => shifts.id, { onDelete: "cascade" }).notNull(),

  // E.g., 'CHARGE_NURSE', 'PATHOLOGY_DISPATCHER', 'TRIAGE_LEAD', 'CODE_BLUE_CAPTAIN'
  assignmentCode: varchar("assignment_code", { length: 50 }).notNull(),

  // The scope of the assignment (e.g., Charge Nurse OF the ICU)
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "restrict" }),

  // Allows mid-shift handoffs
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", {
      for: "all",
      to: "public",
      using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)`
    }),
    hospitalShiftIdx: index("sa_hospital_shift_idx").on(table.hospitalId, table.shiftId),
    activeAssignmentIdx: index("sa_active_idx")
      .on(table.hospitalId, table.assignmentCode)
      .where(sql`released_at IS NULL`),
  };
}).enableRLS();
