/** Asks a worker to wipe everything the previous room left on it. */
export interface WorkerCleaner {
  clean(worker: { id: string; url: string }): Promise<void>;
}
