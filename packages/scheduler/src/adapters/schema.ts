import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** One row per booked room. Owned by the scheduler; the api never touches it. */
export const bookings = pgTable(
  "bookings",
  {
    roomId: text().primaryKey(),
    runtime: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [index().on(table.runtime, table.startsAt)],
);
