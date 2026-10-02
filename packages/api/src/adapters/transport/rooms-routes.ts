import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { CreateRoomSchema, ErrorSchema, RoomIdSchema, RoomSchema } from "@pairbox/shared";
import type { RoomService } from "../../application/rooms";
import { requireHost } from "./host-auth";

const params = z.object({ id: RoomIdSchema });
const hostOnly = [{ hostSecret: [] }];

export const roomsRoutes: FastifyPluginAsyncZod<{
  rooms: RoomService;
  hostSecret: string;
}> = async (app, { rooms, hostSecret }) => {
  const host = requireHost(hostSecret);

  app.get(
    "/",
    {
      onRequest: host,
      schema: {
        summary: "List rooms",
        tags: ["rooms"],
        security: hostOnly,
        response: { 200: z.array(RoomSchema), 401: ErrorSchema },
      },
    },
    () => rooms.list(),
  );

  app.post(
    "/",
    {
      onRequest: host,
      schema: {
        summary: "Create a room",
        tags: ["rooms"],
        security: hostOnly,
        body: CreateRoomSchema,
        response: { 201: RoomSchema, 400: ErrorSchema, 401: ErrorSchema },
      },
    },
    async (request, reply) => reply.code(201).send(await rooms.create(request.body)),
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
      onRequest: host,
      schema: {
        summary: "Delete a room",
        description: "Disconnects everyone in the room and deletes its code.",
        tags: ["rooms"],
        security: hostOnly,
        params,
        response: { 204: z.null(), 401: ErrorSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      await rooms.delete(request.params.id);
      return reply.code(204).send(null);
    },
  );
};
