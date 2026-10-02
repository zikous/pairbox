import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  ErrorSchema,
  RegisterWorkerSchema,
  ReservationSchema,
  ReserveSchema,
  WorkerSchema,
} from "@pairbox/shared";
import type { WorkerPool } from "../application/pool";

const workerParams = z.object({ id: z.string() });
const reservationParams = z.object({ id: z.uuid() });

export const poolRoutes: FastifyPluginAsyncZod<{ pool: WorkerPool }> = async (app, { pool }) => {
  app.post(
    "/workers",
    {
      schema: {
        summary: "Register a worker",
        description: "Called by a worker when it starts. It joins the pool as free.",
        tags: ["workers"],
        body: RegisterWorkerSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      pool.register(request.body);
      return reply.code(204).send(null);
    },
  );

  app.post(
    "/workers/:id/heartbeat",
    {
      schema: {
        summary: "Worker heartbeat",
        description: "404 means the pool doesn't know the worker: it must register again.",
        tags: ["workers"],
        params: workerParams,
        response: { 204: z.null(), 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      if (!pool.heartbeat(request.params.id)) {
        return reply.code(404).send({ error: "Unknown worker" });
      }
      return reply.code(204).send(null);
    },
  );

  app.get(
    "/workers",
    {
      schema: {
        summary: "List workers",
        tags: ["workers"],
        response: { 200: z.array(WorkerSchema) },
      },
    },
    () => pool.list(),
  );

  app.post(
    "/reservations",
    {
      schema: {
        summary: "Reserve a worker for a room",
        description:
          "Returns a reserved worker, or a place in the queue when none is free. Asking again for the same room returns the same reservation.",
        tags: ["reservations"],
        body: ReserveSchema,
        response: { 200: ReservationSchema },
      },
    },
    (request) => pool.reserve(request.body),
  );

  app.get(
    "/reservations/:id",
    {
      schema: {
        summary: "Check a reservation",
        description: "Poll this while queued. 404 means it was released or its worker died.",
        tags: ["reservations"],
        params: reservationParams,
        response: { 200: ReservationSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) =>
      pool.get(request.params.id) ?? reply.code(404).send({ error: "Unknown reservation" }),
  );

  app.delete(
    "/reservations/:id",
    {
      schema: {
        summary: "Release a reservation",
        description: "Leaves the queue, or gives the worker back to be cleaned.",
        tags: ["reservations"],
        params: reservationParams,
        response: { 204: z.null(), 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      if (!pool.release(request.params.id)) {
        return reply.code(404).send({ error: "Unknown reservation" });
      }
      return reply.code(204).send(null);
    },
  );
};
