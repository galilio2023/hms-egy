CREATE TABLE "handover_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"admission_id" uuid NOT NULL,
	"from_staff_id" uuid NOT NULL,
	"to_staff_id" uuid,
	"department_id" uuid NOT NULL,
	"content" text NOT NULL,
	"priority" varchar(50) DEFAULT 'routine' NOT NULL,
	"is_acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handover_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nursing_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"admission_id" uuid,
	"recorded_by" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"data" jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nursing_assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shifts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medication_administration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"prescription_item_id" uuid NOT NULL,
	"administered_by" uuid,
	"scheduled_at" timestamp NOT NULL,
	"administered_at" timestamp,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"dose_given" text,
	"site" text,
	"route" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medication_administration" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "vit_hospital_patient_idx";--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "handover_notes" ADD CONSTRAINT "handover_notes_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_notes" ADD CONSTRAINT "handover_notes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_notes" ADD CONSTRAINT "handover_notes_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_notes" ADD CONSTRAINT "handover_notes_from_staff_id_staff_id_fk" FOREIGN KEY ("from_staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_notes" ADD CONSTRAINT "handover_notes_to_staff_id_staff_id_fk" FOREIGN KEY ("to_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_notes" ADD CONSTRAINT "handover_notes_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nursing_assessments" ADD CONSTRAINT "nursing_assessments_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nursing_assessments" ADD CONSTRAINT "nursing_assessments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nursing_assessments" ADD CONSTRAINT "nursing_assessments_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nursing_assessments" ADD CONSTRAINT "nursing_assessments_recorded_by_staff_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_administration" ADD CONSTRAINT "medication_administration_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_administration" ADD CONSTRAINT "medication_administration_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_administration" ADD CONSTRAINT "medication_administration_prescription_item_id_prescription_items_id_fk" FOREIGN KEY ("prescription_item_id") REFERENCES "public"."prescription_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_administration" ADD CONSTRAINT "medication_administration_administered_by_staff_id_fk" FOREIGN KEY ("administered_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "handover_hospital_patient_idx" ON "handover_notes" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "assessment_hospital_patient_idx" ON "nursing_assessments" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "assessment_hospital_type_idx" ON "nursing_assessments" USING btree ("hospital_id","type");--> statement-breakpoint
CREATE INDEX "shift_hospital_staff_idx" ON "shifts" USING btree ("hospital_id","staff_id");--> statement-breakpoint
CREATE INDEX "shift_hospital_dept_idx" ON "shifts" USING btree ("hospital_id","department_id");--> statement-breakpoint
CREATE INDEX "mar_hospital_patient_idx" ON "medication_administration" USING btree ("hospital_id","patient_id");--> statement-breakpoint
CREATE INDEX "mar_scheduled_at_idx" ON "medication_administration" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "mar_prescription_item_idx" ON "medication_administration" USING btree ("prescription_item_id");--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adm_hospital_dept_idx" ON "admissions" USING btree ("hospital_id","department_id");--> statement-breakpoint
CREATE INDEX "room_hospital_dept_idx" ON "rooms" USING btree ("hospital_id","department_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "handover_notes" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "nursing_assessments" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "shifts" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "medication_administration" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));