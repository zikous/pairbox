export type RunStatus =
  | { state: "idle" }
  | { state: "running"; startedAt: number }
  | { state: "exited"; exitCode: number; durationMs: number };
