import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyServerOptions } from "fastify";
import websocket from "@fastify/websocket";
import { INTERNAL_AUTH_HEADER, type Runtime } from "@pairbox/shared";
import { cleanMachine } from "./machine";
import { openTerminal, sandboxUser } from "./terminal";

/**
 * The worker agent's API, used by the pool and the api:
 * - GET  /health    is the agent up
 * - POST /clean     wipe everything the previous room left behind
 * - WS   /terminal  a shell for the room, plus Run (see WorkerCommand in @pairbox/shared)
 */
export async function createServer(options: {
  internalSecret: string;
  runtime: Runtime;
  sandboxUser: string;
  workspace: string;
  writableDirs: string[];
  logger?: FastifyServerOptions["logger"];
}) {
  const app = Fastify({ logger: options.logger ?? false });
  const expected = Buffer.from(options.internalSecret);

  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") return;
    const header = request.headers[INTERNAL_AUTH_HEADER];
    const given = Buffer.from(typeof header === "string" ? header : "");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return reply.code(401).send({ error: "Not a pairbox service" });
    }
  });

  await app.register(websocket);
  const user = sandboxUser(options.sandboxUser);

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/terminal", { websocket: true }, (socket) =>
    openTerminal(socket, { runtime: options.runtime, workspace: options.workspace, user }),
  );

  app.post("/clean", async (_request, reply) => {
    await cleanMachine(options.sandboxUser, options.writableDirs);
    return reply.code(204).send();
  });

  return app;
}
