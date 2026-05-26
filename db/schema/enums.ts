import { pgEnum } from "drizzle-orm/pg-core";

export const hospitalTypeEnum = pgEnum("hospital_type", ["private", "government", "military", "ngo"]);

export const bedStatusEnum = pgEnum("bed_status", [
  "available",
  "occupied",
  "maintenance",
  "reserved",
  "quarantine",
  "pending_cleaning"
]);

export const housekeepingTaskStatusEnum = pgEnum("housekeeping_task_status", [
  "pending",
  "in_progress",
  "completed",
  "skipped"
]);

export const anesthesiaTypeEnum = pgEnum("anesthesia_type", [
  "general",
  "regional",
  "local",
  "sedation",
  "spinal",
  "epidural"
]);

export const surgicalCaseStatusEnum = pgEnum("surgical_case_status", [
  "scheduled",
  "pre_op",
  "in_progress",
  "post_op",
  "completed",
  "cancelled",
  "postponed"
]);

export const asaClassEnum = pgEnum("asa_class", [
  "asa_1",
  "asa_2",
  "asa_3",
  "asa_4",
  "asa_5",
  "asa_e"
]);

export const onlinePaymentStatusEnum = pgEnum("online_payment_status", [
  "initiated",
  "pending",
  "paid",
  "failed",
  "refunded"
]);

export const checklistItemStatusEnum = pgEnum("checklist_item_status", [
  "pending",
  "completed",
  "not_applicable",
  "failed"
]);

export const genderEnum = pgEnum("gender", ["male", "female"]);

export const roleEnum = pgEnum("role", [
  "SUPER_ADMIN",
  "ADMIN",
  "ACCOUNTANT",
  "DOCTOR",
  "SURGEON",
  "ANESTHESIOLOGIST",
  "NURSE",
  "OR_NURSE",
  "PHARMACIST",
  "LAB_TECH",
  "RECEPTIONIST",
  "HOUSEKEEPING"
]);
