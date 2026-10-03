import type { Room, RoomId } from "@pairbox/shared";
import type { RoomEvents } from "./events";
import type { Lobby } from "./lobby";
import type { Collaboration } from "./ports";
import type { RecordingService } from "./recordings";
import type { TerminalService } from "./terminals";

/**
 * Ends each session exactly when its slot does: everyone is told, the lobby closes, the worker
 * is released, the code is saved and the recording is closed.
 */
export class SessionClock {
  private readonly timers = new Map<RoomId, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly events: RoomEvents,
    private readonly lobby: Lobby,
    private readonly terminals: TerminalService,
    private readonly collaboration: Collaboration,
    private readonly recordings: RecordingService,
  ) {}

  /** Called when someone enters a room: make sure its session ends on time. */
  watch(room: Room): void {
    if (this.timers.has(room.id)) return;
    const delay = Math.max(0, Date.parse(room.endsAt) - Date.now());
    this.timers.set(
      room.id,
      setTimeout(() => void this.end(room.id), delay),
    );
  }

  async end(roomId: RoomId): Promise<void> {
    clearTimeout(this.timers.get(roomId));
    this.timers.delete(roomId);
    this.events.publish(roomId, { type: "session_ended" });
    this.lobby.close(roomId);
    await this.terminals.close(roomId);
    await this.collaboration.end(roomId);
    await this.recordings.finish(roomId);
  }

  /** Stops watching a room (it was deleted). */
  forget(roomId: RoomId): void {
    clearTimeout(this.timers.get(roomId));
    this.timers.delete(roomId);
  }
}
