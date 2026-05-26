ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD COLUMN "prescribed_quantity" integer;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "user" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));