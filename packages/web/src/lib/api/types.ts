import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import type {
  Availability,
  CreateRoom,
  Credentials,
  JoinRequest,
  JoinStatus,
  Participant,
  RecordingReplay,
  Room,
  RoomCounts,
  RoomId,
  RoomListQuery,
  RoomPage,
  RoomView,
  RunStatus,
  Runtime,
  SandboxState,
  SessionNotes,
  User,
} from "@pairbox/shared";

export interface AuthApi {
  /** The signed-in user, or null. */
  me(): Promise<User | null>;
  signUp(credentials: Credentials): Promise<User>;
  signIn(credentials: Credentials): Promise<User>;
  signOut(): Promise<void>;
}

/** Booked sessions (rooms). Listing, booking and deleting are for their signed-in owner. */
export interface RoomsApi {
  /** One page of a tab (live, upcoming or past), searched and filtered. */
  list(query: RoomListQuery): Promise<RoomPage>;
  /** How many sessions each tab has. */
  counts(): Promise<RoomCounts>;
  /** Anyone can look a room up by id. Null when it doesn't exist. */
  get(id: RoomId): Promise<RoomView | null>;
  create(input: CreateRoom): Promise<Room>;
  remove(id: RoomId): Promise<void>;
  /** Ends a session before its slot does. */
  end(id: RoomId): Promise<void>;
  /** Which half hours of the day starting at `from` can still be booked. */
  availability(from: Date, durationMinutes: number): Promise<Availability>;
}

/** Guests ask to join a room; its owner lets them in or not. */
export interface LobbyApi {
  ask(roomId: RoomId, participant: Participant): Promise<string>;
  status(roomId: RoomId, requestId: string): Promise<JoinStatus>;
  decide(roomId: RoomId, requestId: string, admit: boolean): Promise<void>;
}

/** Your private notes on one of your sessions: one Markdown document. */
export interface NotesApi {
  get(roomId: RoomId): Promise<SessionNotes>;
  save(roomId: RoomId, body: string): Promise<SessionNotes>;
}

/** The recording of one of your sessions. */
export interface RecordingsApi {
  get(roomId: RoomId): Promise<RecordingReplay>;
}

/** A live connection to one room: the shared document, presence and terminal. */
export interface RoomSession {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly terminal: TerminalSession;
  /** Tells the room who we are, so our terminal actions are attributed to us. */
  introduce(me: Participant): void;
  /** The room's language, now and whenever anyone switches it. */
  onRuntime(listener: (runtime: Runtime) => void): () => void;
  /** Switches the room's language, for everyone in it. */
  setRuntime(runtime: Runtime): void;
  /** The owner only: who is waiting to be let in. */
  onJoinRequests(listener: (requests: JoinRequest[]) => void): () => void;
  /** The session is over for everyone: its slot ended, or the room was deleted. */
  onEnded(listener: (why: "time" | "deleted") => void): () => void;
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
  lobby: LobbyApi;
  recordings: RecordingsApi;
  notes: NotesApi;
  /**
   * Connects to an open room, as its owner or as a guest with their ticket. Resolves once the
   * room's current state has been received.
   */
  join(room: Room, me: Participant, ticket?: string): Promise<RoomSession>;
}
