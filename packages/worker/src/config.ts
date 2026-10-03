import { hostname, networkInterfaces } from "node:os";
import { z } from "zod";
import { readEnv } from "@pairbox/shared";

/** The address other services use to reach this worker: its first network IPv4. */
function ownAddress(): string {
  const net = Object.values(networkInterfaces())
    .flat()
    .find((n) => n?.family === "IPv4" && !n.internal);
  return net?.address ?? "127.0.0.1";
}

export const config = readEnv(
  z
    .object({
      WORKER_PORT: z.coerce.number().int(),
      WORKER_ID: z.string().default(hostname()),
      WORKER_URL: z.url().optional(),
      POOL_URL: z.url(),
      INTERNAL_SECRET: z.string(),
      /** The unprivileged user room code runs as, and the folders it may write to. */
      SANDBOX_USER: z.string().default("sandbox"),
      WORKSPACE_DIR: z.string().default("/workspace"),
      SANDBOX_DIRS: z.string().default("/workspace,/home/sandbox,/tmp"),
      NODE_ENV: z.string().optional(),
    })
    .transform((env) => ({
      id: env.WORKER_ID,
      url: env.WORKER_URL ?? `http://${ownAddress()}:${env.WORKER_PORT}`,
      host: "0.0.0.0",
      port: env.WORKER_PORT,
      poolUrl: env.POOL_URL,
      internalSecret: env.INTERNAL_SECRET,
      sandboxUser: env.SANDBOX_USER,
      workspace: env.WORKSPACE_DIR,
      writableDirs: env.SANDBOX_DIRS.split(","),
      logger: env.NODE_ENV === "production" ? true : { transport: { target: "pino-pretty" } },
    })),
  process.env,
);
