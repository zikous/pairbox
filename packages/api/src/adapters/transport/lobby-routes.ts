import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  AskToJoinSchema,
  ErrorSchema,
  JoinStatusSchema,
  RoomIdSchema,
  roomPhase,
} from "@pairbox/shared";
import type { AuthService } from "../../application/auth";
import { NotFoundError, SessionNotOpenError } from "../../application/errors";
import type { Lobby } from "../../application/lobby";
import type { RoomService } from "../../application/rooms";
import { requireUser, signedInUser } from "./session";

const room = z.object({ id: RoomIdSchema });
const request = room.extend({ requestId: z.uuid() });

/** Guests ask to join a room; its owner lets them in or not. */
export const lobbyRoutes: FastifyPluginAsyncZod<{
  rooms: RoomService;
  lobby: Lobby;
  auth: AuthService;
}> = async (app, { rooms, lobby, auth }) => {
  app.post(
    "/:id/join-requests",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        summary: "Ask to join a room",
        description: "Only while the session is open. Then poll the request until it's decided.",
        tags: ["lobby"],
        params: room,
        body: AskToJoinSchema,
        response: { 201: z.object({ id: z.uuid() }), 404: ErrorSchema, 409: ErrorSchema },
      },
    },
    async (req, reply) => {
      const found = await rooms.get(req.params.id);
      if (roomPhase(found) !== "open") throw new SessionNotOpenError("This session isn't open");
      return reply.code(201).send({ id: lobby.ask(found.id, req.body.participant) });
    },
  );

  app.get(
    "/:id/join-requests/:requestId",
    {
      schema: {
        summary: "Check a join request",
        description: "Once admitted, the ticket opens the room's WebSockets (`?ticket=`).",
        tags: ["lobby"],
        params: request,
        response: { 200: JoinStatusSchema, 404: ErrorSchema },
      },
    },
    (req) => {
      const status = lobby.status(req.params.id, req.params.requestId);
      if (!status) throw new NotFoundError("Unknown join request");
      return status;
    },
  );

  for (const decision of ["admit", "deny"] as const) {
    app.post(
      `/:id/join-requests/:requestId/${decision}`,
      {
        onRequest: requireUser(auth),
        schema: {
          summary: decision === "admit" ? "Let a guest in" : "Turn a guest away",
          tags: ["lobby"],
          security: [{ session: [] }],
          params: request,
          response: { 204: z.null(), 403: ErrorSchema, 404: ErrorSchema },
        },
      },
      async (req, reply) => {
        await rooms.owned(signedInUser(req).id, req.params.id);
        if (!lobby.decide(req.params.id, req.params.requestId, decision === "admit")) {
          throw new NotFoundError("No such pending request");
        }
        return reply.code(204).send(null);
      },
    );
  }
};
