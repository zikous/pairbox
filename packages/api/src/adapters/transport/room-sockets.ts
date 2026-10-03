import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { CLOSE_ROOM_NOT_FOUND, RoomIdSchema } from "@pairbox/shared";
import type { YjsCollaboration } from "../collaboration/yjs-collaboration";
import { openSession, type SessionDeps } from "./session-socket";

const params = z.object({ id: RoomIdSchema });

/**
 * The two real-time channels of a room, open to anyone with its link:
 * - /sync    the document and presence (binary, y-websocket protocol)
 * - /session terminal I/O, run controls and runtime changes (JSON, see @pairbox/shared)
 */
export const roomSockets: FastifyPluginAsyncZod<
  SessionDeps & { collaboration: YjsCollaboration }
> = async (app, deps) => {
  app.get("/:id/sync", { websocket: true, schema: { hide: true, params } }, (socket, request) => {
    void deps.collaboration.connect(request.params.id, socket).then((found) => {
      if (!found) socket.close(CLOSE_ROOM_NOT_FOUND, "Room not found");
    });
  });

  app.get("/:id/session", { websocket: true, schema: { hide: true, params } }, (socket, request) =>
    openSession(socket, request.params.id, deps, request.log),
  );
};
