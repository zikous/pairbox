-- Notes become one Markdown document per room. Keep the old list aside until 0006 copies it.
ALTER TABLE "notes" RENAME TO "notes_list_old";--> statement-breakpoint
ALTER TABLE "notes_list_old" RENAME CONSTRAINT "notes_room_id_rooms_id_fk" TO "notes_list_old_room_id_fk";
--> statement-breakpoint
ALTER INDEX "notes_pkey" RENAME TO "notes_list_old_pkey";
