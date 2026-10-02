import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import type {
  CreateRoom,
  Runtime,
  Participant,
  Room,
  RoomId,
  RunStatus,
  SandboxState,
} from "@pairbox/shared";

/** Room management. Creating, listing and deleting require the host secret. */
export interface RoomsApi {
  unlock(secret: string): Promise<boolean>;
  list(): Promise<Room[]>;
  get(id: RoomId): Promise<Room | null>;
  create(input: CreateRoom): Promise<Room>;
  remove(id: RoomId): Promise<void>;
}

/** A live connection to one room: the shared document, presence and terminal. */
export interface RoomSession {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly terminal: TerminalSession;
  runtime(): Runtime;
  onRuntime(listener: (runtime: Runtime) => void): () => void;
  setRuntime(runtime: Runtime): void;
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
  rooms: RoomsApi;
  /** Resolves once the room's current state has been received. */
  join(room: Room, me: Participant): Promise<RoomSession>;
}
