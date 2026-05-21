ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hospital_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "operating_rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "or_block_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "or_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "patient_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "beds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discharge_summaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medical_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vitals_flowsheet" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "waiting_list" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prescriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "critical_value_alerts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lab_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lab_tests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radiology_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radiology_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "insurance_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "online_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "anesthesia_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "surgical_cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "surgical_checklist_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "surgical_checklists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "data_retention_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "data_retention_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sent_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "departments" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "hospital_settings" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "operating_rooms" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "or_block_overrides" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "or_blocks" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "staff" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "patient_consents" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "patients" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "admissions" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "appointments" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "beds" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "discharge_summaries" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "medical_records" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "rooms" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "vitals_flowsheet" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "waiting_list" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "housekeeping_tasks" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "medications" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "prescriptions" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "stock_transactions" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "critical_value_alerts" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "lab_orders" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "lab_tests" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "radiology_orders" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "radiology_reports" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "insurance_claims" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "invoices" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "online_payments" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "payment_reminders" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "payments" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "anesthesia_records" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "surgical_cases" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "surgical_checklist_templates" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "surgical_checklists" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "ai_audit_logs" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "audit_logs" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "data_retention_logs" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "data_retention_policies" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "documents" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "notifications" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "sent_reminders" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.bypass_rls', true) = 'true') OR (hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid));