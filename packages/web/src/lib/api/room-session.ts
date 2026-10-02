import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type {
  ClientMessage,
  ServerMessage,
  Language,
  Participant,
  Room,
  RunStatus,
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

  let language = room.language;
  const languageListeners = new Set<(language: Language) => void>();
  const deletedListeners = new Set<() => void>();
  const terminal = createTerminal(send);

  socket.addEventListener("message", (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as ServerMessage;
    switch (message.type) {
      case "output":
        return terminal.receiveOutput(message.data);
      case "status":
        return terminal.receiveStatus(message.status);
      case "language":
        language = message.language;
        return languageListeners.forEach((listener) => listener(language));
      case "room_deleted":
        return deletedListeners.forEach((listener) => listener());
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
    language: () => language,
    onLanguage(listener) {
      languageListeners.add(listener);
      return () => languageListeners.delete(listener);
    },
    setLanguage: (next) => send({ type: "set_language", language: next }),
    onDeleted(listener) {
      deletedListeners.add(listener);
      return () => deletedListeners.delete(listener);
    },
    leave,
  };
}

/** Keeps recent output so a terminal view that subscribes late still sees it. */
function createTerminal(send: (message: ClientMessage) => void) {
  const outputListeners = new Set<(data: string) => void>();
  const statusListeners = new Set<(status: RunStatus) => void>();
  let scrollback = "";
  let status: RunStatus = { state: "idle" };

  const terminal: TerminalSession & {
    receiveOutput(data: string): void;
    receiveStatus(status: RunStatus): void;
  } = {
    onOutput(listener) {
      if (scrollback) listener(scrollback);
      outputListeners.add(listener);
      return () => outputListeners.delete(listener);
    },
    onStatus(listener) {
      listener(status);
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    input: (data) => send({ type: "input", data }),
    run: () => send({ type: "run" }),
    stop: () => send({ type: "stop" }),
    reset: () => send({ type: "reset" }),

    receiveOutput(data) {
      // "\x1bc" resets the terminal, so older output no longer matters.
      scrollback = data.includes("\x1bc") ? data : (scrollback + data).slice(-SCROLLBACK_MAX);
      outputListeners.forEach((listener) => listener(data));
    },
    receiveStatus(next) {
      status = next;
      statusListeners.forEach((listener) => listener(next));
    },
  };
  return terminal;
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
    socket.addEventListener("close", (event) => reject(new Error(event.reason || "Disconnected")), {
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
