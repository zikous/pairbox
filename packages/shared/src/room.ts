import { z } from "zod";
import { RuntimeSchema } from "./runtime";

export const ROOM_NAME_MAX = 60;

export const RoomIdSchema = z.string().regex(/^[a-z0-9]{4,32}$/, "Invalid room id");
export type RoomId = z.infer<typeof RoomIdSchema>;

export const RoomSchema = z
  .object({
    id: RoomIdSchema,
    name: z.string(),
    runtime: RuntimeSchema,
    createdAt: z.string().meta({ format: "date-time" }),
  })
  .meta({ id: "Room" });
export type Room = z.infer<typeof RoomSchema>;

/** Body of `POST /api/rooms`. */
export const CreateRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(ROOM_NAME_MAX),
    runtime: RuntimeSchema,
  })
  .meta({ id: "CreateRoom" });
export type CreateRoom = z.infer<typeof CreateRoomSchema>;

/** Body of `GET /api/share`: where invite links should point. */
export const ShareInfoSchema = z
  .object({
    /** Public address of the app, or null to use the address it was opened on. */
    baseUrl: z.url().nullable(),
    /** True while a tunnel is starting and its address isn't known yet: ask again shortly. */
    pending: z.boolean(),
  })
  .meta({ id: "ShareInfo" });
export type ShareInfo = z.infer<typeof ShareInfoSchema>;

/** Trims and collapses whitespace. Returns null when the name is unusable. */
export function normalizeRoomName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= ROOM_NAME_MAX ? name : null;
}
