import { z } from "zod";

/**
 * What a room's code runs on: the tools installed on its worker. Each runtime has the file the
 * room's code is saved to, and the command that runs it.
 */
export const RUNTIMES = {
  python: { label: "Python", file: "main.py", command: "python3 main.py" },
  typescript: { label: "TypeScript", file: "main.ts", command: "node main.ts" },
} as const;

export type Runtime = keyof typeof RUNTIMES;

export const RuntimeSchema = z.enum(Object.keys(RUNTIMES) as [Runtime, ...Runtime[]]);

export const isRuntime = (value: string): value is Runtime => Object.hasOwn(RUNTIMES, value);
