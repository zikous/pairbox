import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  AvailabilityQuerySchema,
  AvailabilitySchema,
  BookingSchema,
  ErrorSchema,
  RoomIdSchema,
} from "@pairbox/shared";
import { SlotFullError, type Schedule } from "../application/schedule";

export const scheduleRoutes: FastifyPluginAsyncZod<{ schedule: Schedule }> = async (
  app,
  { schedule },
) => {
  app.post(
    "/bookings",
    {
      schema: {
        summary: "Book a room's slot",
        description: "409 when no worker of the runtime is free for the whole slot.",
        tags: ["bookings"],
        body: BookingSchema,
        response: { 204: z.null(), 409: ErrorSchema },
      },
    },
    async (request, reply) => {
      try {
        await schedule.book(request.body);
      } catch (error) {
        if (error instanceof SlotFullError) return reply.code(409).send({ error: error.message });
        throw error;
      }
      return reply.code(204).send(null);
    },
  );

  app.delete(
    "/bookings/:roomId",
    {
      schema: {
        summary: "Cancel a room's booking",
        tags: ["bookings"],
        params: z.object({ roomId: RoomIdSchema }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await schedule.cancel(request.params.roomId);
      return reply.code(204).send(null);
    },
  );

  app.get(
    "/availability",
    {
      schema: {
        summary: "Which start times are free",
        description: "Every half hour over the 24 hours from `from`, for a session of that length.",
        tags: ["bookings"],
        querystring: AvailabilityQuerySchema,
        response: { 200: AvailabilitySchema },
      },
    },
    (request) => {
      const { runtime, from, durationMinutes } = request.query;
      return schedule.availability(runtime, new Date(from), durationMinutes);
    },
  );
};
