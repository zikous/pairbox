import { z } from "zod";
import type { Language } from "./language";
import { LanguageSchema } from "./language";
import type { RunStatus } from "./run";

/** Messages the browser sends on `/ws/rooms/:id/session`. */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("input"), data: z.string().max(4096) }),
  z.object({ type: z.literal("run") }),
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("reset") }),
  z.object({ type: z.literal("set_language"), language: LanguageSchema }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** Messages the server sends on `/ws/rooms/:id/session`. */
export type ServerMessage =
  | { type: "output"; data: string }
  | { type: "status"; status: RunStatus }
  | { type: "language"; language: Language }
  | { type: "room_deleted" };

/** WebSocket close code for a room that doesn't exist. Clients must not reconnect. */
export const CLOSE_ROOM_NOT_FOUND = 4404;
