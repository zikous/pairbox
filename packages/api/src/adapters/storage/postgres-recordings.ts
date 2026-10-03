import { eq, inArray, sql } from "drizzle-orm";
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

  async getByRoom(roomId: RoomId) {
    const [row] = await this.db.select().from(recordings).where(eq(recordings.roomId, roomId));
    return row && { ...toRecording(row), chunkCount: row.chunkCount };
  }

  async participantsByRoom(roomIds: RoomId[]): Promise<Map<RoomId, Participant[]>> {
    if (roomIds.length === 0) return new Map();
    const rows = await this.db
      .select({ roomId: recordings.roomId, participants: recordings.participants })
      .from(recordings)
      .where(inArray(recordings.roomId, roomIds));
    return new Map(rows.map((row) => [row.roomId, row.participants]));
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
