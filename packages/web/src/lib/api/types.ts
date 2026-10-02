import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import type { Language, Participant, Room, RoomId, RunStatus } from "@pairbox/domain";

/** Room management. Creating, listing and deleting require the host secret. */
export interface RoomsApi {
  unlock(secret: string): Promise<boolean>;
  list(): Promise<Room[]>;
  get(id: RoomId): Promise<Room | null>;
  create(input: { name: string; language: Language }): Promise<Room>;
  remove(id: RoomId): Promise<void>;
}

/** A live connection to one room: the shared document, presence and terminal. */
export interface RoomSession {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly terminal: TerminalSession;
  language(): Language;
  onLanguage(listener: (language: Language) => void): () => void;
  setLanguage(language: Language): void;
  leave(): void;
}

/** The room's shared terminal. Input and output are raw terminal bytes. */
export interface TerminalSession {
  onOutput(listener: (data: string) => void): () => void;
  onStatus(listener: (status: RunStatus) => void): () => void;
  input(data: string): void;
  run(): void;
  stop(): void;
  reset(): void;
}

export interface Api {
  rooms: RoomsApi;
  /** Resolves once the room's current state has been received. */
  join(room: Room, me: Participant): Promise<RoomSession>;
}
