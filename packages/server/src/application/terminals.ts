import type { RoomId, RunStatus } from "@pairbox/shared";
import type { RoomEvents } from "./events";
import type { Collaboration, RoomRepository, Sandbox, SandboxProcess } from "./ports";

const SCROLLBACK_MAX = 64_000;

interface Terminal {
  process: SandboxProcess;
  scrollback: string;
  status: RunStatus;
  attached: number;
  idleTimer?: ReturnType<typeof setTimeout>;
}

/**
 * One shared terminal per active room. It starts when the first person connects and is
 * destroyed after everyone has been gone for `idleMs`. Output goes to everyone in the room.
 */
export class TerminalService {
  private readonly terminals = new Map<RoomId, Terminal>();

  constructor(
    private readonly sandbox: Sandbox,
    private readonly rooms: RoomRepository,
    private readonly collaboration: Collaboration,
    private readonly events: RoomEvents,
    private readonly idleMs = 5 * 60_000,
  ) {}

  /** Joins the room's terminal and returns what has happened so far. */
  attach(roomId: RoomId): { scrollback: string; status: RunStatus } {
    const terminal = this.terminals.get(roomId) ?? this.start(roomId);
    clearTimeout(terminal.idleTimer);
    terminal.attached++;
    return { scrollback: terminal.scrollback, status: terminal.status };
  }

  detach(roomId: RoomId): void {
    const terminal = this.terminals.get(roomId);
    if (!terminal) return;
    terminal.attached--;
    if (terminal.attached === 0) {
      terminal.idleTimer = setTimeout(() => this.close(roomId), this.idleMs);
    }
  }

  input(roomId: RoomId, data: string): void {
    this.terminals.get(roomId)?.process.write(data);
  }

  run(roomId: RoomId): void {
    this.terminals.get(roomId)?.process.run();
  }

  stop(roomId: RoomId): void {
    this.terminals.get(roomId)?.process.stop();
  }

  /** Replaces the sandbox with a clean one, keeping everyone attached. */
  reset(roomId: RoomId): void {
    const terminal = this.terminals.get(roomId);
    if (!terminal) return;
    const { attached } = terminal;
    this.close(roomId);
    this.events.publish(roomId, { type: "output", data: "\x1bc" });
    this.events.publish(roomId, { type: "status", status: { state: "idle" } });
    this.start(roomId).attached = attached;
  }

  close(roomId: RoomId): void {
    const terminal = this.terminals.get(roomId);
    if (!terminal) return;
    clearTimeout(terminal.idleTimer);
    terminal.process.dispose();
    this.terminals.delete(roomId);
  }

  private start(roomId: RoomId): Terminal {
    const process = this.sandbox.start({
      code: () => this.collaboration.code(roomId),
      language: () => this.rooms.get(roomId)?.language ?? "python",
    });
    const terminal: Terminal = { process, scrollback: "", status: { state: "idle" }, attached: 0 };

    process.onOutput((data) => {
      terminal.scrollback = (terminal.scrollback + data).slice(-SCROLLBACK_MAX);
      this.events.publish(roomId, { type: "output", data });
    });
    process.onStatus((status) => {
      terminal.status = status;
      this.events.publish(roomId, { type: "status", status });
    });

    this.terminals.set(roomId, terminal);
    return terminal;
  }
}
