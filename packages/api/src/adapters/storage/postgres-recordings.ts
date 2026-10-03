import { desc, eq, sql } from "drizzle-orm";
import type { Participant, Recording, RoomId } from "@pairbox/shared";
import type { RecordingRepository } from "../../application/ports";
import type { Database } from "./database";
import { recordings } from "./schema";

export class PostgresRecordingRepository implements RecordingRepository {
  constructor(private readonly db: Database) {}

  async create(recording: { id: string; roomId: RoomId; startedAt: Date }): Promise<void> {
    await this.db.insert(recordings).values(recording);
  }

  async update(
    id: string,
    changes: { endedAt?: Date; participants?: Participant[]; chunkCount?: number },
  ): Promise<void> {
    const { chunkCount, ...rest } = changes;
    await this.db
      .update(recordings)
      .set({
        ...rest,
        // Chunks can finish writing out of order: never let the count go backwards.
        ...(chunkCount !== undefined && {
          chunkCount: sql`greatest(${recordings.chunkCount}, ${chunkCount})`,
        }),
      })
      .where(eq(recordings.id, id));
  }

  async listByRoom(roomId: RoomId): Promise<Recording[]> {
    const rows = await this.db
      .select()
      .from(recordings)
      .where(eq(recordings.roomId, roomId))
      .orderBy(desc(recordings.startedAt));
    return rows.map(toRecording);
  }

  async get(id: string) {
    const [row] = await this.db.select().from(recordings).where(eq(recordings.id, id));
    return row && { ...toRecording(row), chunkCount: row.chunkCount };
  }
}

function toRecording(row: typeof recordings.$inferSelect): Recording {
  return {
    id: row.id,
    roomId: row.roomId,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    participants: row.participants,
  };
}
