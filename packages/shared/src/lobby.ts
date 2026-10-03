import { z } from "zod";
import { ParticipantSchema, type Participant } from "./participant";

/**
 * Guests don't walk into a room: they ask, and the room's owner lets them in or not. Once let
 * in, a guest gets a ticket that opens the room's WebSockets.
 */

/** Body of `POST /api/rooms/:id/join-requests`. */
export const AskToJoinSchema = z
  .object({ participant: ParticipantSchema })
  .meta({ id: "AskToJoin" });

export const JoinRequestSchema = z
  .object({ id: z.uuid(), participant: ParticipantSchema })
  .meta({ id: "JoinRequest" });
export interface JoinRequest {
  id: string;
  participant: Participant;
}

/** Body of `GET /api/rooms/:id/join-requests/:requestId`, polled by the waiting guest. */
export const JoinStatusSchema = z
  .discriminatedUnion("status", [
    z.object({ status: z.literal("pending") }),
    z.object({ status: z.literal("admitted"), ticket: z.string() }),
    z.object({ status: z.literal("denied") }),
  ])
  .meta({ id: "JoinStatus" });
export type JoinStatus = z.infer<typeof JoinStatusSchema>;
