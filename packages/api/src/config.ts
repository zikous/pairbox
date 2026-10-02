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

const production = process.env["NODE_ENV"] === "production";

/** api settings, read from the environment. */
export const config = {
  host: required("API_HOST"),
  port: Number(required("API_PORT")),
  hostSecret: required("HOST_SECRET"),
  internalSecret: required("INTERNAL_SECRET"),
  databaseUrl: required("DATABASE_URL"),
  poolUrl: required("POOL_URL"),
  production,
};

if (production && config.hostSecret === "dev") {
  throw new Error("HOST_SECRET is still the development default. Set a real secret.");
}
