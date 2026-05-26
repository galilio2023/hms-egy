CREATE INDEX "idx_meds_trgm_en" ON "medications" USING gin ("name_en" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_meds_trgm_ar" ON "medications" USING gin ("name_ar" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_meds_trgm_generic" ON "medications" USING gin ("generic_name" gin_trgm_ops);