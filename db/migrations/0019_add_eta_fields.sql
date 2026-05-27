ALTER TABLE "invoices" ADD COLUMN "eta_uuid" varchar(100);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "eta_status" varchar(50);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "eta_submission_id" varchar(100);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "eta_long_id" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "eta_internal_id" varchar(100);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "eta_error_message" text;--> statement-breakpoint
CREATE INDEX "hk_hospital_status_completed_idx" ON "housekeeping_tasks" USING btree ("hospital_id","status","completed_at");--> statement-breakpoint
CREATE INDEX "idx_ddi_trgm_d1_generic" ON "medication_interactions" USING gin ("drug1_generic" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ddi_trgm_d2_generic" ON "medication_interactions" USING gin ("drug2_generic" gin_trgm_ops);--> statement-breakpoint
ALTER POLICY "tenant_isolation_policy" ON "user" TO public USING ((current_setting('app.bypass_rls', true) = 'true') 
                 OR (hospital_id IS NULL AND NULLIF(current_setting('app.current_hospital_id', true), '') IS NULL)
                 OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));