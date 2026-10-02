import Fastify, { type FastifyServerOptions } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import { z } from "zod";
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { RoomEvents } from "../../application/events";
import type { RoomService } from "../../application/rooms";
import type { TerminalService } from "../../application/terminals";
import type { YjsCollaboration } from "../collaboration/yjs-collaboration";
import { errorHandler } from "./errors";
import { roomSockets } from "./room-sockets";
import { roomsRoutes } from "./rooms-routes";

export interface AppDeps {
  rooms: RoomService;
  terminals: TerminalService;
  events: RoomEvents;
  collaboration: YjsCollaboration;
  hostSecret: string;
  logger?: FastifyServerOptions["logger"];
}

/** Builds the HTTP and WebSocket server. API docs are served at /docs. */
export async function buildApp({ logger = false, hostSecret, ...deps }: AppDeps) {
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  await app.register(swagger, {
    openapi: {
      info: {
        title: "pairbox API",
        version: "0.1.0",
        description: [
          "Room management over HTTP. Each room also has two WebSockets:",
          "",
          "- `/ws/rooms/{id}/sync`: the shared document and presence (Yjs, y-websocket protocol)",
          "- `/ws/rooms/{id}/session`: terminal and run controls (JSON, see `@pairbox/shared`)",
        ].join("\n"),
      },
      components: {
        securitySchemes: {
          hostSecret: { type: "http", scheme: "bearer", description: "The server's HOST_SECRET" },
        },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await app.register(websocket, { options: { maxPayload: 1024 * 1024 } });

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
  await app.register(roomsRoutes, { prefix: "/api/rooms", rooms: deps.rooms, hostSecret });
  await app.register(roomSockets, { prefix: "/ws/rooms", ...deps });

  return app;
}
