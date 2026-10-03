-- A room now has a single recording: keep only the latest one of rooms recorded several times.
DELETE FROM "recordings" AS "older"
USING "recordings" AS "newer"
WHERE "older"."room_id" = "newer"."room_id" AND "older"."started_at" < "newer"."started_at";--> statement-breakpoint
DROP INDEX "recordings_room_id_index";--> statement-breakpoint
CREATE UNIQUE INDEX "recordings_room_id_index" ON "recordings" USING btree ("room_id");
