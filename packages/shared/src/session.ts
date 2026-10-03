import { z } from "zod";
import { ParticipantSchema } from "./participant";
import { RuntimeSchema, type Runtime } from "./runtime";
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
  z.object({ type: z.literal("set_runtime"), runtime: RuntimeSchema }),
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
  | { type: "runtime"; runtime: Runtime }
  | { type: "room_deleted" };

/** WebSocket close code for a room that doesn't exist. Clients must not reconnect. */
export const CLOSE_ROOM_NOT_FOUND = 4404;
