import type { Runtime, RoomId, RunStatus, SandboxState } from "@pairbox/shared";
import type { RoomEvents } from "./events";
import type { Collaboration, Sandboxes, SandboxSession } from "./ports";

const SCROLLBACK_MAX = 64_000;

interface Terminal {
  /** The room's language: which file the code is saved to, and how it's run. */
  runtime: Runtime;
  sandbox: SandboxState;
  session?: SandboxSession;
  /** Cancels getting a machine, if the room is closed while waiting in line. */
  abort: AbortController;
  scrollback: string;
  status: RunStatus;
  attached: number;
  idleTimer?: ReturnType<typeof setTimeout>;
}

/**
 * One shared terminal per active room, running on a machine from the pool. The terminal opens
 * when the first person joins, waits in line if no machine is free, and gives its machine back
 * once everyone has been gone for `idleMs`. Everything it prints goes to everyone in the room.
 */
export class TerminalService {
  private readonly terminals = new Map<RoomId, Terminal>();

  constructor(
    private readonly sandboxes: Sandboxes,
    private readonly collaboration: Collaboration,
    private readonly events: RoomEvents,
    private readonly idleMs = 2 * 60_000,
  ) {}

  /** Joins the room's terminal (opening it if needed) and returns what happened so far. */
  attach(roomId: RoomId, runtime: Runtime) {
    const terminal = this.terminals.get(roomId) ?? this.open(roomId, runtime);
    clearTimeout(terminal.idleTimer);
    terminal.attached++;
    return { scrollback: terminal.scrollback, status: terminal.status, sandbox: terminal.sandbox };
  }

  detach(roomId: RoomId): void {
    const terminal = this.terminals.get(roomId);
    if (!terminal) return;
    terminal.attached--;
    if (terminal.attached === 0) {
      terminal.idleTimer = setTimeout(() => void this.close(roomId), this.idleMs);
    }
  }

  input(roomId: RoomId, data: string): void {
    this.terminals.get(roomId)?.session?.input(data);
  }

  resize(roomId: RoomId, cols: number, rows: number): void {
    this.terminals.get(roomId)?.session?.resize(cols, rows);
  }

  run(roomId: RoomId): void {
    const terminal = this.terminals.get(roomId);
    terminal?.session?.run(this.collaboration.code(roomId), terminal.runtime);
  }

  /** The room switched language: its code is saved under the new language's file. */
  setRuntime(roomId: RoomId, runtime: Runtime): void {
    const terminal = this.terminals.get(roomId);
    if (!terminal) return;
    terminal.runtime = runtime;
    terminal.session?.write(this.collaboration.code(roomId), runtime);
  }

  stop(roomId: RoomId): void {
    this.terminals.get(roomId)?.session?.stop();
  }

  /** Gives the machine back and starts over on a clean one, keeping everyone attached. */
  async reset(roomId: RoomId): Promise<void> {
    const terminal = this.terminals.get(roomId);
    if (!terminal) return;
    const { attached } = terminal;
    await this.close(roomId);
    this.events.publish(roomId, { type: "output", data: "\x1bc" });
    this.events.publish(roomId, { type: "status", status: { state: "idle" } });
    this.open(roomId, terminal.runtime).attached = attached;
  }

  async close(roomId: RoomId): Promise<void> {
    const terminal = this.terminals.get(roomId);
    if (!terminal) return;
    this.terminals.delete(roomId);
    clearTimeout(terminal.idleTimer);
    terminal.abort.abort();
    await terminal.session?.close();
  }

  private open(roomId: RoomId, runtime: Runtime): Terminal {
    const terminal: Terminal = {
      runtime,
      sandbox: { state: "starting" },
      abort: new AbortController(),
      scrollback: "",
      status: { state: "idle" },
      attached: 0,
    };
    this.terminals.set(roomId, terminal);
    void this.connect(roomId, terminal);
    return terminal;
  }

  private async connect(roomId: RoomId, terminal: Terminal): Promise<void> {
    const setSandbox = (sandbox: SandboxState) => {
      terminal.sandbox = sandbox;
      this.events.publish(roomId, { type: "sandbox", sandbox });
    };

    let session: SandboxSession;
    try {
      session = await this.sandboxes.open(
        { roomId },
        {
          onWaiting: (position) => setSandbox({ state: "waiting", position }),
          signal: terminal.abort.signal,
        },
      );
    } catch {
      if (!terminal.abort.signal.aborted) setSandbox({ state: "lost" });
      return;
    }
    if (terminal.abort.signal.aborted) return void session.close();

    terminal.session = session;
    session.onOutput((data) => {
      terminal.scrollback = (terminal.scrollback + data).slice(-SCROLLBACK_MAX);
      this.events.publish(roomId, { type: "output", data });
    });
    session.onStatus((status) => {
      terminal.status = status;
      this.events.publish(roomId, { type: "status", status });
    });
    session.onLost(() => {
      if (this.terminals.get(roomId) !== terminal) return; // closed on purpose
      terminal.session = undefined;
      setSandbox({ state: "lost" });
    });

    session.write(this.collaboration.code(roomId), terminal.runtime);
    setSandbox({ state: "ready" });
  }
}
