import type { Participant, RecordingEvent, RecordingReplay, RoomId } from "@pairbox/shared";
import type { RoomEvents } from "./events";
import { RecordingNotFoundError } from "./errors";
import type { CollaborationObserver, RecordingRepository, RecordingStore } from "./ports";

/** A recording event before its timestamp is added. */
type Recorded = RecordingEvent extends infer E ? (E extends unknown ? Omit<E, "t"> : never) : never;

interface Session {
  /** Set once the room's recording is found or created. */
  recording?: { id: string; startedAt: number };
  ready: Promise<void>;
  /** Events with the moment they happened, until they're written. */
  buffer: { at: number; event: Recorded }[];
  chunks: number;
  participants: Map<string, Participant>;
  flushTimer: ReturnType<typeof setInterval>;
  unsubscribe: () => void;
}

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/**
 * Records each room's session, so its owner can replay it: edits with their author, cursors,
 * terminal input and output, runs, and who came and went. A room has one recording: it starts
 * when the room is first opened, pauses while nobody is in it, and closes when the session
 * ends. Events are written in chunks every `flushMs`.
 */
export class RecordingService implements CollaborationObserver {
  private readonly sessions = new Map<RoomId, Session>();

  constructor(
    private readonly repository: RecordingRepository,
    private readonly store: RecordingStore,
    private readonly events: RoomEvents,
    private readonly flushMs = 5_000,
  ) {}

  opened(roomId: RoomId, state: Uint8Array): void {
    if (this.sessions.has(roomId)) return;
    const session: Session = {
      ready: Promise.resolve(),
      buffer: [],
      chunks: 0,
      participants: new Map(),
      flushTimer: setInterval(() => void this.flush(roomId, session), this.flushMs),
      // The terminal's output and status reach the room through RoomEvents.
      unsubscribe: this.events.subscribe(roomId, (event) => {
        if (event.type === "output" || event.type === "status") this.record(roomId, event);
      }),
    };
    session.ready = this.resume(roomId, session, state);
    this.sessions.set(roomId, session);
  }

  /** Nobody is in the room anymore: save what's buffered. The recording resumes if they return. */
  closed(roomId: RoomId): void {
    void this.pause(roomId);
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
    session.buffer.push({ at: Date.now(), event });
  }

  /** Who took part in each of these rooms' sessions. */
  participants(roomIds: RoomId[]): Promise<Map<RoomId, Participant[]>> {
    return this.repository.participantsByRoom(roomIds);
  }

  async replay(roomId: RoomId): Promise<RecordingReplay> {
    const recording = await this.repository.getByRoom(roomId);
    if (!recording) throw new RecordingNotFoundError(roomId);
    const [snapshot, events] = await Promise.all([
      this.store.loadSnapshot(roomId, recording.id),
      this.store.readChunks(roomId, recording.id, recording.chunkCount),
    ]);
    const { id, startedAt, endedAt, participants } = recording;
    return {
      recording: { id, roomId, startedAt, endedAt, participants },
      snapshot: base64(snapshot),
      events,
    };
  }

  /** The session is over: save what's left and close the recording. */
  async finish(roomId: RoomId): Promise<void> {
    await this.pause(roomId);
    const recording = await this.repository.getByRoom(roomId);
    if (recording && !recording.endedAt) {
      await this.repository.update(recording.id, { endedAt: new Date() });
    }
  }

  /** Stops recording the room and deletes its recording. */
  async deleteRoom(roomId: RoomId): Promise<void> {
    this.stop(roomId);
    await this.store.deleteRoom(roomId);
  }

  /** Saves what every open room has buffered. For shutting down. */
  async pauseAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((roomId) => this.pause(roomId)));
  }

  private async resume(roomId: RoomId, session: Session, state: Uint8Array): Promise<void> {
    const existing = await this.repository.getByRoom(roomId);
    if (existing) {
      session.recording = { id: existing.id, startedAt: Date.parse(existing.startedAt) };
      session.chunks = existing.chunkCount;
      for (const participant of existing.participants) {
        session.participants.set(participant.name, participant);
      }
      return;
    }
    const recording = { id: crypto.randomUUID(), roomId, startedAt: new Date() };
    session.recording = { id: recording.id, startedAt: recording.startedAt.getTime() };
    await this.repository.create(recording);
    await this.store.saveSnapshot(roomId, recording.id, state);
  }

  private async pause(roomId: RoomId): Promise<void> {
    const session = this.stop(roomId);
    if (session) await this.flush(roomId, session);
  }

  private stop(roomId: RoomId): Session | undefined {
    const session = this.sessions.get(roomId);
    if (!session) return undefined;
    clearInterval(session.flushTimer);
    session.unsubscribe();
    this.sessions.delete(roomId);
    return session;
  }

  private async flush(roomId: RoomId, session: Session): Promise<void> {
    await session.ready;
    const { recording } = session;
    if (!recording || session.buffer.length === 0) return;
    const events = session.buffer
      .splice(0)
      .map(({ at, event }) => ({ t: at - recording.startedAt, ...event }) as RecordingEvent);
    const seq = session.chunks++;
    await this.store.appendChunk(roomId, recording.id, seq, events);
    await this.repository.update(recording.id, {
      chunkCount: session.chunks,
      participants: [...session.participants.values()],
    });
  }
}
