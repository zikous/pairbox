import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  CLOSE_ROOM_NOT_FOUND,
  ClientMessageSchema,
  parseJson,
  RoomIdSchema,
  type ClientMessage,
  type RoomId,
  type ServerMessage,
} from "@pairbox/shared";
import type { RoomEvents } from "../../application/events";
import type { RoomService } from "../../application/rooms";
import type { TerminalService } from "../../application/terminals";
import type { YjsCollaboration } from "../collaboration/yjs-collaboration";

interface Deps {
  rooms: RoomService;
  terminals: TerminalService;
  events: RoomEvents;
  collaboration: YjsCollaboration;
}

const params = z.object({ id: RoomIdSchema });

/**
 * The two real-time channels of a room:
 * - /sync    Yjs document and presence (binary, y-websocket protocol)
 * - /session terminal I/O, run controls and runtime changes (JSON, see @pairbox/shared)
 */
export const roomSockets: FastifyPluginAsyncZod<Deps> = async (app, deps) => {
  const { rooms, terminals, events, collaboration } = deps;

  app.get("/:id/sync", { websocket: true, schema: { hide: true, params } }, (socket, request) => {
    void collaboration.connect(request.params.id, socket).then((found) => {
      if (!found) socket.close(CLOSE_ROOM_NOT_FOUND, "Room not found");
    });
  });

  app.get(
    "/:id/session",
    { websocket: true, schema: { hide: true, params } },
    (socket, request) => {
      const { id } = request.params;
      const send = (message: ServerMessage) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
      };

      // Handlers are attached right away so nothing sent while the room loads is lost.
      const ready = join(id);
      let leave = () => {};
      socket.on("close", () => leave());
      socket.on("message", (raw: Buffer) => {
        const parsed = ClientMessageSchema.safeParse(parseJson(raw.toString()));
        if (!parsed.success) return;
        void ready
          .then((joined) => joined && handle(parsed.data))
          .catch((error: unknown) =>
            request.log.warn({ err: error, roomId: id }, "session failed"),
          );
      });

      async function join(roomId: RoomId): Promise<boolean> {
        const room = await rooms.find(roomId);
        if (!room || socket.readyState !== socket.OPEN) {
          socket.close(CLOSE_ROOM_NOT_FOUND, "Room not found");
          return false;
        }
        const unsubscribe = events.subscribe(roomId, (event) => {
          send(event);
          if (event.type === "room_deleted") socket.close(CLOSE_ROOM_NOT_FOUND, "Room deleted");
        });
        leave = () => {
          unsubscribe();
          terminals.detach(roomId);
        };

        // Catch up on what happened before we joined.
        const { scrollback, status, sandbox } = terminals.attach(roomId, room.runtime);
        send({ type: "runtime", runtime: room.runtime });
        send({ type: "sandbox", sandbox });
        if (scrollback) send({ type: "output", data: scrollback });
        send({ type: "status", status });
        return true;
      }

      function handle(message: ClientMessage) {
        switch (message.type) {
          case "input":
            return terminals.input(id, message.data);
          case "resize":
            return terminals.resize(id, message.cols, message.rows);
          case "run":
            return terminals.run(id);
          case "stop":
            return terminals.stop(id);
          case "reset":
            return terminals.reset(id);
          case "set_runtime":
            return rooms.setRuntime(id, message.runtime);
        }
      }
    },
  );
};
