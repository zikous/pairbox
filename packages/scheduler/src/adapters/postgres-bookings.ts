import { fileURLToPath } from "node:url";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import type { Booking } from "@pairbox/shared";
import type { BookingRepository } from "../application/ports";
import * as schema from "./schema";
import { bookings } from "./schema";

const MIGRATIONS = fileURLToPath(new URL("../../drizzle", import.meta.url));

type Database = ReturnType<typeof drizzle<typeof schema>>;

/** Connects to Postgres and brings the scheduler's own tables up to date. */
export async function connectDatabase(url: string) {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema, casing: "snake_case" });
  // Separate from the api's migrations, which live in the same database.
  await migrate(db, { migrationsFolder: MIGRATIONS, migrationsTable: "__scheduler_migrations" });
  return { db, close: () => pool.end() };
}

export class PostgresBookings implements BookingRepository {
  constructor(private readonly db: Database) {}

  async overlapping(from: Date, to: Date): Promise<Booking[]> {
    const rows = await this.db
      .select()
      .from(bookings)
      .where(and(lt(bookings.startsAt, to), gt(bookings.endsAt, from)));
    return rows.map((row) => ({
      ...row,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    }));
  }

  async insert(booking: Booking): Promise<void> {
    await this.db.insert(bookings).values({
      ...booking,
      startsAt: new Date(booking.startsAt),
      endsAt: new Date(booking.endsAt),
    });
  }

  async delete(roomId: string): Promise<void> {
    await this.db.delete(bookings).where(eq(bookings.roomId, roomId));
  }

  exclusively<T>(work: () => Promise<T>): Promise<T> {
    // A transaction-scoped advisory lock serializes bookings.
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('booking'))`);
      return work();
    });
  }
}
