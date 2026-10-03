import { z } from "zod";

/**
 * The languages a room's code can be written in. Every worker has all of them installed, and a
 * room can switch between them at any time. Each has the file the code is saved to, and the
 * command that runs it.
 */
export const RUNTIMES = {
  python: { label: "Python", file: "main.py", command: "python3 main.py" },
  typescript: { label: "TypeScript", file: "main.ts", command: "node main.ts" },
} as const;

export type Runtime = keyof typeof RUNTIMES;

export const RuntimeSchema = z.enum(Object.keys(RUNTIMES) as [Runtime, ...Runtime[]]);

export const isRuntime = (value: string): value is Runtime => Object.hasOwn(RUNTIMES, value);
