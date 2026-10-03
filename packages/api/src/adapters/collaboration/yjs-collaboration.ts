import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import type { WebSocket } from "ws";
import { CLOSE_ROOM_NOT_FOUND, type Participant, type RoomId } from "@pairbox/shared";
import type {
  Collaboration,
  CollaborationObserver,
  WorkspaceRepository,
} from "../../application/ports";

// Message types of the standard y-websocket protocol.
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;
const PING_INTERVAL_MS = 30_000;

const SAVE_DELAY_MS = 1_000;
const UNLOAD_AFTER_MS = 5 * 60_000;

/**
 * Holds open rooms' documents in memory and syncs them with every connected browser, using the
 * protocol the stock `y-websocket` client speaks. Presence (cursors, names) rides along as
 * Yjs "awareness". Documents are saved shortly after each change, loaded on first use, and
 * dropped from memory once nobody has had them open for a while.
 */
export class YjsCollaboration implements Collaboration {
  private readonly docs = new Map<RoomId, SharedDoc>();
  private readonly loading = new Map<RoomId, Promise<SharedDoc | undefined>>();

  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly observer?: CollaborationObserver,
  ) {}

  async create(roomId: RoomId, initialCode: string): Promise<void> {
    const shared = this.track(roomId, new Y.Doc());
    shared.doc.getText("code").insert(0, initialCode);
    await this.workspaces.save(roomId, Y.encodeStateAsUpdate(shared.doc));
  }

  code(roomId: RoomId): string {
    return this.docs.get(roomId)?.doc.getText("code").toString() ?? "";
  }

  destroy(roomId: RoomId): void {
    this.docs.get(roomId)?.destroy();
    this.docs.delete(roomId);
  }

  /** Returns false when the room has no saved document. */
  async connect(roomId: RoomId, socket: WebSocket): Promise<boolean> {
    // The client starts syncing as soon as it connects: keep its messages until we're ready.
    const early: Buffer[] = [];
    const hold = (data: Buffer) => early.push(data);
    socket.on("message", hold);

    const shared = this.docs.get(roomId) ?? (await this.load(roomId));
    socket.off("message", hold);
    if (!shared) return false;
    shared.connect(socket, early);
    return true;
  }

  private load(roomId: RoomId): Promise<SharedDoc | undefined> {
    const pending =
      this.loading.get(roomId) ??
      this.workspaces.load(roomId).then((state) => {
        this.loading.delete(roomId);
        if (!state) return undefined;
        const doc = new Y.Doc();
        Y.applyUpdate(doc, state);
        return this.docs.get(roomId) ?? this.track(roomId, doc);
      });
    this.loading.set(roomId, pending);
    return pending;
  }

  private track(roomId: RoomId, doc: Y.Doc): SharedDoc {
    const observer = this.observer;
    const shared = new SharedDoc(doc, {
      save: (state) => this.workspaces.save(roomId, state),
      unload: () => {
        if (this.docs.get(roomId) === shared) this.destroy(roomId);
      },
      opened: (state) => observer?.opened(roomId, state),
      closed: () => observer?.closed(roomId),
      edited: (update, by) => observer?.edited(roomId, update, by),
      presence: (update) => observer?.presence(roomId, update),
    });
    this.docs.set(roomId, shared);
    return shared;
  }
}

class SharedDoc {
  private readonly awareness: awarenessProtocol.Awareness;
  /** Each socket, with the awareness client ids it controls. */
  private readonly sockets = new Map<WebSocket, Set<number>>();
  private saveTimer?: ReturnType<typeof setTimeout>;
  private unloadTimer?: ReturnType<typeof setTimeout>;

  constructor(
    readonly doc: Y.Doc,
    private readonly hooks: {
      save: (state: Uint8Array) => Promise<void>;
      unload: () => void;
      opened: (state: Uint8Array) => void;
      closed: () => void;
      edited: (update: Uint8Array, by: Participant | undefined) => void;
      presence: (update: Uint8Array) => void;
    },
  ) {
    this.awareness = new awarenessProtocol.Awareness(doc);
    this.awareness.setLocalState(null); // the server itself has no cursor
    this.scheduleUnload();

    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      this.broadcast(message(MESSAGE_SYNC, (e) => syncProtocol.writeUpdate(e, update)));
      this.hooks.edited(update, this.participantOf(origin as WebSocket));
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => void this.save(), SAVE_DELAY_MS);
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
        this.hooks.presence(update);
      },
    );
  }

  connect(socket: WebSocket, early: Buffer[]): void {
    clearTimeout(this.unloadTimer);
    if (this.sockets.size === 0) this.hooks.opened(Y.encodeStateAsUpdate(this.doc));
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
      if (this.sockets.size === 0) {
        this.hooks.closed();
        void this.save();
        this.scheduleUnload();
      }
    });

    // Start the sync handshake and share who is already here.
    send(
      socket,
      message(MESSAGE_SYNC, (e) => syncProtocol.writeSyncStep1(e, this.doc)),
    );
    this.sendAwareness(socket);
    // Answer what the client sent while its document was loading.
    for (const data of early) this.receive(socket, new Uint8Array(data));
  }

  destroy(): void {
    clearTimeout(this.saveTimer);
    clearTimeout(this.unloadTimer);
    for (const socket of this.sockets.keys()) socket.close(CLOSE_ROOM_NOT_FOUND, "Room deleted");
    this.awareness.destroy();
    this.doc.destroy();
  }

  /** Who is behind a socket: the name and color they share through awareness. */
  private participantOf(socket: WebSocket): Participant | undefined {
    for (const clientId of this.sockets.get(socket) ?? []) {
      const user = this.awareness.getStates().get(clientId)?.["user"] as Participant | undefined;
      if (user) return { name: user.name, color: user.color };
    }
    return undefined;
  }

  private async save(): Promise<void> {
    clearTimeout(this.saveTimer);
    await this.hooks.save(Y.encodeStateAsUpdate(this.doc)).catch(() => {});
  }

  private scheduleUnload(): void {
    clearTimeout(this.unloadTimer);
    this.unloadTimer = setTimeout(() => {
      if (this.sockets.size === 0) this.hooks.unload();
    }, UNLOAD_AFTER_MS);
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
