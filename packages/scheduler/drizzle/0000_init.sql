CREATE TABLE "bookings" (
	"room_id" text PRIMARY KEY NOT NULL,
	"runtime" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bookings_runtime_starts_at_index" ON "bookings" USING btree ("runtime","starts_at");