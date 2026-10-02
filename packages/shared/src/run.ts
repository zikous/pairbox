import { z } from "zod";

export const RunStatusSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("idle") }),
  z.object({ state: z.literal("running"), startedAt: z.number() }),
  z.object({ state: z.literal("exited"), exitCode: z.number(), durationMs: z.number() }),
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;
