CREATE TABLE "notes" (
	"room_id" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Each room's earlier notes become a bullet list, in the order of the moments they were about.
INSERT INTO "notes" ("room_id", "body", "updated_at")
SELECT "room_id", string_agg('- ' || "body", E'\n' ORDER BY "at", "created_at"), max("created_at")
FROM "notes_list_old"
GROUP BY "room_id";--> statement-breakpoint
DROP TABLE "notes_list_old";
