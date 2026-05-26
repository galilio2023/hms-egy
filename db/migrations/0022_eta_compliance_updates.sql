ALTER TABLE "hospital_settings" ADD COLUMN "eta_client_id" text;--> statement-breakpoint
ALTER TABLE "hospital_settings" ADD COLUMN "eta_client_secret" text;--> statement-breakpoint
ALTER TABLE "hospital_settings" ADD COLUMN "eta_taxpayer_activity_code" varchar(20) DEFAULT '8610';--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "building_number" varchar(20);--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "street" varchar(200);--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "district" varchar(100);--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "eta_item_code" varchar(100);--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "tax_type" varchar(10) DEFAULT 'T1';--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "tax_sub_type" varchar(10) DEFAULT 'V009';