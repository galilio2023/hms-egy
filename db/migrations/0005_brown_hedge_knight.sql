ALTER TABLE "prescription_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lab_order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "national_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "passport_number" varchar(50);--> statement-breakpoint
ALTER TABLE "prescription_items" ADD COLUMN "hospital_id" uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "lab_order_items" ADD COLUMN "hospital_id" uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "hospital_id" uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_order_items" ADD CONSTRAINT "lab_order_items_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rxi_hospital_idx" ON "prescription_items" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "laboi_hospital_idx" ON "lab_order_items" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "invi_hospital_idx" ON "invoice_items" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "notif_retention_idx" ON "notifications" USING btree ("hospital_id","created_at");--> statement-breakpoint
CREATE INDEX "reminder_retention_idx" ON "sent_reminders" USING btree ("hospital_id","sent_at");--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "pat_hospital_passport_unique" UNIQUE("hospital_id","passport_number");--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "prescription_items" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "lab_order_items" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "invoice_items" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_national_id_numeric_check" CHECK (national_id IS NULL OR national_id ~ '^[23][0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])(0[1-4]|1[1-9]|2[1-9]|3[1-5]|88)[0-9]{4}[0-9]$');--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_national_id_or_passport_check" CHECK (national_id IS NOT NULL OR passport_number IS NOT NULL);