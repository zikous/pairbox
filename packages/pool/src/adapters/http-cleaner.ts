import { internalHeaders } from "@pairbox/service";
import type { WorkerCleaner } from "../application/ports";

/** Calls the worker's `POST /clean`. */
export class HttpWorkerCleaner implements WorkerCleaner {
  constructor(
    private readonly internalSecret: string,
    private readonly timeoutMs = 15_000,
  ) {}

  async clean(worker: { url: string }): Promise<void> {
    const response = await fetch(`${worker.url}/clean`, {
      method: "POST",
      headers: internalHeaders(this.internalSecret),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`Worker cleaning failed with ${response.status}`);
  }
}
