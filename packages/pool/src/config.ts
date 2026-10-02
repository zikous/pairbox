import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Settings live in .env at the repo root (see .env.example). Real environment variables win.
const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env at the repo root.`);
  return value;
}

export const config = {
  host: required("POOL_HOST"),
  port: Number(required("POOL_PORT")),
  internalSecret: required("INTERNAL_SECRET"),
  production: process.env["NODE_ENV"] === "production",
};
