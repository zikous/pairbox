import { WebSocket } from "ws";
import { internalHeaders } from "@pairbox/service";
import {
  Listeners,
  type Runtime,
  type Reservation,
  type RoomId,
  type RunStatus,
  type WorkerCommand,
  type WorkerEvent,
} from "@pairbox/shared";
import type { Sandboxes, SandboxSession } from "../../application/ports";

const QUEUE_POLL_MS = 1_000;

/** Gets machines from the pool service and talks to each worker's terminal over a WebSocket. */
export class WorkerSandboxes implements Sandboxes {
  constructor(
    private readonly poolUrl: string,
    private readonly internalSecret: string,
  ) {}

  async open(
    request: { roomId: RoomId },
    options: { onWaiting: (position: number) => void; signal: AbortSignal },
  ): Promise<SandboxSession> {
    let reservation = await this.pool<Reservation>("POST", "/reservations", request);
    const release = () => this.pool("DELETE", `/reservations/${reservation.id}`).catch(() => {});

    try {
      while (reservation.status === "queued") {
        options.onWaiting(reservation.position);
        await sleep(QUEUE_POLL_MS, options.signal);
        reservation = await this.pool<Reservation>("GET", `/reservations/${reservation.id}`);
      }
      const socket = await this.connect(reservation.worker.url, options.signal);
      return new WorkerSession(socket, release);
    } catch (error) {
      await release();
      throw error;
    }
  }

  private connect(workerUrl: string, signal: AbortSignal): Promise<WebSocket> {
    const socket = new WebSocket(`${workerUrl.replace(/^http/, "ws")}/terminal`, {
      headers: internalHeaders(this.internalSecret),
    });
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => socket.terminate(), { once: true });
      socket.once("open", () => resolve(socket));
      socket.once("error", reject);
      socket.once("close", () => reject(new Error("Worker closed the terminal")));
    });
  }

  private async pool<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.poolUrl}${path}`, {
      method,
      headers: {
        ...internalHeaders(this.internalSecret),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!response.ok) throw new Error(`Pool ${method} ${path} failed with ${response.status}`);
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
}

class WorkerSession implements SandboxSession {
  private readonly output = new Listeners<string>();
  private readonly statusChanged = new Listeners<RunStatus>();
  private readonly lost = new Listeners();
  private closing = false;

  constructor(
    private readonly socket: WebSocket,
    private readonly release: () => Promise<unknown>,
  ) {
    socket.on("message", (raw: Buffer) => {
      const event = JSON.parse(raw.toString()) as WorkerEvent;
      if (event.type === "output") this.output.emit(event.data);
      else this.statusChanged.emit(event.status);
    });
    socket.on("close", () => {
      if (this.closing) return;
      void this.release();
      this.lost.emit();
    });
  }

  onOutput = (listener: (data: string) => void) => void this.output.add(listener);
  onStatus = (listener: (status: RunStatus) => void) => void this.statusChanged.add(listener);
  onLost = (listener: () => void) => void this.lost.add(listener);

  input = (data: string) => this.send({ type: "input", data });
  resize = (cols: number, rows: number) => this.send({ type: "resize", cols, rows });
  write = (code: string, runtime: Runtime) => this.send({ type: "write", code, runtime });
  run = (code: string, runtime: Runtime) => this.send({ type: "run", code, runtime });
  stop = () => this.send({ type: "stop" });

  async close() {
    this.closing = true;
    this.socket.close();
    await this.release();
  }

  private send(command: WorkerCommand) {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(command));
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
