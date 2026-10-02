import type {
  Runtime,
  RegisterWorker,
  Reservation,
  Reserve,
  RoomId,
  Worker,
  WorkerState,
} from "@pairbox/shared";
import type { WorkerCleaner } from "./ports";

interface TrackedWorker extends RegisterWorker {
  state: WorkerState;
  roomId: RoomId | null;
  reservationId: string | null;
  lastSeen: number;
}

interface Claim {
  id: string;
  roomId: RoomId;
  runtime: Runtime;
  workerId: string | null;
}

/**
 * Tracks every worker and hands them out to rooms, one room per worker. When no worker of the
 * right runtime is free, requests wait in a first-come, first-served queue per runtime.
 * All state can be rebuilt from the workers, which register again if the pool restarts.
 */
export class WorkerPool {
  private readonly workers = new Map<string, TrackedWorker>();
  private readonly claims = new Map<string, Claim>();
  /** Waiting claim ids, oldest first. */
  private queue: string[] = [];

  constructor(
    private readonly cleaner: WorkerCleaner,
    private readonly heartbeatTimeoutMs = 15_000,
    private readonly now = () => Date.now(),
  ) {}

  /** A worker (re)starting. Whatever it was doing before is gone, so it starts free. */
  register(worker: RegisterWorker): void {
    const previous = this.workers.get(worker.id);
    if (previous?.reservationId) this.claims.delete(previous.reservationId);
    this.workers.set(worker.id, {
      ...worker,
      state: "free",
      roomId: null,
      reservationId: null,
      lastSeen: this.now(),
    });
    this.assignQueued();
  }

  /** Returns false when the worker is unknown and should register again. */
  heartbeat(workerId: string): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) return false;
    worker.lastSeen = this.now();
    return true;
  }

  /** Gives the room a free worker, or a place in the queue. Asking twice returns the same claim. */
  reserve({ roomId, runtime }: Reserve): Reservation {
    const existing = [...this.claims.values()].find((claim) => claim.roomId === roomId);
    if (existing) return this.describe(existing);

    const claim: Claim = { id: crypto.randomUUID(), roomId, runtime, workerId: null };
    this.claims.set(claim.id, claim);
    const worker = this.freeWorker(runtime);
    if (worker) this.assign(claim, worker);
    else this.queue.push(claim.id);
    return this.describe(claim);
  }

  get(claimId: string): Reservation | undefined {
    const claim = this.claims.get(claimId);
    return claim && this.describe(claim);
  }

  /** Leaves the queue, or gives the worker back. It is cleaned before anyone else gets it. */
  release(claimId: string): boolean {
    const claim = this.claims.get(claimId);
    if (!claim) return false;
    this.claims.delete(claimId);
    this.queue = this.queue.filter((id) => id !== claimId);

    const worker = claim.workerId ? this.workers.get(claim.workerId) : undefined;
    if (worker) void this.clean(worker);
    return true;
  }

  /** Forgets workers that stopped sending heartbeats, along with their rooms' claims. */
  removeSilentWorkers(): void {
    const deadline = this.now() - this.heartbeatTimeoutMs;
    for (const worker of this.workers.values()) {
      if (worker.lastSeen >= deadline) continue;
      if (worker.reservationId) this.claims.delete(worker.reservationId);
      this.workers.delete(worker.id);
    }
  }

  list(): Worker[] {
    return [...this.workers.values()].map(({ id, url, runtime, state, roomId, lastSeen }) => ({
      id,
      url,
      runtime,
      state,
      roomId,
      lastSeen: new Date(lastSeen).toISOString(),
    }));
  }

  private async clean(worker: TrackedWorker): Promise<void> {
    worker.state = "cleaning";
    worker.roomId = null;
    worker.reservationId = null;
    try {
      await this.cleaner.clean(worker);
    } catch {
      // A worker that can't clean itself can't be trusted: drop it until it registers again.
      this.workers.delete(worker.id);
      return;
    }
    if (this.workers.get(worker.id) !== worker) return; // re-registered or removed meanwhile
    worker.state = "free";
    this.assignQueued();
  }

  private assignQueued(): void {
    for (const claimId of [...this.queue]) {
      const claim = this.claims.get(claimId);
      const worker = claim && this.freeWorker(claim.runtime);
      if (!claim || !worker) continue;
      this.queue = this.queue.filter((id) => id !== claimId);
      this.assign(claim, worker);
    }
  }

  private assign(claim: Claim, worker: TrackedWorker): void {
    claim.workerId = worker.id;
    worker.state = "reserved";
    worker.roomId = claim.roomId;
    worker.reservationId = claim.id;
  }

  private freeWorker(runtime: Runtime): TrackedWorker | undefined {
    return [...this.workers.values()].find((w) => w.state === "free" && w.runtime === runtime);
  }

  private describe(claim: Claim): Reservation {
    const base = { id: claim.id, roomId: claim.roomId, runtime: claim.runtime };
    const worker = claim.workerId ? this.workers.get(claim.workerId) : undefined;
    if (worker) return { ...base, status: "reserved", worker: { id: worker.id, url: worker.url } };

    const waiting = this.queue.filter((id) => this.claims.get(id)?.runtime === claim.runtime);
    return { ...base, status: "queued", position: waiting.indexOf(claim.id) + 1 };
  }
}
