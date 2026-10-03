import type { FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import {
  CLOSE_ROOM_NOT_FOUND,
  ClientMessageSchema,
  parseJson,
  type ClientMessage,
  type Participant,
  type ServerMessage,
} from "@pairbox/shared";
import type { AuthService } from "../../application/auth";
import type { RoomEvents } from "../../application/events";
import type { Lobby } from "../../application/lobby";
import type { RecordingService } from "../../application/recordings";
import type { RoomService } from "../../application/rooms";
import type { SessionClock } from "../../application/session-clock";
import type { TerminalService } from "../../application/terminals";
import { roomAccess } from "./room-access";

export interface SessionDeps {
  auth: AuthService;
  rooms: RoomService;
  lobby: Lobby;
  clock: SessionClock;
  recordings: RecordingService;
  terminals: TerminalService;
  events: RoomEvents;
}

/**
 * One browser on a room's session channel: terminal I/O and run controls. Every action is
 * recorded under the name of whoever sent it. The owner also hears about join requests.
 */
export function openSession(
  socket: WebSocket,
  request: FastifyRequest<{ Params: { id: string } }>,
  deps: SessionDeps,
) {
  const { rooms, lobby, clock, recordings, terminals, events } = deps;
  const roomId = request.params.id;
  const send = (message: ServerMessage) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };
  let participant: Participant | undefined;
  let leave = () => {};

  // Handlers are attached right away so nothing sent while access is checked is lost.
  const ready = join();
  socket.on("close", () => leave());
  socket.on("message", (raw: Buffer) => {
    const parsed = ClientMessageSchema.safeParse(parseJson(raw.toString()));
    if (!parsed.success) return;
    void ready
      .then((joined) => joined && handle(parsed.data))
      .catch((error: unknown) =>
        request.log.warn({ err: error, roomId }, "session message failed"),
      );
  });

  async function join(): Promise<boolean> {
    const room = await rooms.find(roomId);
    if (!room) return close(CLOSE_ROOM_NOT_FOUND, "Room not found");
    const access = await roomAccess(request, room, deps);
    if (!access.allowed) return close(access.code, access.reason);
    if (socket.readyState !== socket.OPEN) return false;

    if (!access.owner) introduce(access.participant);
    const unsubscribe = events.subscribe(roomId, (event) => {
      // Who is waiting to come in is the owner's business only.
      if (event.type === "join_requests" && !access.owner) return;
      send(event);
      if (event.type === "room_deleted") socket.close(CLOSE_ROOM_NOT_FOUND, "Room deleted");
    });
    leave = () => {
      unsubscribe();
      terminals.detach(roomId);
      if (participant) recordings.record(roomId, { type: "leave", by: participant });
    };

    clock.watch(room);
    // Catch up on what happened before we joined.
    const { scrollback, status, sandbox } = terminals.attach(roomId, room.runtime);
    send({ type: "sandbox", sandbox });
    if (scrollback) send({ type: "output", data: scrollback });
    send({ type: "status", status });
    if (access.owner) send({ type: "join_requests", requests: lobby.pending(roomId) });
    return true;
  }

  function close(code: number, reason: string): false {
    socket.close(code, reason);
    return false;
  }

  function introduce(who: Participant) {
    if (!participant) recordings.record(roomId, { type: "join", by: who });
    participant = who;
  }

  function handle(message: ClientMessage) {
    if (message.type === "hello") return introduce(message.participant);

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
    }
  }
}
