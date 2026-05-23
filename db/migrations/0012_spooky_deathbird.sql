ALTER TABLE "patients" ADD COLUMN "allergies" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "chronic_conditions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "blood_type" varchar(5);