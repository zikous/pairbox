import { eq } from "drizzle-orm";
import type { RoomId, SessionNotes } from "@pairbox/shared";
import type { NoteRepository } from "../../application/ports";
import type { Database } from "./database";
import { notes } from "./schema";

export class PostgresNoteRepository implements NoteRepository {
  constructor(private readonly db: Database) {}

  async get(roomId: RoomId): Promise<SessionNotes | undefined> {
    const [row] = await this.db.select().from(notes).where(eq(notes.roomId, roomId));
    return row && toNotes(row);
  }

  async save(roomId: RoomId, body: string): Promise<SessionNotes> {
    const updatedAt = new Date();
    const [row] = await this.db
      .insert(notes)
      .values({ roomId, body, updatedAt })
      .onConflictDoUpdate({ target: notes.roomId, set: { body, updatedAt } })
      .returning();
    if (!row) throw new Error(`Notes of room ${roomId} not saved`);
    return toNotes(row);
  }
}

const toNotes = (row: typeof notes.$inferSelect): SessionNotes => ({
  body: row.body,
  updatedAt: row.updatedAt.toISOString(),
});
