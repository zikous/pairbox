import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Tests read the same .env as the services (for TEST_DATABASE_URL).
const envFile = new URL("../../.env", import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({ test: { fileParallelism: false } });
