import type { Worker } from "@pairbox/shared";
import { internalHeaders } from "@pairbox/service";
import type { Capacity } from "../application/ports";

const CACHE_MS = 5_000;

/** Capacity = the workers the pool currently knows about. */
export class PoolCapacity implements Capacity {
  private cached?: { at: number; workers: Promise<Worker[]> };

  constructor(
    private readonly poolUrl: string,
    private readonly internalSecret: string,
  ) {}

  async workers(): Promise<number> {
    return (await this.list()).length;
  }

  private list(): Promise<Worker[]> {
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
