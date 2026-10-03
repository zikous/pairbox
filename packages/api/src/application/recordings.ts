import type {
  Participant,
  Recording,
  RecordingEvent,
  RecordingReplay,
  RoomId,
} from "@pairbox/shared";
import type { RoomEvents } from "./events";
import type { CollaborationObserver, RecordingRepository, RecordingStore } from "./ports";

/** A recording event before its timestamp is added. */
type Recorded = RecordingEvent extends infer E ? (E extends unknown ? Omit<E, "t"> : never) : never;

interface Session {
  id: string;
  startedAt: number;
  buffer: RecordingEvent[];
  chunks: number;
  participants: Map<string, Participant>;
  flushTimer: ReturnType<typeof setInterval>;
  endTimer?: ReturnType<typeof setTimeout>;
  unsubscribe: () => void;
}

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/**
 * Records every session of a room, so its owner can replay it: edits with their author,
 * cursors, terminal input and output, runs, and who came and went. A session starts when the
 * first person opens the room and ends `graceMs` after the last one leaves. Events are written
 * in chunks every `flushMs`.
 */
export class RecordingService implements CollaborationObserver {
  private readonly sessions = new Map<RoomId, Session>();

  constructor(
    private readonly repository: RecordingRepository,
    private readonly store: RecordingStore,
    private readonly events: RoomEvents,
    private readonly options = { flushMs: 5_000, graceMs: 30_000 },
  ) {}

  opened(roomId: RoomId, state: Uint8Array): void {
    const existing = this.sessions.get(roomId);
    if (existing) return clearTimeout(existing.endTimer); // back within the grace period

    const id = crypto.randomUUID();
    const startedAt = new Date();
    const session: Session = {
      id,
      startedAt: startedAt.getTime(),
      buffer: [],
      chunks: 0,
      participants: new Map(),
      flushTimer: setInterval(() => void this.flush(roomId, session), this.options.flushMs),
      // The terminal's output, status and runtime changes reach the room through RoomEvents.
      unsubscribe: this.events.subscribe(roomId, (event) => {
        if (event.type === "output" || event.type === "status" || event.type === "runtime") {
          this.record(roomId, event);
        }
      }),
    };
    this.sessions.set(roomId, session);
    void this.repository
      .create({ id, roomId, startedAt })
      .then(() => this.store.saveSnapshot(roomId, id, state));
  }

  closed(roomId: RoomId): void {
    const session = this.sessions.get(roomId);
    if (!session) return;
    clearTimeout(session.endTimer);
    session.endTimer = setTimeout(() => void this.end(roomId), this.options.graceMs);
  }

  edited(roomId: RoomId, update: Uint8Array, by: Participant | undefined): void {
    this.record(
      roomId,
      by ? { type: "edit", update: base64(update), by } : { type: "edit", update: base64(update) },
    );
  }

  presence(roomId: RoomId, update: Uint8Array): void {
    this.record(roomId, { type: "presence", update: base64(update) });
  }

  record(roomId: RoomId, event: Recorded): void {
    const session = this.sessions.get(roomId);
    if (!session) return;
    if (event.type === "join") session.participants.set(event.by.name, event.by);
    session.buffer.push({ t: Date.now() - session.startedAt, ...event } as RecordingEvent);
  }

  list(roomId: RoomId): Promise<Recording[]> {
    return this.repository.listByRoom(roomId);
  }

  get(id: string) {
    return this.repository.get(id);
  }

  async replay(recording: Recording & { chunkCount: number }): Promise<RecordingReplay> {
    const [snapshot, events] = await Promise.all([
      this.store.loadSnapshot(recording.roomId, recording.id),
      this.store.readChunks(recording.roomId, recording.id, recording.chunkCount),
    ]);
    const { id, roomId, startedAt, endedAt, participants } = recording;
    return {
      recording: { id, roomId, startedAt, endedAt, participants },
      snapshot: base64(snapshot),
      events,
    };
  }

  /** Ends the room's session (if any) and deletes all its recordings. */
  async deleteRoom(roomId: RoomId): Promise<void> {
    const session = this.sessions.get(roomId);
    if (session) this.stopTimers(roomId, session);
    await this.store.deleteRoom(roomId);
  }

  /** Ends every session, saving what's left. For shutting down. */
  async endAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((roomId) => this.end(roomId)));
  }

  private async end(roomId: RoomId): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;
    this.stopTimers(roomId, session);
    await this.flush(roomId, session);
    await this.repository.update(session.id, { endedAt: new Date() });
  }

  private stopTimers(roomId: RoomId, session: Session): void {
    clearInterval(session.flushTimer);
    clearTimeout(session.endTimer);
    session.unsubscribe();
    this.sessions.delete(roomId);
  }

  private async flush(roomId: RoomId, session: Session): Promise<void> {
    if (session.buffer.length === 0) return;
    const events = session.buffer.splice(0);
    const seq = session.chunks++;
    await this.store.appendChunk(roomId, session.id, seq, events);
    await this.repository.update(session.id, {
      chunkCount: session.chunks,
      participants: [...session.participants.values()],
    });
  }
}
