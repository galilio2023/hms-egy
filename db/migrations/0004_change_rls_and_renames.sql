-- 1. Rename column settledAt to settled_at in insurance_claims
ALTER TABLE "insurance_claims" RENAME COLUMN "settledAt" TO "settled_at";

-- 2. Enable RLS and create tenant isolation policies for invoice_items, prescription_items, lab_order_items
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "invoice_items";
CREATE POLICY "tenant_isolation_policy" ON "invoice_items" FOR ALL TO public USING (
  EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_id 
      AND ((current_setting('app.bypass_rls', true) = 'true') 
           OR invoices.hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)
  )
);

ALTER TABLE "prescription_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "prescription_items";
CREATE POLICY "tenant_isolation_policy" ON "prescription_items" FOR ALL TO public USING (
  EXISTS (
    SELECT 1 FROM prescriptions 
    WHERE prescriptions.id = prescription_id 
      AND ((current_setting('app.bypass_rls', true) = 'true') 
           OR prescriptions.hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)
  )
);

ALTER TABLE "lab_order_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "lab_order_items";
CREATE POLICY "tenant_isolation_policy" ON "lab_order_items" FOR ALL TO public USING (
  EXISTS (
    SELECT 1 FROM lab_orders 
    WHERE lab_orders.id = lab_order_id 
      AND ((current_setting('app.bypass_rls', true) = 'true') 
           OR lab_orders.hospital_id = NULLIF(current_setting('app.current_hospital_id', true), '')::uuid)
  )
);

-- 3. Programmatically execute FORCE ROW LEVEL SECURITY for all RLS-enabled tables
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        IF EXISTS (
            SELECT 1 
            FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = r.tablename 
              AND n.nspname = 'public' 
              AND c.relrowsecurity = true
        ) THEN
            EXECUTE format('ALTER TABLE "public".%I FORCE ROW LEVEL SECURITY;', r.tablename);
        END IF;
    END LOOP;
END $$;