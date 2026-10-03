import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from src/adapters/schema.ts into ./drizzle.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/adapters/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  migrations: { table: "__scheduler_migrations" },
});
