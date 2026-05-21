CREATE TYPE "public"."anesthesia_type" AS ENUM('general', 'regional', 'local', 'sedation', 'spinal', 'epidural');--> statement-breakpoint
CREATE TYPE "public"."asa_class" AS ENUM('asa_1', 'asa_2', 'asa_3', 'asa_4', 'asa_5', 'asa_e');--> statement-breakpoint
CREATE TYPE "public"."bed_status" AS ENUM('available', 'occupied', 'maintenance', 'reserved', 'quarantine', 'pending_cleaning');--> statement-breakpoint
CREATE TYPE "public"."checklist_item_status" AS ENUM('pending', 'completed', 'not_applicable', 'failed');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."hospital_type" AS ENUM('private', 'government', 'military', 'ngo');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_task_status" AS ENUM('pending', 'in_progress', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."online_payment_status" AS ENUM('initiated', 'pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'SURGEON', 'ANESTHESIOLOGIST', 'NURSE', 'OR_NURSE', 'PHARMACIST', 'LAB_TECH', 'RECEPTIONIST', 'HOUSEKEEPING');--> statement-breakpoint
CREATE TYPE "public"."surgical_case_status" AS ENUM('scheduled', 'pre_op', 'in_progress', 'post_op', 'completed', 'cancelled', 'postponed');--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"code" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospital_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"is_surgical_enabled" boolean DEFAULT false,
	"is_telemedicine_enabled" boolean DEFAULT false,
	"is_patient_portal_enabled" boolean DEFAULT false,
	"is_online_payments_enabled" boolean DEFAULT false,
	"timezone" text DEFAULT 'Africa/Cairo',
	"currency" text DEFAULT 'EGP',
	"paymob_api_key" text,
	"paymob_card_id" text,
	"paymob_wallet_id" text,
	"paymob_fawry_id" text,
	"paymob_hmac_secret" text,
	"or_cleaning_duration" integer DEFAULT 30 NOT NULL,
	"auto_housekeeping" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hospital_settings_hospital_id_unique" UNIQUE("hospital_id")
);
--> statement-breakpoint
CREATE TABLE "hospitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"slug" varchar(100) NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"address" text NOT NULL,
	"governorate" text NOT NULL,
	"type" "hospital_type" NOT NULL,
	"logo_url" text,
	"plan_tier" varchar(50) DEFAULT 'starter' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hospitals_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "operating_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"floor" text NOT NULL,
	"wing" text,
	"type" text NOT NULL,
	"equipment_list" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"cleaning_duration_minutes" integer DEFAULT 30 NOT NULL,
	"next_available_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "or_block_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"or_block_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"type" text NOT NULL,
	"reason" text NOT NULL,
	"new_start_time" text,
	"new_end_time" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "or_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"or_room_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"owning_doctor_id" uuid,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"block_name" text NOT NULL,
	"is_recurring" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"user_id" varchar(255),
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"role" "role" NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"license_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"version" varchar(10) NOT NULL,
	"is_signed" boolean DEFAULT false NOT NULL,
	"signed_at" timestamp,
	"signature_url" text,
	"witness_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_number" varchar(50) NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"national_id" varchar(14) NOT NULL,
	"dob" timestamp NOT NULL,
	"gender" "gender" NOT NULL,
	"contact_phone" text NOT NULL,
	"email" text,
	"address" text NOT NULL,
	"governorate" text NOT NULL,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"uhis_number" varchar(50),
	"uhis_governorate" text,
	"is_uhis_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"bed_id" uuid,
	"admitting_doctor_id" uuid NOT NULL,
	"admission_date" timestamp NOT NULL,
	"discharge_date" timestamp,
	"reason" text NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"cancellation_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"bed_number" varchar(50) NOT NULL,
	"status" "bed_status" DEFAULT 'available' NOT NULL,
	"last_discharged_at" timestamp,
	"cleaning_requested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discharge_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"admission_id" uuid NOT NULL,
	"discharging_doctor_id" uuid NOT NULL,
	"summary_ar" text NOT NULL,
	"summary_en" text NOT NULL,
	"discharge_condition" varchar(50) NOT NULL,
	"follow_up_instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discharge_summaries_admission_id_unique" UNIQUE("admission_id")
);
--> statement-breakpoint
CREATE TABLE "medical_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"encounter_type" varchar(50) NOT NULL,
	"symptoms" text,
	"diagnosis" text,
	"soap_notes" text,
	"icd_codes" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"room_number" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"floor" text NOT NULL,
	"wing" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vitals_flowsheet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"blood_pressure_systolic" integer,
	"blood_pressure_diastolic" integer,
	"heart_rate" integer,
	"respiratory_rate" integer,
	"temperature" numeric(4, 1),
	"oxygen_saturation" integer,
	"weight_kg" numeric(5, 2),
	"height_cm" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waiting_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"preferred_doctor_id" uuid,
	"priority" varchar(50) DEFAULT 'routine' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "housekeeping_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"bed_id" uuid,
	"room_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" "housekeeping_task_status" DEFAULT 'pending' NOT NULL,
	"priority" varchar(50) DEFAULT 'routine' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"assigned_to" uuid,
	"started_at" timestamp,
	"completed_at" timestamp,
	"completion_photo_url" text,
	"notes" text,
	"requested_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drug_allergy_cross_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"allergen_name" text NOT NULL,
	"cross_reacting_drugs" text[] NOT NULL,
	"cross_reaction_severity" varchar(50),
	"notes_ar" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drug1_name" text NOT NULL,
	"drug2_name" text NOT NULL,
	"drug1_generic" text,
	"drug2_generic" text,
	"severity" varchar(50) NOT NULL,
	"mechanism_en" text,
	"mechanism_ar" text,
	"clinical_effect_en" text,
	"clinical_effect_ar" text,
	"management_ar" text,
	"category" text,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"generic_name" text NOT NULL,
	"form" varchar(50) NOT NULL,
	"strength" varchar(50) NOT NULL,
	"barcode" varchar(100),
	"stock_count" integer DEFAULT 0 NOT NULL,
	"min_stock_level" integer DEFAULT 10 NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_id" uuid NOT NULL,
	"medication_id" uuid NOT NULL,
	"dosage" text NOT NULL,
	"frequency" text NOT NULL,
	"duration_days" integer NOT NULL,
	"instructions" text,
	"dispensed_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"admission_id" uuid,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"notes" text,
	"has_ddi_override" boolean DEFAULT false NOT NULL,
	"ddi_override_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"medication_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"notes" text,
	"performed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "critical_value_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"lab_order_item_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"notified_doctor_id" uuid NOT NULL,
	"notified_at" timestamp DEFAULT now() NOT NULL,
	"method" varchar(50) NOT NULL,
	"acknowledged_by_doctor" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "lab_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_order_id" uuid NOT NULL,
	"lab_test_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"result_value" text,
	"is_critical" boolean DEFAULT false NOT NULL,
	"result_recorded_by" uuid,
	"result_recorded_at" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "lab_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"admission_id" uuid,
	"priority" varchar(50) DEFAULT 'routine' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"clinical_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"loinc_code" varchar(50),
	"cpt_code" varchar(50),
	"normal_range" text,
	"unit" varchar(50),
	"price" numeric(12, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radiology_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"admission_id" uuid,
	"procedure_name_ar" text NOT NULL,
	"procedure_name_en" text NOT NULL,
	"cpt_code" varchar(50),
	"priority" varchar(50) DEFAULT 'routine' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"clinical_notes" text,
	"price" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radiology_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"radiology_order_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"radiologist_id" uuid NOT NULL,
	"findings_ar" text NOT NULL,
	"findings_en" text NOT NULL,
	"impression_ar" text NOT NULL,
	"impression_en" text NOT NULL,
	"image_url" text,
	"is_critical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "radiology_reports_radiology_order_id_unique" UNIQUE("radiology_order_id")
);
--> statement-breakpoint
CREATE TABLE "insurance_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"insurance_provider_id" varchar(100) NOT NULL,
	"policy_number" varchar(100) NOT NULL,
	"approval_code" varchar(100),
	"claim_amount" numeric(12, 2) NOT NULL,
	"copay_amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"settledAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description_ar" text NOT NULL,
	"description_en" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"type" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'unpaid' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"stamp_tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"due_date" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"paymob_order_id" varchar(100) NOT NULL,
	"paymob_transaction_id" varchar(100),
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'EGP' NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"status" "online_payment_status" DEFAULT 'initiated' NOT NULL,
	"paymob_token" text,
	"iframe_url" text,
	"callback_received_at" timestamp,
	"callback_payload" jsonb,
	"failure_reason" text,
	"refunded_at" timestamp,
	"refund_reference" varchar(100),
	"initiated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "online_payments_paymob_order_id_unique" UNIQUE("paymob_order_id"),
	CONSTRAINT "online_payments_paymob_transaction_id_unique" UNIQUE("paymob_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "payment_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"channel" varchar(50) NOT NULL,
	"reminder_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"transaction_reference" varchar(100),
	"received_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anesthesia_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"surgical_case_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"anesthesiologist_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"pre_assessment_date" timestamp,
	"asa_classification" "asa_class" NOT NULL,
	"npo_status" text,
	"pre_medication_given" text[],
	"induction_agents" text[],
	"maintenance_agents" text[],
	"intubation_type" varchar(50),
	"vascular_access" text[],
	"total_fluid_ml" integer,
	"blood_loss_estimate_ml" integer,
	"transfusion_products" text[],
	"vitals_trend" jsonb[],
	"airway_events" text,
	"anesthesia_start_time" timestamp,
	"anesthesia_end_time" timestamp,
	"recovery_score" integer,
	"complications" text,
	"post_op_pain_management" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "anesthesia_records_surgical_case_id_unique" UNIQUE("surgical_case_id")
);
--> statement-breakpoint
CREATE TABLE "surgical_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_number" varchar(50) NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"admission_id" uuid,
	"or_room_id" uuid NOT NULL,
	"lead_surgeon_id" uuid NOT NULL,
	"assistant_surgeon_ids" uuid[],
	"anesthesiologist_id" uuid,
	"scrub_nurse_id" uuid,
	"circulating_nurse_id" uuid,
	"department_id" uuid NOT NULL,
	"procedure_name" text NOT NULL,
	"procedure_name_ar" text NOT NULL,
	"cpt_code" varchar(50),
	"icd_diagnosis_codes" text[],
	"anesthesia_type" "anesthesia_type" NOT NULL,
	"asa_class" "asa_class" NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"scheduled_start_time" text NOT NULL,
	"estimated_duration_minutes" integer NOT NULL,
	"status" "surgical_case_status" DEFAULT 'scheduled' NOT NULL,
	"or_block_id" uuid,
	"actual_start_time" timestamp,
	"actual_end_time" timestamp,
	"cancellation_reason" text,
	"postponed_reason" text,
	"blood_loss_ml" integer,
	"transfusion_units" integer,
	"complications" text,
	"surgeon_notes" text,
	"anesthesia_notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "surgical_cases_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "surgical_checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_ar" text NOT NULL,
	"phase" varchar(50) NOT NULL,
	"items" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surgical_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"surgical_case_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"phase" varchar(50) NOT NULL,
	"template_id" uuid NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp,
	"status" "checklist_item_status" DEFAULT 'pending' NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"user_id" varchar(255),
	"feature_name" varchar(100) NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"cost_egp" numeric(12, 4),
	"prompt_text" text,
	"response_text" text,
	"has_error" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"user_id" varchar(255),
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100),
	"payload" jsonb,
	"ip_address" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"url" text NOT NULL,
	"size" integer,
	"uploaded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"user_id" varchar(255),
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"message_ar" text NOT NULL,
	"message_en" text NOT NULL,
	"type" varchar(50) DEFAULT 'info' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sent_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"reminder_type" varchar(50) NOT NULL,
	"channel" varchar(30) NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"patient_id" uuid,
	"user_id" varchar(255),
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_settings" ADD CONSTRAINT "hospital_settings_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operating_rooms" ADD CONSTRAINT "operating_rooms_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "or_block_overrides" ADD CONSTRAINT "or_block_overrides_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "or_block_overrides" ADD CONSTRAINT "or_block_overrides_or_block_id_or_blocks_id_fk" FOREIGN KEY ("or_block_id") REFERENCES "public"."or_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "or_block_overrides" ADD CONSTRAINT "or_block_overrides_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "or_blocks" ADD CONSTRAINT "or_blocks_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "or_blocks" ADD CONSTRAINT "or_blocks_or_room_id_operating_rooms_id_fk" FOREIGN KEY ("or_room_id") REFERENCES "public"."operating_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "or_blocks" ADD CONSTRAINT "or_blocks_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "or_blocks" ADD CONSTRAINT "or_blocks_owning_doctor_id_staff_id_fk" FOREIGN KEY ("owning_doctor_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_bed_id_beds_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."beds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_admitting_doctor_id_staff_id_fk" FOREIGN KEY ("admitting_doctor_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beds" ADD CONSTRAINT "beds_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beds" ADD CONSTRAINT "beds_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_discharging_doctor_id_staff_id_fk" FOREIGN KEY ("discharging_doctor_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitals_flowsheet" ADD CONSTRAINT "vitals_flowsheet_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitals_flowsheet" ADD CONSTRAINT "vitals_flowsheet_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitals_flowsheet" ADD CONSTRAINT "vitals_flowsheet_recorded_by_staff_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_preferred_doctor_id_staff_id_fk" FOREIGN KEY ("preferred_doctor_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_bed_id_beds_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."beds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assigned_to_staff_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_requested_by_staff_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_performed_by_staff_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critical_value_alerts" ADD CONSTRAINT "critical_value_alerts_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critical_value_alerts" ADD CONSTRAINT "critical_value_alerts_lab_order_item_id_lab_order_items_id_fk" FOREIGN KEY ("lab_order_item_id") REFERENCES "public"."lab_order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critical_value_alerts" ADD CONSTRAINT "critical_value_alerts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critical_value_alerts" ADD CONSTRAINT "critical_value_alerts_notified_doctor_id_staff_id_fk" FOREIGN KEY ("notified_doctor_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_order_items" ADD CONSTRAINT "lab_order_items_lab_order_id_lab_orders_id_fk" FOREIGN KEY ("lab_order_id") REFERENCES "public"."lab_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_order_items" ADD CONSTRAINT "lab_order_items_lab_test_id_lab_tests_id_fk" FOREIGN KEY ("lab_test_id") REFERENCES "public"."lab_tests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_order_items" ADD CONSTRAINT "lab_order_items_result_recorded_by_staff_id_fk" FOREIGN KEY ("result_recorded_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiology_orders" ADD CONSTRAINT "radiology_orders_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiology_orders" ADD CONSTRAINT "radiology_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiology_orders" ADD CONSTRAINT "radiology_orders_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiology_orders" ADD CONSTRAINT "radiology_orders_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiology_reports" ADD CONSTRAINT "radiology_reports_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiology_reports" ADD CONSTRAINT "radiology_reports_radiology_order_id_radiology_orders_id_fk" FOREIGN KEY ("radiology_order_id") REFERENCES "public"."radiology_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiology_reports" ADD CONSTRAINT "radiology_reports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiology_reports" ADD CONSTRAINT "radiology_reports_radiologist_id_staff_id_fk" FOREIGN KEY ("radiologist_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_staff_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anesthesia_records" ADD CONSTRAINT "anesthesia_records_surgical_case_id_surgical_cases_id_fk" FOREIGN KEY ("surgical_case_id") REFERENCES "public"."surgical_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anesthesia_records" ADD CONSTRAINT "anesthesia_records_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anesthesia_records" ADD CONSTRAINT "anesthesia_records_anesthesiologist_id_staff_id_fk" FOREIGN KEY ("anesthesiologist_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anesthesia_records" ADD CONSTRAINT "anesthesia_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_cases" ADD CONSTRAINT "surgical_cases_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_cases" ADD CONSTRAINT "surgical_cases_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_cases" ADD CONSTRAINT "surgical_cases_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_cases" ADD CONSTRAINT "surgical_cases_or_room_id_operating_rooms_id_fk" FOREIGN KEY ("or_room_id") REFERENCES "public"."operating_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_cases" ADD CONSTRAINT "surgical_cases_lead_surgeon_id_staff_id_fk" FOREIGN KEY ("lead_surgeon_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_cases" ADD CONSTRAINT "surgical_cases_anesthesiologist_id_staff_id_fk" FOREIGN KEY ("anesthesiologist_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_cases" ADD CONSTRAINT "surgical_cases_scrub_nurse_id_staff_id_fk" FOREIGN KEY ("scrub_nurse_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_cases" ADD CONSTRAINT "surgical_cases_circulating_nurse_id_staff_id_fk" FOREIGN KEY ("circulating_nurse_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_cases" ADD CONSTRAINT "surgical_cases_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_cases" ADD CONSTRAINT "surgical_cases_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_checklist_templates" ADD CONSTRAINT "surgical_checklist_templates_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_checklist_templates" ADD CONSTRAINT "surgical_checklist_templates_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_checklists" ADD CONSTRAINT "surgical_checklists_surgical_case_id_surgical_cases_id_fk" FOREIGN KEY ("surgical_case_id") REFERENCES "public"."surgical_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_checklists" ADD CONSTRAINT "surgical_checklists_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_checklists" ADD CONSTRAINT "surgical_checklists_template_id_surgical_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."surgical_checklist_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgical_checklists" ADD CONSTRAINT "surgical_checklists_completed_by_staff_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_staff_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_reminders" ADD CONSTRAINT "sent_reminders_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_reminders" ADD CONSTRAINT "sent_reminders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dept_hospital_idx" ON "departments" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "dept_code_idx" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE INDEX "gov_idx" ON "hospitals" USING btree ("governorate");--> statement-breakpoint
CREATE INDEX "active_idx" ON "hospitals" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "or_hospital_active_idx" ON "operating_rooms" USING btree ("hospital_id","is_active");--> statement-breakpoint
CREATE INDEX "obo_hospital_block_date_idx" ON "or_block_overrides" USING btree ("hospital_id","or_block_id","date");--> statement-breakpoint
CREATE INDEX "orb_hospital_room_idx" ON "or_blocks" USING btree ("hospital_id","or_room_id");--> statement-breakpoint
CREATE INDEX "orb_day_time_idx" ON "or_blocks" USING btree ("day_of_week","start_time");--> statement-breakpoint
CREATE INDEX "staff_hospital_idx" ON "staff" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "staff_email_idx" ON "staff" USING btree ("email");--> statement-breakpoint
CREATE INDEX "staff_role_idx" ON "staff" USING btree ("role");--> statement-breakpoint
CREATE INDEX "consent_patient_type_idx" ON "patient_consents" USING btree ("patient_id","type");--> statement-breakpoint
CREATE INDEX "pat_hospital_nid_idx" ON "patients" USING btree ("hospital_id","national_id");--> statement-breakpoint
CREATE INDEX "pat_hospital_num_idx" ON "patients" USING btree ("hospital_id","patient_number");--> statement-breakpoint
CREATE INDEX "pat_gov_idx" ON "patients" USING btree ("governorate");--> statement-breakpoint
CREATE INDEX "adm_hospital_patient_idx" ON "admissions" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "adm_hospital_bed_idx" ON "admissions" USING btree ("hospital_id","bed_id");--> statement-breakpoint
CREATE INDEX "app_hospital_doc_date_idx" ON "appointments" USING btree ("hospital_id","doctor_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "app_hospital_pat_idx" ON "appointments" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "bed_hospital_status_idx" ON "beds" USING btree ("hospital_id","status");--> statement-breakpoint
CREATE INDEX "med_hospital_patient_idx" ON "medical_records" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "room_hospital_number_idx" ON "rooms" USING btree ("hospital_id","room_number");--> statement-breakpoint
CREATE INDEX "vit_hospital_patient_idx" ON "vitals_flowsheet" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "wl_hospital_dept_idx" ON "waiting_list" USING btree ("hospital_id","department_id");--> statement-breakpoint
CREATE INDEX "hk_hospital_status_priority_idx" ON "housekeeping_tasks" USING btree ("hospital_id","status","priority");--> statement-breakpoint
CREATE INDEX "allergy_name_idx" ON "drug_allergy_cross_references" USING btree ("allergen_name");--> statement-breakpoint
CREATE INDEX "ddi_exact_drugs_idx" ON "medication_interactions" USING btree ("drug1_name","drug2_name");--> statement-breakpoint
CREATE INDEX "ddi_generic_drugs_idx" ON "medication_interactions" USING btree ("drug1_generic","drug2_generic");--> statement-breakpoint
CREATE INDEX "med_hospital_name_idx" ON "medications" USING btree ("hospital_id","name_en");--> statement-breakpoint
CREATE INDEX "med_barcode_idx" ON "medications" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "rxi_prescription_idx" ON "prescription_items" USING btree ("prescription_id");--> statement-breakpoint
CREATE INDEX "rx_hospital_patient_idx" ON "prescriptions" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "stock_hospital_med_idx" ON "stock_transactions" USING btree ("hospital_id","medication_id");--> statement-breakpoint
CREATE INDEX "crit_hospital_ack_idx" ON "critical_value_alerts" USING btree ("hospital_id","acknowledged_by_doctor");--> statement-breakpoint
CREATE INDEX "laboi_order_idx" ON "lab_order_items" USING btree ("lab_order_id");--> statement-breakpoint
CREATE INDEX "labo_hospital_patient_idx" ON "lab_orders" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "lab_hospital_name_idx" ON "lab_tests" USING btree ("hospital_id","name_en");--> statement-breakpoint
CREATE INDEX "lab_loinc_idx" ON "lab_tests" USING btree ("loinc_code");--> statement-breakpoint
CREATE INDEX "rado_hospital_patient_idx" ON "radiology_orders" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "radr_hospital_patient_idx" ON "radiology_reports" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "claim_hospital_status_idx" ON "insurance_claims" USING btree ("hospital_id","status");--> statement-breakpoint
CREATE INDEX "invi_invoice_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "inv_hospital_patient_idx" ON "invoices" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "inv_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "onp_order_idx" ON "online_payments" USING btree ("paymob_order_id");--> statement-breakpoint
CREATE INDEX "onp_tx_idx" ON "online_payments" USING btree ("paymob_transaction_id");--> statement-breakpoint
CREATE INDEX "onp_invoice_idx" ON "online_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "onp_status_idx" ON "online_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rem_hospital_invoice_idx" ON "payment_reminders" USING btree ("hospital_id","invoice_id");--> statement-breakpoint
CREATE INDEX "pay_hospital_invoice_idx" ON "payments" USING btree ("hospital_id","invoice_id");--> statement-breakpoint
CREATE INDEX "anes_hospital_patient_idx" ON "anesthesia_records" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "sc_hospital_or_date_idx" ON "surgical_cases" USING btree ("hospital_id","or_room_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "sc_hospital_surg_date_idx" ON "surgical_cases" USING btree ("hospital_id","lead_surgeon_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "sc_hospital_patient_idx" ON "surgical_cases" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "sct_hospital_phase_idx" ON "surgical_checklist_templates" USING btree ("hospital_id","phase");--> statement-breakpoint
CREATE INDEX "scl_case_phase_idx" ON "surgical_checklists" USING btree ("surgical_case_id","phase");--> statement-breakpoint
CREATE INDEX "ai_hospital_feature_idx" ON "ai_audit_logs" USING btree ("hospital_id","feature_name");--> statement-breakpoint
CREATE INDEX "audit_hospital_action_idx" ON "audit_logs" USING btree ("hospital_id","action");--> statement-breakpoint
CREATE INDEX "doc_hospital_patient_idx" ON "documents" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "notif_hospital_user_idx" ON "notifications" USING btree ("hospital_id","user_id");--> statement-breakpoint
CREATE INDEX "reminder_unique_send_idx" ON "sent_reminders" USING btree ("hospital_id","entity_type","entity_id","reminder_type","channel");