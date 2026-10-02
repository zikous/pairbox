import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema";

const MIGRATIONS = fileURLToPath(new URL("../../../drizzle", import.meta.url));

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/** Connects to Postgres and brings the schema up to date. */
export async function connectDatabase(url: string) {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return { db, close: () => pool.end() };
}
