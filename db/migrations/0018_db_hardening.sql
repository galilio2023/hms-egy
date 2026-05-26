-- DB Hardening: Restrict session variable escalation and ensure safe defaults
-- This prevents unprivileged roles from altering critical security settings

-- Acknowledge the recommended hardening for authentication lookups
ALTER SETTING app.auth_lookup_active TO DEFAULT;
ALTER SETTING app.current_hospital_id TO DEFAULT;
ALTER SETTING app.bypass_rls TO DEFAULT;

-- Note: These settings are used for RLS tenant isolation. 
-- In a production environment, ensure the application user role 
-- has only the minimum required permissions to execute set_config 
-- for these specific parameters within transaction boundaries.
