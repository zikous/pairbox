import { z } from "zod";
import { ParticipantSchema } from "./participant";
import { RuntimeSchema } from "./runtime";

export const ROOM_NAME_MAX = 60;

export const RoomIdSchema = z.string().regex(/^[a-z0-9]{4,32}$/, "Invalid room id");
export type RoomId = z.infer<typeof RoomIdSchema>;

const DateTimeSchema = z.iso.datetime({ offset: true });

/** How long a session can be booked for, in minutes. */
export const SESSION_DURATIONS = [30, 60, 120, 180] as const;
/** The owner can open the room this long before it starts, to prepare. */
export const OWNER_EARLY_MINUTES = 10;

/** A room is one booked session: a time slot with its own link, code and terminal. */
export const RoomSchema = z
  .object({
    id: RoomIdSchema,
    name: z.string(),
    /** The language the code is in right now. Anyone in the room can switch it. */
    runtime: RuntimeSchema,
    startsAt: DateTimeSchema,
    endsAt: DateTimeSchema,
    createdAt: DateTimeSchema,
  })
  .meta({ id: "Room" });
export type Room = z.infer<typeof RoomSchema>;

/** An entry of `GET /api/rooms`: one of your sessions, with who took part in it. */
export const RoomSummarySchema = RoomSchema.extend({
  participants: z.array(ParticipantSchema),
}).meta({
  id: "RoomSummary",
});
export type RoomSummary = z.infer<typeof RoomSummarySchema>;

/** Body of `GET /api/rooms/:id`: the room, and whether you are its owner. */
export const RoomViewSchema = RoomSchema.extend({ owner: z.boolean() }).meta({ id: "RoomView" });
export type RoomView = z.infer<typeof RoomViewSchema>;

/** Body of `POST /api/rooms`: book a session. */
export const CreateRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(ROOM_NAME_MAX),
    startsAt: DateTimeSchema,
    durationMinutes: z.union(SESSION_DURATIONS.map((m) => z.literal(m))),
  })
  .meta({ id: "CreateRoom" });
export type CreateRoom = z.infer<typeof CreateRoomSchema>;

/**
 * Where a room is in its life. Guests can be in it while it's `open`; the owner can also enter
 * a few minutes early to prepare.
 */
export function roomPhase(
  room: Pick<Room, "startsAt" | "endsAt">,
  options: { owner?: boolean; now?: number } = {},
): "upcoming" | "open" | "ended" {
  const now = options.now ?? Date.now();
  const early = options.owner ? OWNER_EARLY_MINUTES * 60_000 : 0;
  if (now >= Date.parse(room.endsAt)) return "ended";
  return now >= Date.parse(room.startsAt) - early ? "open" : "upcoming";
}

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

/** Which of your sessions to list: the tabs of the sessions page. */
export const SessionTabSchema = z.enum(["live", "upcoming", "past"]);
export type SessionTab = z.infer<typeof SessionTabSchema>;

/** Query of `GET /api/rooms`: one page of a tab, filtered. */
export const RoomListQuerySchema = z.object({
  tab: SessionTabSchema,
  /** Matches the session's name or a participant's name. */
  q: z.string().trim().max(100).optional(),
  /** Only sessions starting at or after / before these moments. */
  from: DateTimeSchema.optional(),
  to: DateTimeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type RoomListQuery = z.infer<typeof RoomListQuerySchema>;

/** Body of `GET /api/rooms`. */
export const RoomPageSchema = z
  .object({ items: z.array(RoomSummarySchema), total: z.number().int() })
  .meta({ id: "RoomPage" });
export type RoomPage = z.infer<typeof RoomPageSchema>;

/** Body of `GET /api/rooms/counts`: how many sessions each tab has. */
export const RoomCountsSchema = z
  .object({ live: z.number().int(), upcoming: z.number().int(), past: z.number().int() })
  .meta({ id: "RoomCounts" });
export type RoomCounts = z.infer<typeof RoomCountsSchema>;
