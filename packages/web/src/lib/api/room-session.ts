import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  Listeners,
  type ClientMessage,
  type Participant,
  type Room,
  type RunStatus,
  type Runtime,
  type SandboxState,
  type ServerMessage,
} from "@pairbox/shared";
import type { RoomSession, TerminalSession } from "./types";

const CONNECT_TIMEOUT_MS = 10_000;
const SCROLLBACK_MAX = 64_000;

/**
 * Connects to a room's two WebSockets:
 * - sync:    the shared document and presence, through the stock y-websocket client
 * - session: terminal and run controls, as JSON messages from @pairbox/shared
 */
export async function joinRoom(room: Room, me: Participant): Promise<RoomSession> {
  const base = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/rooms`;

  const doc = new Y.Doc();
  const provider = new WebsocketProvider(base, `${room.id}/sync`, doc, { disableBc: true });
  provider.awareness.setLocalStateField("user", {
    name: me.name,
    color: me.color,
    colorLight: `${me.color}33`,
  });

  const socket = new WebSocket(`${base}/${room.id}/session`);
  const send = (message: ClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  let runtime = room.runtime;
  const runtimeChanged = new Listeners<Runtime>();
  const deleted = new Listeners();
  const terminal = new RoomTerminal(send);

  socket.addEventListener("message", (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as ServerMessage;
    if (message.type === "runtime") {
      runtime = message.runtime;
      runtimeChanged.emit(runtime);
    } else if (message.type === "room_deleted") {
      deleted.emit();
    } else {
      terminal.receive(message);
    }
  });

  const leave = () => {
    provider.destroy();
    socket.close();
    doc.destroy();
  };

  try {
    await withTimeout(Promise.all([synced(provider), opened(socket)]), CONNECT_TIMEOUT_MS);
  } catch (error) {
    leave();
    throw error;
  }

  return {
    doc,
    awareness: provider.awareness,
    terminal,
    runtime: () => runtime,
    onRuntime: (listener) => runtimeChanged.add(listener),
    setRuntime: (next) => send({ type: "set_runtime", runtime: next }),
    onDeleted: (listener) => deleted.add(listener),
    leave,
  };
}

/**
 * The room's terminal as seen from this browser. Keeps the latest output and states, so a view
 * that subscribes late still sees them.
 */
class RoomTerminal implements TerminalSession {
  private scrollback = "";
  private status: RunStatus = { state: "idle" };
  private sandbox: SandboxState = { state: "starting" };
  private readonly output = new Listeners<string>();
  private readonly statusChanged = new Listeners<RunStatus>();
  private readonly sandboxChanged = new Listeners<SandboxState>();

  constructor(private readonly send: (message: ClientMessage) => void) {}

  onOutput(listener: (data: string) => void) {
    if (this.scrollback) listener(this.scrollback);
    return this.output.add(listener);
  }
  onStatus(listener: (status: RunStatus) => void) {
    listener(this.status);
    return this.statusChanged.add(listener);
  }
  onSandbox(listener: (sandbox: SandboxState) => void) {
    listener(this.sandbox);
    return this.sandboxChanged.add(listener);
  }

  input = (data: string) => this.send({ type: "input", data });
  resize = (cols: number, rows: number) => this.send({ type: "resize", cols, rows });
  run = () => this.send({ type: "run" });
  stop = () => this.send({ type: "stop" });
  reset = () => this.send({ type: "reset" });

  receive(message: Extract<ServerMessage, { type: "output" | "status" | "sandbox" }>) {
    if (message.type === "output") {
      // "\x1bc" resets the terminal, so older output no longer matters.
      const { data } = message;
      this.scrollback = data.includes("\x1bc")
        ? data
        : (this.scrollback + data).slice(-SCROLLBACK_MAX);
      this.output.emit(data);
    } else if (message.type === "status") {
      this.status = message.status;
      this.statusChanged.emit(message.status);
    } else {
      this.sandbox = message.sandbox;
      this.sandboxChanged.emit(message.sandbox);
    }
  }
}

function synced(provider: WebsocketProvider): Promise<void> {
  return new Promise((resolve, reject) => {
    if (provider.synced) return resolve();
    provider.once("sync", () => resolve());
    provider.once("closed", ({ reason }) => reject(new Error(reason || "Room not found")));
  });
}

function opened(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("close", (e) => reject(new Error(e.reason || "Disconnected")), {
      once: true,
    });
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out")), ms)),
  ]);
}
