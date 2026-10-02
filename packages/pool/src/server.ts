import Fastify, { type FastifyServerOptions } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { z } from "zod";
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { WorkerPool } from "./application/pool";
import type { WorkerCleaner } from "./application/ports";
import { HttpWorkerCleaner } from "./adapters/http-cleaner";
import { requireInternal } from "./adapters/internal-auth";
import { poolRoutes } from "./adapters/routes";

const SWEEP_INTERVAL_MS = 5_000;

/** Builds the pool service. API docs are served at /docs. */
export async function createServer(options: {
  internalSecret: string;
  logger?: FastifyServerOptions["logger"];
  cleaner?: WorkerCleaner;
}) {
  const pool = new WorkerPool(options.cleaner ?? new HttpWorkerCleaner(options.internalSecret));

  const app = Fastify({ logger: options.logger ?? false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: {
      info: {
        title: "pairbox pool",
        version: "0.1.0",
        description: `Tracks workers and reserves them for rooms. Every route except /health needs the \`x-pairbox-internal\` header.`,
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.get(
    "/health",
    { schema: { tags: ["meta"], response: { 200: z.object({ status: z.literal("ok") }) } } },
    () => ({ status: "ok" as const }),
  );

  await app.register(async (internal) => {
    internal.addHook("onRequest", requireInternal(options.internalSecret));
    await internal.register(poolRoutes, { pool });
  });

  const sweep = setInterval(() => pool.removeSilentWorkers(), SWEEP_INTERVAL_MS);
  app.addHook("onClose", async () => clearInterval(sweep));

  return app;
}
