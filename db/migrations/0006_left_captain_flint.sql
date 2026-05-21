ALTER TABLE "prescription_items" ALTER COLUMN "hospital_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lab_order_items" ALTER COLUMN "hospital_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "hospital_id" DROP DEFAULT;