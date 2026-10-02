import { existsSync } from "node:fs";
import { hostname, networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { isRuntime, type Runtime } from "@pairbox/shared";

// Settings live in .env at the repo root (see .env.example). Real environment variables win.
const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env at the repo root.`);
  return value;
}

function runtime(): Runtime {
  const value = required("WORKER_RUNTIME");
  if (!isRuntime(value)) throw new Error(`WORKER_RUNTIME "${value}" is not a known runtime`);
  return value;
}

/** The address other services use to reach this worker: its first network IPv4. */
function ownAddress(): string {
  const ip = Object.values(networkInterfaces())
    .flat()
    .find((net) => net?.family === "IPv4" && !net.internal)?.address;
  return ip ?? "127.0.0.1";
}

const port = Number(required("WORKER_PORT"));

export const config = {
  id: process.env["WORKER_ID"] ?? hostname(),
  url: process.env["WORKER_URL"] ?? `http://${ownAddress()}:${port}`,
  host: "0.0.0.0",
  port,
  runtime: runtime(),
  poolUrl: required("POOL_URL"),
  internalSecret: required("INTERNAL_SECRET"),
  /** The unprivileged user room code runs as, and the folders it may write to. */
  sandboxUser: process.env["SANDBOX_USER"] ?? "sandbox",
  workspace: process.env["WORKSPACE_DIR"] ?? "/workspace",
  writableDirs: (process.env["SANDBOX_DIRS"] ?? "/workspace,/home/sandbox,/tmp").split(","),
  production: process.env["NODE_ENV"] === "production",
};
