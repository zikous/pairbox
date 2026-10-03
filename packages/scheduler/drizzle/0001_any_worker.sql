DROP INDEX "bookings_runtime_starts_at_index";--> statement-breakpoint
CREATE INDEX "bookings_starts_at_index" ON "bookings" USING btree ("starts_at");--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "runtime";