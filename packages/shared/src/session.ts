import { z } from "zod";
import { ParticipantSchema } from "./participant";
import type { JoinRequest } from "./lobby";
import type { RunStatus } from "./run";

/** Messages the browser sends on `/ws/rooms/:id/session`. */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  /** Who is at this end, so terminal actions can be attributed (sent on connect and on rename). */
  z.object({ type: z.literal("hello"), participant: ParticipantSchema }),
  z.object({ type: z.literal("input"), data: z.string().max(4096) }),
  z.object({
    type: z.literal("resize"),
    cols: z.number().int().min(2).max(500),
    rows: z.number().int().min(1).max(200),
  }),
  z.object({ type: z.literal("run") }),
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("reset") }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** Whether the room's terminal has a worker behind it yet. */
export type SandboxState =
  | { state: "starting" }
  | { state: "waiting"; position: number }
  | { state: "ready" }
  | { state: "lost" };

/** Messages the server sends on `/ws/rooms/:id/session`. */
export type ServerMessage =
  | { type: "output"; data: string }
  | { type: "status"; status: RunStatus }
  | { type: "sandbox"; sandbox: SandboxState }
  /** Only sent to the room's owner: who is waiting to be let in. */
  | { type: "join_requests"; requests: JoinRequest[] }
  | { type: "session_ended" }
  | { type: "room_deleted" };

/** WebSocket close codes. Clients must not reconnect after any of these. */
export const CLOSE_ROOM_NOT_FOUND = 4404;
export const CLOSE_NOT_ADMITTED = 4403;
export const CLOSE_SESSION_ENDED = 4410;
