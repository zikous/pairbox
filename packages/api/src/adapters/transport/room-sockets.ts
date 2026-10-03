import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { CLOSE_ROOM_NOT_FOUND, RoomIdSchema } from "@pairbox/shared";
import type { YjsCollaboration } from "../collaboration/yjs-collaboration";
import { roomAccess } from "./room-access";
import { openSession, type SessionDeps } from "./session-socket";

const params = z.object({ id: RoomIdSchema });
const querystring = z.object({ ticket: z.string().optional() });
const schema = { hide: true, params, querystring };

/**
 * The two real-time channels of a room, for its owner and the guests they let in:
 * - /sync    the document and presence (binary, y-websocket protocol)
 * - /session terminal I/O and run controls (JSON, see @pairbox/shared)
 */
export const roomSockets: FastifyPluginAsyncZod<
  SessionDeps & { collaboration: YjsCollaboration }
> = async (app, deps) => {
  app.get("/:id/sync", { websocket: true, schema }, (socket, request) => {
    // The client starts syncing right away: keep its messages while we check access.
    const early: Buffer[] = [];
    const hold = (data: Buffer) => early.push(data);
    socket.on("message", hold);

    void (async () => {
      const room = await deps.rooms.find(request.params.id);
      if (!room) return socket.close(CLOSE_ROOM_NOT_FOUND, "Room not found");
      const access = await roomAccess(request, room, deps);
      if (!access.allowed) return socket.close(access.code, access.reason);
      socket.off("message", hold);
      deps.clock.watch(room);
      if (!(await deps.collaboration.connect(room.id, socket, early))) {
        socket.close(CLOSE_ROOM_NOT_FOUND, "Room not found");
      }
    })();
  });

  app.get("/:id/session", { websocket: true, schema }, (socket, request) =>
    openSession(socket, request, deps),
  );
};
