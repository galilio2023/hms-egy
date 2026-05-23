ALTER TABLE "medical_certificates" DROP CONSTRAINT "medical_certificates_serial_number_unique";--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "normalized_name_ar" text NOT NULL;--> statement-breakpoint
CREATE INDEX "pat_normalized_name_ar_idx" ON "patients" USING btree ("normalized_name_ar");--> statement-breakpoint
CREATE UNIQUE INDEX "cert_hospital_serial_idx" ON "medical_certificates" USING btree ("hospital_id","serial_number");--> statement-breakpoint
CREATE INDEX "vitals_patient_recorded_idx" ON "vitals_flowsheet" USING btree ("patient_id","recorded_at" DESC NULLS LAST);