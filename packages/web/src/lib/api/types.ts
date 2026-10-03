import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import type {
  CreateRoom,
  Credentials,
  Participant,
  Recording,
  RecordingReplay,
  Room,
  RoomId,
  RunStatus,
  Runtime,
  SandboxState,
  User,
} from "@pairbox/shared";

export interface AuthApi {
  /** The signed-in user, or null. */
  me(): Promise<User | null>;
  signUp(credentials: Credentials): Promise<User>;
  signIn(credentials: Credentials): Promise<User>;
  signOut(): Promise<void>;
}

/** Room management. Listing, creating and deleting are for signed-in users and their rooms. */
export interface RoomsApi {
  list(): Promise<Room[]>;
  /** Anyone can look a room up by id. Null when it doesn't exist. */
  get(id: RoomId): Promise<Room | null>;
  create(input: CreateRoom): Promise<Room>;
  remove(id: RoomId): Promise<void>;
}

/** Recorded sessions of your rooms. */
export interface RecordingsApi {
  list(roomId: RoomId): Promise<Recording[]>;
  get(id: string): Promise<RecordingReplay>;
}

/** A live connection to one room: the shared document, presence and terminal. */
export interface RoomSession {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly terminal: TerminalSession;
  runtime(): Runtime;
  onRuntime(listener: (runtime: Runtime) => void): () => void;
  setRuntime(runtime: Runtime): void;
  /** Tells the room who we are, so our terminal actions are attributed to us. */
  introduce(me: Participant): void;
  /** Called when the host deletes the room while we're in it. */
  onDeleted(listener: () => void): () => void;
  leave(): void;
}

/** The room's shared terminal. Input and output are raw terminal bytes. */
export interface TerminalSession {
  onOutput(listener: (data: string) => void): () => void;
  onStatus(listener: (status: RunStatus) => void): () => void;
  /** Whether a machine is behind the terminal yet (or the room is waiting in line). */
  onSandbox(listener: (sandbox: SandboxState) => void): () => void;
  input(data: string): void;
  run(): void;
  stop(): void;
  reset(): void;
  resize(cols: number, rows: number): void;
}

export interface Api {
  auth: AuthApi;
  rooms: RoomsApi;
  recordings: RecordingsApi;
  /** Resolves once the room's current state has been received. */
  join(room: Room, me: Participant): Promise<RoomSession>;
}
