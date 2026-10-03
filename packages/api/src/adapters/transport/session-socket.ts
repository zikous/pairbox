import type { FastifyBaseLogger } from "fastify";
import type { WebSocket } from "ws";
import {
  CLOSE_ROOM_NOT_FOUND,
  ClientMessageSchema,
  parseJson,
  type ClientMessage,
  type Participant,
  type RoomId,
  type ServerMessage,
} from "@pairbox/shared";
import type { RoomEvents } from "../../application/events";
import type { RecordingService } from "../../application/recordings";
import type { RoomService } from "../../application/rooms";
import type { TerminalService } from "../../application/terminals";

export interface SessionDeps {
  rooms: RoomService;
  recordings: RecordingService;
  terminals: TerminalService;
  events: RoomEvents;
}

/**
 * One browser on a room's session channel: terminal I/O, run controls and runtime changes.
 * Every action is recorded under the name the browser sent in its `hello`.
 */
export function openSession(
  socket: WebSocket,
  roomId: RoomId,
  { rooms, recordings, terminals, events }: SessionDeps,
  log: FastifyBaseLogger,
) {
  const send = (message: ServerMessage) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };
  let participant: Participant | undefined;
  let leave = () => {};

  // Handlers are attached right away so nothing sent while the room loads is lost.
  const ready = join();
  socket.on("close", () => leave());
  socket.on("message", (raw: Buffer) => {
    const parsed = ClientMessageSchema.safeParse(parseJson(raw.toString()));
    if (!parsed.success) return;
    void ready
      .then((joined) => joined && handle(parsed.data))
      .catch((error: unknown) => log.warn({ err: error, roomId }, "session message failed"));
  });

  async function join(): Promise<boolean> {
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
      if (participant) recordings.record(roomId, { type: "leave", by: participant });
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
    if (message.type === "hello") {
      if (!participant) recordings.record(roomId, { type: "join", by: message.participant });
      participant = message.participant;
      return;
    }

    const by = participant ?? { name: "Someone", color: "#888888" };
    switch (message.type) {
      case "input":
        recordings.record(roomId, { type: "input", data: message.data, by });
        return terminals.input(roomId, message.data);
      case "resize":
        return terminals.resize(roomId, message.cols, message.rows);
      case "run":
      case "stop":
      case "reset":
        recordings.record(roomId, { type: message.type, by });
        return terminals[message.type](roomId);
      case "set_runtime":
        recordings.record(roomId, { type: "runtime", runtime: message.runtime, by });
        return rooms.setRuntime(roomId, message.runtime);
    }
  }
}
