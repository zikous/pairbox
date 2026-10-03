import Fastify, { type FastifyServerOptions } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { z } from "zod";
import { ShareInfoSchema } from "@pairbox/shared";
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { AuthService } from "../../application/auth";
import type { RoomEvents } from "../../application/events";
import type { RoomService } from "../../application/rooms";
import type { TerminalService } from "../../application/terminals";
import type { YjsCollaboration } from "../collaboration/yjs-collaboration";
import type { PublicAddress } from "../sharing/public-address";
import { authRoutes } from "./auth-routes";
import { errorHandler } from "./errors";
import { roomSockets } from "./room-sockets";
import { roomsRoutes } from "./rooms-routes";

export interface AppDeps {
  auth: AuthService;
  rooms: RoomService;
  terminals: TerminalService;
  events: RoomEvents;
  collaboration: YjsCollaboration;
  publicAddress: PublicAddress;
  logger?: FastifyServerOptions["logger"];
}

/** Builds the HTTP and WebSocket server. API docs are served at /docs. */
export async function buildApp({ logger = false, auth, publicAddress, ...deps }: AppDeps) {
  // Behind nginx (and maybe a tunnel): trust their X-Forwarded-* headers for IPs and https.
  const app = Fastify({ logger, trustProxy: true }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  await app.register(swagger, {
    openapi: {
      info: {
        title: "pairbox API",
        version: "0.1.0",
        description: [
          "Accounts and room management over HTTP; signed-in requests carry the session cookie.",
          "Each room also has two WebSockets, open to anyone with the room's link:",
          "",
          "- `/ws/rooms/{id}/sync`: the shared document and presence (Yjs, y-websocket protocol)",
          "- `/ws/rooms/{id}/session`: terminal and run controls (JSON, see `@pairbox/shared`)",
        ].join("\n"),
      },
      components: {
        securitySchemes: {
          session: { type: "apiKey", in: "cookie", name: "pairbox_session" },
        },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await app.register(websocket, { options: { maxPayload: 1024 * 1024 } });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.get(
    "/api/health",
    {
      schema: {
        summary: "Health check",
        tags: ["meta"],
        response: { 200: z.object({ status: z.literal("ok") }) },
      },
    },
    () => ({ status: "ok" as const }),
  );
  app.get(
    "/api/share",
    {
      schema: {
        summary: "Where invite links should point",
        tags: ["meta"],
        response: { 200: ShareInfoSchema },
      },
    },
    () => publicAddress.get(),
  );
  await app.register(authRoutes, { prefix: "/api/auth", auth });
  await app.register(roomsRoutes, { prefix: "/api/rooms", rooms: deps.rooms, auth });
  await app.register(roomSockets, { prefix: "/ws/rooms", ...deps });

  return app;
}
