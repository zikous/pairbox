import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  CLOSE_ROOM_NOT_FOUND,
  ClientMessageSchema,
  RoomIdSchema,
  type ClientMessage,
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
 * - /session terminal I/O, run controls and language changes (JSON, see @pairbox/shared)
 */
export const roomSockets: FastifyPluginAsyncZod<Deps> = async (app, deps) => {
  const { rooms, terminals, events, collaboration } = deps;

  app.get("/:id/sync", { websocket: true, schema: { hide: true, params } }, (socket, request) => {
    if (!collaboration.connect(request.params.id, socket)) {
      socket.close(CLOSE_ROOM_NOT_FOUND, "Room not found");
    }
  });

  app.get(
    "/:id/session",
    { websocket: true, schema: { hide: true, params } },
    (socket, request) => {
      const { id } = request.params;
      const room = rooms.find(id);
      if (!room) return socket.close(CLOSE_ROOM_NOT_FOUND, "Room not found");

      const send = (message: ServerMessage) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
      };

      const unsubscribe = events.subscribe(id, (event) => {
        send(event);
        if (event.type === "room_deleted") socket.close(CLOSE_ROOM_NOT_FOUND, "Room deleted");
      });

      // Catch up on what happened before we joined.
      const { scrollback, status } = terminals.attach(id);
      send({ type: "language", language: room.language });
      if (scrollback) send({ type: "output", data: scrollback });
      send({ type: "status", status });

      socket.on("message", (raw: Buffer) => {
        const parsed = ClientMessageSchema.safeParse(safeJson(raw.toString()));
        if (!parsed.success) return;
        try {
          handle(parsed.data);
        } catch (error) {
          request.log.warn({ err: error, roomId: id }, "session message failed");
        }
      });

      function handle(message: ClientMessage) {
        switch (message.type) {
          case "input":
            return terminals.input(id, message.data);
          case "run":
            return terminals.run(id);
          case "stop":
            return terminals.stop(id);
          case "reset":
            return terminals.reset(id);
          case "set_language":
            return rooms.setLanguage(id, message.language);
        }
      }

      socket.on("close", () => {
        unsubscribe();
        terminals.detach(id);
      });
    },
  );
};

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
