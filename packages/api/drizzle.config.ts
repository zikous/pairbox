import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from src/adapters/storage/schema.ts into ./drizzle.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/adapters/storage/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
});
