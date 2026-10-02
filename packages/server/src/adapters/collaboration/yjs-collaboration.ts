import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import type { WebSocket } from "ws";
import { CLOSE_ROOM_NOT_FOUND, type RoomId } from "@pairbox/shared";
import type { Collaboration } from "../../application/ports";

// Message types of the standard y-websocket protocol.
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;
const PING_INTERVAL_MS = 30_000;

/**
 * Holds each room's document in memory and syncs it with every connected browser, using the
 * protocol the stock `y-websocket` client speaks. Presence (cursors, names) rides along as
 * Yjs "awareness".
 */
export class YjsCollaboration implements Collaboration {
  private readonly docs = new Map<RoomId, SharedDoc>();

  create(roomId: RoomId, initialCode: string): void {
    const shared = new SharedDoc();
    shared.doc.getText("code").insert(0, initialCode);
    this.docs.set(roomId, shared);
  }

  code(roomId: RoomId): string {
    return this.docs.get(roomId)?.doc.getText("code").toString() ?? "";
  }

  destroy(roomId: RoomId): void {
    this.docs.get(roomId)?.destroy();
    this.docs.delete(roomId);
  }

  /** Returns false when the room has no document. */
  connect(roomId: RoomId, socket: WebSocket): boolean {
    const shared = this.docs.get(roomId);
    if (!shared) return false;
    shared.connect(socket);
    return true;
  }
}

class SharedDoc {
  readonly doc = new Y.Doc();
  private readonly awareness = new awarenessProtocol.Awareness(this.doc);
  /** Each socket, with the awareness client ids it controls. */
  private readonly sockets = new Map<WebSocket, Set<number>>();

  constructor() {
    this.awareness.setLocalState(null); // the server itself has no cursor

    this.doc.on("update", (update: Uint8Array) => {
      this.broadcast(message(MESSAGE_SYNC, (e) => syncProtocol.writeUpdate(e, update)));
    });

    this.awareness.on(
      "update",
      (changes: Record<"added" | "updated" | "removed", number[]>, origin: unknown) => {
        const owned = this.sockets.get(origin as WebSocket);
        if (owned) {
          for (const id of changes.added) owned.add(id);
          for (const id of changes.removed) owned.delete(id);
        }
        const changed = [...changes.added, ...changes.updated, ...changes.removed];
        const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed);
        this.broadcast(message(MESSAGE_AWARENESS, (e) => encoding.writeVarUint8Array(e, update)));
      },
    );
  }

  connect(socket: WebSocket): void {
    this.sockets.set(socket, new Set());

    let alive = true;
    const ping = setInterval(() => {
      if (!alive) return socket.terminate();
      alive = false;
      socket.ping();
    }, PING_INTERVAL_MS);
    socket.on("pong", () => (alive = true));

    socket.on("message", (data: Buffer) => this.receive(socket, new Uint8Array(data)));
    socket.on("close", () => {
      clearInterval(ping);
      const owned = this.sockets.get(socket);
      this.sockets.delete(socket);
      if (owned?.size) awarenessProtocol.removeAwarenessStates(this.awareness, [...owned], null);
    });

    // Start the sync handshake and share who is already here.
    send(
      socket,
      message(MESSAGE_SYNC, (e) => syncProtocol.writeSyncStep1(e, this.doc)),
    );
    this.sendAwareness(socket);
  }

  destroy(): void {
    for (const socket of this.sockets.keys()) socket.close(CLOSE_ROOM_NOT_FOUND, "Room deleted");
    this.awareness.destroy();
    this.doc.destroy();
  }

  private receive(socket: WebSocket, data: Uint8Array): void {
    const decoder = decoding.createDecoder(data);
    const type = decoding.readVarUint(decoder);

    if (type === MESSAGE_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, this.doc, socket);
      // Only reply when the message called for an answer (sync step 1 → step 2).
      if (encoding.length(encoder) > 1) send(socket, encoding.toUint8Array(encoder));
    } else if (type === MESSAGE_AWARENESS) {
      const update = decoding.readVarUint8Array(decoder);
      awarenessProtocol.applyAwarenessUpdate(this.awareness, update, socket);
    } else if (type === MESSAGE_QUERY_AWARENESS) {
      this.sendAwareness(socket);
    }
  }

  private sendAwareness(socket: WebSocket): void {
    const clients = [...this.awareness.getStates().keys()];
    if (clients.length === 0) return;
    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, clients);
    send(
      socket,
      message(MESSAGE_AWARENESS, (e) => encoding.writeVarUint8Array(e, update)),
    );
  }

  private broadcast(data: Uint8Array): void {
    for (const socket of this.sockets.keys()) send(socket, data);
  }
}

function message(type: number, write: (encoder: encoding.Encoder) => void): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, type);
  write(encoder);
  return encoding.toUint8Array(encoder);
}

function send(socket: WebSocket, data: Uint8Array): void {
  if (socket.readyState === socket.OPEN) socket.send(data);
}
