import { customType, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const bytes = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
});

export const rooms = pgTable("rooms", {
  id: text().primaryKey(),
  name: text().notNull(),
  runtime: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** A room's document, saved as its CRDT (Yjs) state. Deleted with the room. */
export const workspaces = pgTable("workspaces", {
  roomId: text()
    .primaryKey()
    .references(() => rooms.id, { onDelete: "cascade" }),
  state: bytes().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Saved starting points for new rooms. */
export const templates = pgTable("templates", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  runtime: text().notNull(),
  code: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
