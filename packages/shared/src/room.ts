import { z } from "zod";
import { LanguageSchema } from "./language";

export const ROOM_NAME_MAX = 60;

export const RoomIdSchema = z.string().regex(/^[a-z0-9]{4,32}$/, "Invalid room id");
export type RoomId = z.infer<typeof RoomIdSchema>;

export const RoomSchema = z
  .object({
    id: RoomIdSchema,
    name: z.string(),
    language: LanguageSchema,
    createdAt: z.string().meta({ format: "date-time" }),
  })
  .meta({ id: "Room" });
export type Room = z.infer<typeof RoomSchema>;

/** Body of `POST /api/rooms`. */
export const CreateRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(ROOM_NAME_MAX),
    language: LanguageSchema,
  })
  .meta({ id: "CreateRoom" });
export type CreateRoom = z.infer<typeof CreateRoomSchema>;

/** Trims and collapses whitespace. Returns null when the name is unusable. */
export function normalizeRoomName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= ROOM_NAME_MAX ? name : null;
}
