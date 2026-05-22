CREATE TABLE "internal_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"referring_doctor_id" uuid NOT NULL,
	"target_department_id" uuid NOT NULL,
	"target_doctor_id" uuid,
	"reason" text NOT NULL,
	"urgency" varchar(50) DEFAULT 'routine' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "internal_referrals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medical_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"certificate_type" varchar(50) DEFAULT 'sick_leave' NOT NULL,
	"diagnosis" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"rest_days" integer NOT NULL,
	"notes" text,
	"serial_number" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "medical_certificates_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
ALTER TABLE "medical_certificates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_sequence_tracker" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"sequence_name" varchar(100) NOT NULL,
	"current_val" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_seq_unique" UNIQUE("hospital_id","sequence_name")
);
--> statement-breakpoint
ALTER TABLE "tenant_sequence_tracker" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "med_hospital_name_idx";--> statement-breakpoint
DROP INDEX "lab_hospital_name_idx";--> statement-breakpoint
ALTER TABLE "internal_referrals" ADD CONSTRAINT "internal_referrals_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_referrals" ADD CONSTRAINT "internal_referrals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_referrals" ADD CONSTRAINT "internal_referrals_referring_doctor_id_staff_id_fk" FOREIGN KEY ("referring_doctor_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_referrals" ADD CONSTRAINT "internal_referrals_target_department_id_departments_id_fk" FOREIGN KEY ("target_department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_referrals" ADD CONSTRAINT "internal_referrals_target_doctor_id_staff_id_fk" FOREIGN KEY ("target_doctor_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_sequence_tracker" ADD CONSTRAINT "tenant_sequence_tracker_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ref_hospital_patient_idx" ON "internal_referrals" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "cert_hospital_patient_idx" ON "medical_certificates" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "app_hospital_date_idx" ON "appointments" USING btree ("hospital_id","scheduled_date","start_time");--> statement-breakpoint
CREATE UNIQUE INDEX "med_hospital_name_en_idx" ON "medications" USING btree ("hospital_id",lower("name_en")) WHERE name_en IS NOT NULL AND name_en != '';--> statement-breakpoint
CREATE UNIQUE INDEX "med_hospital_name_ar_idx" ON "medications" USING btree ("hospital_id","name_ar") WHERE name_ar IS NOT NULL AND name_ar != '';--> statement-breakpoint
CREATE UNIQUE INDEX "lab_hospital_name_en_idx" ON "lab_tests" USING btree ("hospital_id",lower("name_en")) WHERE name_en IS NOT NULL AND name_en != '';--> statement-breakpoint
CREATE UNIQUE INDEX "lab_hospital_name_ar_idx" ON "lab_tests" USING btree ("hospital_id","name_ar") WHERE name_ar IS NOT NULL AND name_ar != '';--> statement-breakpoint
CREATE INDEX "sc_hospital_date_idx" ON "surgical_cases" USING btree ("hospital_id","scheduled_date");--> statement-breakpoint
DROP POLICY "tenant_isolation_policy" ON "account" CASCADE;--> statement-breakpoint
DROP POLICY "tenant_isolation_policy" ON "session" CASCADE;--> statement-breakpoint
DROP POLICY "tenant_isolation_policy" ON "user" CASCADE;--> statement-breakpoint
DROP POLICY "tenant_isolation_policy" ON "verification" CASCADE;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "internal_referrals" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "medical_certificates" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "tenant_sequence_tracker" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));