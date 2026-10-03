import type { Runtime, Worker } from "@pairbox/shared";
import { internalHeaders } from "@pairbox/service";
import type { Capacity } from "../application/ports";

const CACHE_MS = 5_000;

/** Capacity = the workers the pool currently knows about, per runtime. */
export class PoolCapacity implements Capacity {
  private cached?: { at: number; workers: Promise<Worker[]> };

  constructor(
    private readonly poolUrl: string,
    private readonly internalSecret: string,
  ) {}

  async of(runtime: Runtime): Promise<number> {
    const workers = await this.workers();
    return workers.filter((worker) => worker.runtime === runtime).length;
  }

  private workers(): Promise<Worker[]> {
    if (!this.cached || Date.now() - this.cached.at > CACHE_MS) {
      const workers = fetch(`${this.poolUrl}/workers`, {
        headers: internalHeaders(this.internalSecret),
      }).then((response) => {
        if (!response.ok) throw new Error(`Pool answered ${response.status}`);
        return response.json() as Promise<Worker[]>;
      });
      this.cached = { at: Date.now(), workers };
      workers.catch(() => (this.cached = undefined)); // don't keep a failure
    }
    return this.cached.workers;
  }
}
