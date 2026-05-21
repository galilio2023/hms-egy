CREATE TABLE "data_retention_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"archived_count" integer NOT NULL,
	"cutoff_date" timestamp NOT NULL,
	"performed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"clinical_retention_years" integer DEFAULT 10 NOT NULL,
	"financial_retention_years" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "data_retention_policies_hospital_id_unique" UNIQUE("hospital_id")
);
--> statement-breakpoint
DROP INDEX "pat_hospital_nid_idx";--> statement-breakpoint
DROP INDEX "inv_number_idx";--> statement-breakpoint
DROP INDEX "reminder_unique_send_idx";--> statement-breakpoint
ALTER TABLE "or_block_overrides" ALTER COLUMN "new_start_time" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "or_block_overrides" ALTER COLUMN "new_end_time" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "or_blocks" ALTER COLUMN "start_time" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "or_blocks" ALTER COLUMN "end_time" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "start_time" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "end_time" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "anesthesia_records" ALTER COLUMN "vitals_trend" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "surgical_cases" ALTER COLUMN "scheduled_start_time" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "data_retention_logs" ADD CONSTRAINT "data_retention_logs_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_retention_logs" ADD CONSTRAINT "data_retention_logs_performed_by_staff_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "retention_log_hospital_idx" ON "data_retention_logs" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "retention_policy_hospital_idx" ON "data_retention_policies" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "consent_hospital_idx" ON "patient_consents" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "dis_hospital_idx" ON "discharge_summaries" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "onp_hospital_idx" ON "online_payments" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "scl_hospital_idx" ON "surgical_checklists" USING btree ("hospital_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_unique_send_idx" ON "sent_reminders" USING btree ("hospital_id","entity_type","entity_id","reminder_type","channel");--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "pat_hospital_nid_unique" UNIQUE("hospital_id","national_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "inv_hospital_number_unique" UNIQUE("hospital_id","invoice_number");