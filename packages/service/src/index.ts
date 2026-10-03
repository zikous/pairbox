/** What every pairbox backend service is built on: Fastify with Zod schemas and API docs. */
import { timingSafeEqual } from "node:crypto";
import Fastify, {
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
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
import { INTERNAL_AUTH_HEADER } from "@pairbox/shared";

export interface ServiceOptions {
  title: string;
  description: string;
  logger?: FastifyServerOptions["logger"];
  /** Trust X-Forwarded-* headers (when behind a proxy). */
  trustProxy?: boolean;
  /** Documents routes marked `security: [{ session: [] }]` as needing this cookie. */
  sessionCookie?: string;
}

/** A Fastify app that validates with Zod, documents itself at /docs and answers /health. */
export async function createService(options: ServiceOptions) {
  const app = Fastify({
    logger: options.logger ?? false,
    trustProxy: options.trustProxy ?? false,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: {
      info: { title: options.title, version: "0.1.0", description: options.description },
      ...(options.sessionCookie && {
        components: {
          securitySchemes: {
            session: { type: "apiKey" as const, in: "cookie", name: options.sessionCookie },
          },
        },
      }),
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.get(
    "/health",
    {
      schema: {
        summary: "Health check",
        tags: ["meta"],
        response: { 200: z.object({ status: z.literal("ok") }) },
      },
    },
    () => ({ status: "ok" as const }),
  );
  return app;
}

/** Fastify hook that only lets other pairbox services through (shared internal secret). */
export function requireInternal(secret: string) {
  const expected = Buffer.from(secret);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers[INTERNAL_AUTH_HEADER];
    const given = Buffer.from(typeof header === "string" ? header : "");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return reply.code(401).send({ error: "Not a pairbox service" });
    }
  };
}

/** Headers for calling another pairbox service. */
export const internalHeaders = (secret: string) => ({ [INTERNAL_AUTH_HEADER]: secret });
