-- Enable pg_trgm for autocomplete performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Functional indexes for Drug-Drug Interaction lookups (LOWER)
CREATE INDEX IF NOT EXISTS idx_ddi_lower_drug1_name ON medication_interactions (LOWER(drug1_name));
CREATE INDEX IF NOT EXISTS idx_ddi_lower_drug2_name ON medication_interactions (LOWER(drug2_name));
CREATE INDEX IF NOT EXISTS idx_ddi_lower_drug1_generic ON medication_interactions (LOWER(drug1_generic));
CREATE INDEX IF NOT EXISTS idx_ddi_lower_drug2_generic ON medication_interactions (LOWER(drug2_generic));

-- GIN Trigram indexes for medication search performance
CREATE INDEX IF NOT EXISTS idx_meds_trgm_en ON medications USING gin (name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_meds_trgm_ar ON medications USING gin (name_ar gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_meds_trgm_generic ON medications USING gin (generic_name gin_trgm_ops);
