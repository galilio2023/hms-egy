import { pgTable, text, uuid, timestamp, boolean, varchar, index, integer, jsonb, decimal } from "drizzle-orm/pg-core";
import { hospitals, staff } from "./core";
import { patients } from "./patients";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id", { length: 255 }), // auth recipient user
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  messageAr: text("message_ar").notNull(),
  messageEn: text("message_en").notNull(),
  type: varchar("type", { length: 50 }).default("info").notNull(), // info, success, warning, error, critical
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalUserIdx: index("notif_hospital_user_idx").on(table.hospitalId, table.userId),
  };
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // lab_report, consent_form, radiology_scan, prescription_pdf, identity_scan
  url: text("url").notNull(), // Object storage link
  size: integer("size"), // size in bytes
  uploadedBy: uuid("uploaded_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalPatIdx: index("doc_hospital_patient_idx").on(table.hospitalId, table.patientId),
  };
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id", { length: 255 }), // user who performed action
  action: varchar("action", { length: 100 }).notNull(), // create_patient, view_medical_records, update_settings
  entityType: varchar("entity_type", { length: 50 }).notNull(), // patient, medical_record, settings
  entityId: varchar("entity_id", { length: 100 }), // exact target entity
  payload: jsonb("payload"), // complete log context
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalActionIdx: index("audit_hospital_action_idx").on(table.hospitalId, table.action),
  };
});

export const aiAuditLogs = pgTable("ai_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id", { length: 255 }), // invoking staff user
  featureName: varchar("feature_name", { length: 100 }).notNull(), // clinical_summary, interaction_check
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  costEgp: decimal("cost_egp", { precision: 12, scale: 4 }), // approximate api cost
  promptText: text("prompt_text"),
  responseText: text("response_text"),
  hasError: boolean("has_error").default(false).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalFeatureIdx: index("ai_hospital_feature_idx").on(table.hospitalId, table.featureName),
  };
});

export const sentReminders = pgTable("sent_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(), // appointment, invoice, waiting_list
  entityId: uuid("entity_id").notNull(),
  reminderType: varchar("reminder_type", { length: 50 }).notNull(), // 24h_reminder, overdue_3days, loinc_ready
  channel: varchar("channel", { length: 30 }).notNull(), // sms, email, push, in_app
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }),
  userId: varchar("user_id", { length: 255 }),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("error_message"),
}, (table) => {
  return {
    // Composite unique index to completely prevent duplicate reminder notifications
    reminderUniqueKey: index("reminder_unique_send_idx").on(
      table.hospitalId,
      table.entityType,
      table.entityId,
      table.reminderType,
      table.channel
    ),
  };
});

export const dataRetentionPolicies = pgTable("data_retention_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull().unique(),
  clinicalRetentionYears: integer("clinical_retention_years").default(10).notNull(),
  financialRetentionYears: integer("financial_retention_years").default(5).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalIdx: index("retention_policy_hospital_idx").on(table.hospitalId),
  };
});

export const dataRetentionLogs = pgTable("data_retention_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  archivedCount: integer("archived_count").notNull(),
  cutoffDate: timestamp("cutoff_date").notNull(),
  performedBy: uuid("performed_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    hospitalLogIdx: index("retention_log_hospital_idx").on(table.hospitalId),
  };
});

