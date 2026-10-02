import type { Runtime, Room, RoomId, RunStatus } from "@pairbox/shared";

/** What the application needs from the outside world. Adapters implement these. */

export interface RoomRepository {
  list(): Promise<Room[]>;
  get(id: RoomId): Promise<Room | undefined>;
  save(room: Room): Promise<void>;
  delete(id: RoomId): Promise<void>;
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
