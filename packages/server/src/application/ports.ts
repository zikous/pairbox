import type { Language, Room, RoomId, RunStatus } from "@pairbox/shared";

/** What the application needs from the outside world. Adapters implement these. */

export interface RoomRepository {
  list(): Room[];
  get(id: RoomId): Room | undefined;
  save(room: Room): void;
  delete(id: RoomId): void;
}

/** The shared documents edited in each room. */
export interface Collaboration {
  create(roomId: RoomId, initialCode: string): void;
  code(roomId: RoomId): string;
  destroy(roomId: RoomId): void;
}

/** Starts isolated environments where room code and shell commands run. */
export interface Sandbox {
  start(source: { code(): string; language(): Language }): SandboxProcess;
}

/** A running sandbox with a shell attached to a terminal. */
export interface SandboxProcess {
  onOutput(listener: (data: string) => void): void;
  onStatus(listener: (status: RunStatus) => void): void;
  /** Raw terminal input (keystrokes). */
  write(data: string): void;
  /** Runs the room's code in the shell. Ignored while something is already running. */
  run(): void;
  stop(): void;
  dispose(): void;
}
