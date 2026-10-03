ALTER TABLE "rooms" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
-- Rooms created before scheduling existed become past sessions.
UPDATE "rooms" SET "starts_at" = "created_at", "ends_at" = "created_at";--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "starts_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "ends_at" SET NOT NULL;
