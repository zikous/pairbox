import { z } from "zod";
import { ParticipantSchema, type Participant } from "./participant";
import { RoomIdSchema } from "./room";
import type { RunStatus } from "./run";
import type { Runtime } from "./runtime";

/** One recorded session of a room: from the first person joining until everyone has left. */
export const RecordingSchema = z
  .object({
    id: z.uuid(),
    roomId: RoomIdSchema,
    startedAt: z.string().meta({ format: "date-time" }),
    /** Null while the session is still going. */
    endedAt: z.string().meta({ format: "date-time" }).nullable(),
    participants: z.array(ParticipantSchema),
  })
  .meta({ id: "Recording" });
export type Recording = z.infer<typeof RecordingSchema>;

/**
 * Everything that happened in a session, in order. `t` is milliseconds since it started, and
 * `by` is who did it. Document and presence changes are Yjs updates, base64-encoded.
 */
export type RecordingEvent = { t: number } & (
  | { type: "edit"; update: string; by?: Participant }
  | { type: "presence"; update: string }
  | { type: "join" | "leave"; by: Participant }
  | { type: "input"; data: string; by: Participant }
  | { type: "output"; data: string }
  | { type: "run" | "stop" | "reset"; by: Participant }
  | { type: "status"; status: RunStatus }
  | { type: "runtime"; runtime: Runtime; by?: Participant }
);

/** Body of `GET /api/recordings/:id`: everything needed to replay a session. */
export const RecordingReplaySchema = z
  .object({
    recording: RecordingSchema,
    /** The document as it was when the session started (Yjs state, base64). */
    snapshot: z.string(),
    /** RecordingEvent objects, in order. */
    events: z.array(z.looseObject({ t: z.number(), type: z.string() })),
  })
  .meta({ id: "RecordingReplay" });
export type RecordingReplay = { recording: Recording; snapshot: string; events: RecordingEvent[] };
