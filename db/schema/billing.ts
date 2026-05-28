import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, varchar, index, decimal, integer, jsonb, boolean, unique , pgPolicy} from "drizzle-orm/pg-core";
import { hospitals, staff } from "./core";
import { patients } from "./patients";
import { onlinePaymentStatusEnum } from "./enums";

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("unpaid").notNull(), // unpaid, paid, partially_paid, cancelled, overdue
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(), // in EGP
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).default("0.00").notNull(), // 14% standard VAT (if applicable)
  stampTaxAmount: decimal("stamp_tax_amount", { precision: 12, scale: 2 }).default("0.00").notNull(), // 0.5% medical stamp tax
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).default("0.00").notNull(),
  dueDate: timestamp("due_date").notNull(),
  notes: text("notes"),
  isArchived: boolean("is_archived").default(false).notNull(),
  // ETA E-invoicing fields
  etaUuid: varchar("eta_uuid", { length: 100 }),
  etaStatus: varchar("eta_status", { length: 50 }), // submitted, valid, invalid, cancelled
  etaSyncStatus: varchar("eta_sync_status", { length: 20 }).default("pending").notNull(), // pending, synced, failed, rejected
  etaSubmissionId: varchar("eta_submission_id", { length: 100 }),
  etaLongId: varchar("eta_long_id", { length: 255 }),
  etaInternalId: varchar("eta_internal_id", { length: 100 }),
  etaErrorMessage: text("eta_error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalPatIdx: index("inv_hospital_patient_idx").on(table.hospitalId, table.patientId),
    hospitalInvoiceNumberUnique: unique("inv_hospital_number_unique").on(table.hospitalId, table.invoiceNumber),
    archivingIdx: index("inv_archiving_idx").on(table.hospitalId, table.isArchived, table.createdAt),
    etaUuidIdx: index("inv_eta_uuid_idx").on(table.etaUuid),
    etaSyncStatusIdx: index("inv_eta_sync_status_idx").on(table.hospitalId, table.etaSyncStatus),
  };
}).enableRLS();

export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  descriptionAr: text("description_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // consultation, lab, radiology, pharmacy, surgical_room, accommodation
  // ETA Compliance fields
  etaItemCode: varchar("eta_item_code", { length: 100 }), // GS1 or EGS code
  taxType: varchar("tax_type", { length: 10 }).default("T1"), // T1 (VAT), T4 (Withholding), etc.
  taxSubType: varchar("tax_sub_type", { length: 10 }).default("V009"), // V009 (Standard 14%), V002 (Export), etc.
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    invoiceIdIdx: index("invi_invoice_idx").on(table.invoiceId),
    hospitalIdx: index("invi_hospital_idx").on(table.hospitalId),
  };
}).enableRLS();

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // cash, card, insurance, instapay, online
  transactionReference: varchar("transaction_reference", { length: 100 }),
  receivedBy: uuid("received_by").references(() => staff.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalInvoiceIdx: index("pay_hospital_invoice_idx").on(table.hospitalId, table.invoiceId),
  };
}).enableRLS();

export const insuranceClaims = pgTable("insurance_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  insuranceProviderId: varchar("insurance_provider_id", { length: 100 }).notNull(), // Government, Allianz, MetLife, etc.
  policyNumber: varchar("policy_number", { length: 100 }).notNull(),
  approvalCode: varchar("approval_code", { length: 100 }),
  claimAmount: decimal("claim_amount", { precision: 12, scale: 2 }).notNull(),
  copayAmount: decimal("copay_amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, approved, rejected, paid
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalClaimIdx: index("claim_hospital_status_idx").on(table.hospitalId, table.status),
  };
}).enableRLS();

export const onlinePayments = pgTable("online_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "restrict" }).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  paymobOrderId: varchar("paymob_order_id", { length: 100 }).unique().notNull(),
  paymobTransactionId: varchar("paymob_transaction_id", { length: 100 }).unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("EGP").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // card, mobile_wallet, fawry
  status: onlinePaymentStatusEnum("status").default("initiated").notNull(),
  paymobToken: text("paymob_token"), // Paymob client payment key
  iframeUrl: text("iframe_url"), // Card checkout redirection URL
  callbackReceivedAt: timestamp("callback_received_at"),
  callbackPayload: jsonb("callback_payload"),
  failureReason: text("failure_reason"),
  refundedAt: timestamp("refunded_at"),
  refundReference: varchar("refund_reference", { length: 100 }),
  initiatedAt: timestamp("initiated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalIdIdx: index("onp_hospital_idx").on(table.hospitalId),
    orderIdx: index("onp_order_idx").on(table.paymobOrderId),
    txIdx: index("onp_tx_idx").on(table.paymobTransactionId),
    invoiceIdx: index("onp_invoice_idx").on(table.invoiceId),
    statusIdx: index("onp_status_idx").on(table.status),
  };
}).enableRLS();

export const paymentReminders = pgTable("payment_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  hospitalId: uuid("hospital_id").references(() => hospitals.id, { onDelete: "cascade" }).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  channel: varchar("channel", { length: 50 }).notNull(), // sms, email, push
  reminderType: varchar("reminder_type", { length: 50 }).notNull(), // due_today, overdue_3days, overdue_7days, overdue_30days
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIsolation: pgPolicy("tenant_isolation_policy", { for: "all", to: "public", using: sql`(current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)` }),
    hospitalInvoiceIdx: index("rem_hospital_invoice_idx").on(table.hospitalId, table.invoiceId),
  };
}).enableRLS();
