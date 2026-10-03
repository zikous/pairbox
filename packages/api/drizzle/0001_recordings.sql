CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recordings_room_id_index" ON "recordings" USING btree ("room_id");