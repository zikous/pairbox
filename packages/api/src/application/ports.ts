import type {
  Participant,
  Recording,
  RecordingEvent,
  Room,
  RoomId,
  RunStatus,
  Runtime,
  User,
} from "@pairbox/shared";

/** What the application needs from the outside world. Adapters implement these. */

/** A room together with the user who created it. */
export interface OwnedRoom extends Room {
  ownerId: string;
}

export interface RoomRepository {
  listByOwner(ownerId: string): Promise<OwnedRoom[]>;
  get(id: RoomId): Promise<OwnedRoom | undefined>;
  save(room: OwnedRoom): Promise<void>;
  delete(id: RoomId): Promise<void>;
}

export interface UserRepository {
  /** Returns undefined when the email is already taken. */
  create(email: string, passwordHash: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<(User & { passwordHash: string }) | undefined>;
}

/** Sessions are stored by a hash of their token, never by the token itself. */
export interface SessionRepository {
  create(session: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void>;
  /** The session's user, if the session exists and hasn't expired. */
  findUser(tokenHash: string): Promise<User | undefined>;
  delete(tokenHash: string): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

/** Each room's document, stored as its CRDT state. */
export interface WorkspaceRepository {
  load(roomId: RoomId): Promise<Uint8Array | undefined>;
  save(roomId: RoomId, state: Uint8Array): Promise<void>;
}

/** The shared documents edited in each room. */
export interface Collaboration {
  create(roomId: RoomId, initialCode: string): Promise<void>;
  /** The room's current code, or "" when nobody has it open. */
  code(roomId: RoomId): string;
  destroy(roomId: RoomId): void;
}

/** Hands out isolated machines (workers) to rooms. */
export interface Sandboxes {
  /**
   * Gets a machine for the room and opens its terminal. Waits in line when none is free,
   * reporting the room's position. Aborting gives up the place in line.
   */
  open(
    request: { roomId: RoomId; runtime: Runtime },
    options: { onWaiting: (position: number) => void; signal: AbortSignal },
  ): Promise<SandboxSession>;
}

/** A room's terminal on its machine. Closing it gives the machine back. */
export interface SandboxSession {
  onOutput(listener: (data: string) => void): void;
  onStatus(listener: (status: RunStatus) => void): void;
  /** The machine went away (crashed, network lost). */
  onLost(listener: () => void): void;
  input(data: string): void;
  resize(cols: number, rows: number): void;
  /** Saves the code into the machine's workspace. */
  write(code: string): void;
  /** Saves the code and runs it in the shell. */
  run(code: string): void;
  stop(): void;
  close(): Promise<void>;
}

/** The index of recorded sessions. */
export interface RecordingRepository {
  create(recording: { id: string; roomId: RoomId; startedAt: Date }): Promise<void>;
  update(
    id: string,
    changes: { endedAt?: Date; participants?: Participant[]; chunkCount?: number },
  ): Promise<void>;
  listByRoom(roomId: RoomId): Promise<Recording[]>;
  get(id: string): Promise<(Recording & { chunkCount: number }) | undefined>;
}

/** Where recorded sessions are kept: a starting snapshot plus chunks of events. */
export interface RecordingStore {
  saveSnapshot(roomId: RoomId, recordingId: string, state: Uint8Array): Promise<void>;
  loadSnapshot(roomId: RoomId, recordingId: string): Promise<Uint8Array>;
  appendChunk(
    roomId: RoomId,
    recordingId: string,
    seq: number,
    events: RecordingEvent[],
  ): Promise<void>;
  readChunks(roomId: RoomId, recordingId: string, count: number): Promise<RecordingEvent[]>;
  deleteRoom(roomId: RoomId): Promise<void>;
}

/** Told about everything that happens to the shared documents. */
export interface CollaborationObserver {
  /** The first person opened the room's document. `state` is the document at that moment. */
  opened(roomId: RoomId, state: Uint8Array): void;
  /** The last person closed it. */
  closed(roomId: RoomId): void;
  edited(roomId: RoomId, update: Uint8Array, by: Participant | undefined): void;
  /** Cursors, selections and who is here. */
  presence(roomId: RoomId, update: Uint8Array): void;
}
