import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  AvailabilityQuerySchema,
  AvailabilitySchema,
  CreateRoomSchema,
  ErrorSchema,
  RoomIdSchema,
  RoomSchema,
  RoomSummarySchema,
  RoomViewSchema,
} from "@pairbox/shared";
import type { AuthService } from "../../application/auth";
import type { Scheduler } from "../../application/ports";
import type { RecordingService } from "../../application/recordings";
import type { RoomService } from "../../application/rooms";
import { requireUser, sessionToken, signedInUser } from "./session";

const params = z.object({ id: RoomIdSchema });
const signedIn = [{ session: [] }];

export const roomsRoutes: FastifyPluginAsyncZod<{
  rooms: RoomService;
  recordings: RecordingService;
  auth: AuthService;
  scheduler: Scheduler;
}> = async (app, { rooms, recordings, auth, scheduler }) => {
  const onRequest = requireUser(auth);

  app.get(
    "/",
    {
      onRequest,
      schema: {
        summary: "List your sessions",
        tags: ["rooms"],
        security: signedIn,
        response: { 200: z.array(RoomSummarySchema), 401: ErrorSchema },
      },
    },
    async (request) => {
      const list = await rooms.list(signedInUser(request).id);
      const participants = await recordings.participants(list.map((room) => room.id));
      return list.map((room) => ({ ...room, participants: participants.get(room.id) ?? [] }));
    },
  );

  app.post(
    "/",
    {
      onRequest,
      schema: {
        summary: "Book a session",
        description: "409 when no sandbox is free for the whole slot.",
        tags: ["rooms"],
        security: signedIn,
        body: CreateRoomSchema,
        response: { 201: RoomSchema, 400: ErrorSchema, 401: ErrorSchema, 409: ErrorSchema },
      },
    },
    async (request, reply) =>
      reply.code(201).send(await rooms.create(signedInUser(request).id, request.body)),
  );

  app.get(
    "/availability",
    {
      onRequest,
      schema: {
        summary: "Which start times are free",
        description: "Every half hour over the 24 hours from `from`, for a session of that length.",
        tags: ["rooms"],
        security: signedIn,
        querystring: AvailabilityQuerySchema,
        response: { 200: AvailabilitySchema, 401: ErrorSchema },
      },
    },
    (request) => {
      const { runtime, from, durationMinutes } = request.query;
      return scheduler.availability(runtime, new Date(from), durationMinutes);
    },
  );

  app.get(
    "/:id",
    {
      schema: {
        summary: "Get a room",
        description: "Public: anyone with the room's link can look it up. Says if it's yours.",
        tags: ["rooms"],
        params,
        response: { 200: RoomViewSchema, 404: ErrorSchema },
      },
    },
    async (request) => {
      const room = await rooms.get(request.params.id);
      const token = sessionToken(request);
      const user = token ? await auth.userFor(token) : undefined;
      return { ...room, owner: user?.id === room.ownerId };
    },
  );

  app.post(
    "/:id/end",
    {
      onRequest,
      schema: {
        summary: "End a session now",
        description: "Disconnects everyone, frees the rest of the slot and closes the recording.",
        tags: ["rooms"],
        security: signedIn,
        params,
        response: { 204: z.null(), 403: ErrorSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      await rooms.end(signedInUser(request).id, request.params.id);
      return reply.code(204).send(null);
    },
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
