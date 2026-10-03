import { z } from "zod";

/**
 * Reads a service's settings from environment variables, failing with one clear message that
 * lists everything missing or invalid. Services load .env themselves (see their package.json).
 */
export function readEnv<T extends z.ZodType>(
  schema: T,
  env: Record<string, string | undefined>,
): z.infer<T> {
  // Empty values count as unset, so optional settings can be left blank in .env.
  const values = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
  const result = schema.safeParse(values);
  if (result.success) return result.data;

  const problems = result.error.issues.map(
    (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
  );
  throw new Error(`Invalid settings (see .env.example at the repo root):\n${problems.join("\n")}`);
}
