import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ErrorSchema, RecordingReplaySchema, RoomIdSchema } from "@pairbox/shared";
import type { AuthService } from "../../application/auth";
import type { RecordingService } from "../../application/recordings";
import type { RoomService } from "../../application/rooms";
import { requireUser, signedInUser } from "./session";

/** A room's recording. Only the room's owner can replay it. */
export const recordingsRoutes: FastifyPluginAsyncZod<{
  rooms: RoomService;
  recordings: RecordingService;
  auth: AuthService;
}> = async (app, { rooms, recordings, auth }) => {
  app.get(
    "/:id/recording",
    {
      onRequest: requireUser(auth),
      schema: {
        summary: "Get a session's recording to replay",
        tags: ["recordings"],
        security: [{ session: [] }],
        params: z.object({ id: RoomIdSchema }),
        response: { 200: RecordingReplaySchema, 403: ErrorSchema, 404: ErrorSchema },
      },
    },
    async (request) => {
      await rooms.owned(signedInUser(request).id, request.params.id);
      return recordings.replay(request.params.id);
    },
  );
};
