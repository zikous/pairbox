import Fastify, { type FastifyServerOptions } from "fastify";
import websocket from "@fastify/websocket";
import { requireInternal } from "@pairbox/service";
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
  sandboxUser: string;
  workspace: string;
  writableDirs: string[];
  logger?: FastifyServerOptions["logger"];
}) {
  const app = Fastify({ logger: options.logger ?? false });
  const internalOnly = requireInternal(options.internalSecret);
  app.addHook("onRequest", (request, reply) =>
    request.url === "/health" ? Promise.resolve() : internalOnly(request, reply),
  );

  await app.register(websocket);
  const user = sandboxUser(options.sandboxUser);

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/terminal", { websocket: true }, (socket, request) =>
    openTerminal(socket, {
      workspace: options.workspace,
      user,
      log: (error) => request.log.warn({ err: error }, "terminal command failed"),
    }),
  );

  app.post("/clean", async (_request, reply) => {
    await cleanMachine(options.sandboxUser, options.writableDirs);
    return reply.code(204).send();
  });

  return app;
}
