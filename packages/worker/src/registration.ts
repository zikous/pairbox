import { INTERNAL_AUTH_HEADER, type RegisterWorker } from "@pairbox/shared";

const HEARTBEAT_MS = 5_000;

/**
 * Keeps this worker known to the pool: registers, then sends heartbeats. If the pool doesn't
 * know us (it restarted) or can't be reached, registers again on the next beat.
 */
export function stayRegistered(options: {
  poolUrl: string;
  internalSecret: string;
  worker: RegisterWorker;
  log: (message: string) => void;
}): () => void {
  const { poolUrl, internalSecret, worker, log } = options;
  const headers = { [INTERNAL_AUTH_HEADER]: internalSecret, "content-type": "application/json" };
  let registered = false;

  async function beat() {
    try {
      if (!registered) {
        const response = await fetch(`${poolUrl}/workers`, {
          method: "POST",
          headers,
          body: JSON.stringify(worker),
        });
        registered = response.ok;
        if (registered) log(`registered with the pool as ${worker.id} (${worker.runtime})`);
        return;
      }
      const response = await fetch(`${poolUrl}/workers/${worker.id}/heartbeat`, {
        method: "POST",
        headers: { [INTERNAL_AUTH_HEADER]: internalSecret },
      });
      if (response.status === 404) registered = false;
    } catch {
      if (registered) log("lost the pool, will register again");
      registered = false;
    }
  }

  void beat();
  const timer = setInterval(() => void beat(), HEARTBEAT_MS);
  return () => clearInterval(timer);
}
