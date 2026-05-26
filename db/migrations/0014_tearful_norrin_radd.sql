CREATE INDEX "idx_ddi_lower_drug1_name" ON "medication_interactions" USING btree (lower("drug1_name"));--> statement-breakpoint
CREATE INDEX "idx_ddi_lower_drug2_name" ON "medication_interactions" USING btree (lower("drug2_name"));--> statement-breakpoint
CREATE INDEX "idx_ddi_lower_drug1_generic" ON "medication_interactions" USING btree (lower("drug1_generic"));--> statement-breakpoint
CREATE INDEX "idx_ddi_lower_drug2_generic" ON "medication_interactions" USING btree (lower("drug2_generic"));--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "stock_count_non_negative" CHECK (stock_count >= 0);