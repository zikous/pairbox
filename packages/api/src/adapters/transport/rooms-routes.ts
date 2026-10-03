import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { CreateRoomSchema, ErrorSchema, RoomIdSchema, RoomSchema } from "@pairbox/shared";
import type { AuthService } from "../../application/auth";
import type { RoomService } from "../../application/rooms";
import { requireUser, signedInUser } from "./session";

const params = z.object({ id: RoomIdSchema });
const signedIn = [{ session: [] }];

export const roomsRoutes: FastifyPluginAsyncZod<{ rooms: RoomService; auth: AuthService }> = async (
  app,
  { rooms, auth },
) => {
  const onRequest = requireUser(auth);

  app.get(
    "/",
    {
      onRequest,
      schema: {
        summary: "List your rooms",
        tags: ["rooms"],
        security: signedIn,
        response: { 200: z.array(RoomSchema), 401: ErrorSchema },
      },
    },
    (request) => rooms.list(signedInUser(request).id),
  );

  app.post(
    "/",
    {
      onRequest,
      schema: {
        summary: "Create a room",
        tags: ["rooms"],
        security: signedIn,
        body: CreateRoomSchema,
        response: { 201: RoomSchema, 400: ErrorSchema, 401: ErrorSchema },
      },
    },
    async (request, reply) =>
      reply.code(201).send(await rooms.create(signedInUser(request).id, request.body)),
  );

  app.get(
    "/:id",
    {
      schema: {
        summary: "Get a room",
        description: "Public: anyone with the room's link can look it up.",
        tags: ["rooms"],
        params,
        response: { 200: RoomSchema, 404: ErrorSchema },
      },
    },
    (request) => rooms.get(request.params.id),
  );

  app.delete(
    "/:id",
    {
      onRequest,
      schema: {
        summary: "Delete one of your rooms",
        description: "Disconnects everyone in the room and deletes its code.",
        tags: ["rooms"],
        security: signedIn,
        params,
        response: { 204: z.null(), 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      await rooms.delete(signedInUser(request).id, request.params.id);
      return reply.code(204).send(null);
    },
  );
};
