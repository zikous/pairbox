import type { FastifyServerOptions } from "fastify";
import { createService, requireInternal } from "@pairbox/service";
import type { BookingRepository, Capacity } from "./application/ports";
import { Schedule } from "./application/schedule";
import { scheduleRoutes } from "./adapters/routes";

/** Builds the scheduler service. API docs are served at /docs. */
export async function createServer(options: {
  internalSecret: string;
  bookings: BookingRepository;
  capacity: Capacity;
  logger?: FastifyServerOptions["logger"];
}) {
  const app = await createService({
    title: "pairbox scheduler",
    description: "Books rooms into time slots without booking more rooms than there are workers.",
    logger: options.logger,
  });
  await app.register(async (internal) => {
    internal.addHook("onRequest", requireInternal(options.internalSecret));
    await internal.register(scheduleRoutes, {
      schedule: new Schedule(options.bookings, options.capacity),
    });
  });
  return app;
}
