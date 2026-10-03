import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ErrorSchema, RecordingReplaySchema, RecordingSchema, RoomIdSchema } from "@pairbox/shared";
import type { AuthService } from "../../application/auth";
import { RecordingNotFoundError } from "../../application/errors";
import type { RecordingService } from "../../application/recordings";
import type { RoomService } from "../../application/rooms";
import { requireUser, signedInUser } from "./session";

const ownerOnly = [{ session: [] }];

/** Recorded sessions. Only the room's owner can see them. */
export const recordingsRoutes: FastifyPluginAsyncZod<{
  rooms: RoomService;
  recordings: RecordingService;
  auth: AuthService;
}> = async (app, { rooms, recordings, auth }) => {
  app.addHook("onRequest", requireUser(auth));

  app.get(
    "/rooms/:id/recordings",
    {
      schema: {
        summary: "List a room's recorded sessions",
        tags: ["recordings"],
        security: ownerOnly,
        params: z.object({ id: RoomIdSchema }),
        response: { 200: z.array(RecordingSchema), 403: ErrorSchema, 404: ErrorSchema },
      },
    },
    async (request) => {
      await rooms.owned(signedInUser(request).id, request.params.id);
      return recordings.list(request.params.id);
    },
  );

  app.get(
    "/recordings/:id",
    {
      schema: {
        summary: "Get a recorded session to replay",
        tags: ["recordings"],
        security: ownerOnly,
        params: z.object({ id: z.uuid() }),
        response: { 200: RecordingReplaySchema, 403: ErrorSchema, 404: ErrorSchema },
      },
    },
    async (request) => {
      const recording = await recordings.get(request.params.id);
      if (!recording) throw new RecordingNotFoundError(request.params.id);
      await rooms.owned(signedInUser(request).id, recording.roomId);
      return recordings.replay(recording);
    },
  );
};
