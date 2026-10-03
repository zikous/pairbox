import type { FastifyServerOptions } from "fastify";
import { createService, requireInternal } from "@pairbox/service";
import { WorkerPool } from "./application/pool";
import type { WorkerCleaner } from "./application/ports";
import { HttpWorkerCleaner } from "./adapters/http-cleaner";
import { poolRoutes } from "./adapters/routes";

const SWEEP_INTERVAL_MS = 5_000;

/** Builds the pool service. API docs are served at /docs. */
export async function createServer(options: {
  internalSecret: string;
  logger?: FastifyServerOptions["logger"];
  cleaner?: WorkerCleaner;
}) {
  const pool = new WorkerPool(options.cleaner ?? new HttpWorkerCleaner(options.internalSecret));
  const app = await createService({
    title: "pairbox pool",
    description: "Tracks workers and hands them to rooms. Every route except /health is internal.",
    logger: options.logger,
  });

  await app.register(async (internal) => {
    internal.addHook("onRequest", requireInternal(options.internalSecret));
    await internal.register(poolRoutes, { pool });
  });

  const sweep = setInterval(() => pool.removeSilentWorkers(), SWEEP_INTERVAL_MS);
  app.addHook("onClose", async () => clearInterval(sweep));
  return app;
}
