import { eq } from "drizzle-orm";
import { isRuntime, type RoomId } from "@pairbox/shared";
import type { OwnedRoom, RoomRepository } from "../../application/ports";
import type { Database } from "./database";
import { rooms } from "./schema";

export class PostgresRoomRepository implements RoomRepository {
  constructor(private readonly db: Database) {}

  async listByOwner(ownerId: string): Promise<OwnedRoom[]> {
    return (await this.db.select().from(rooms).where(eq(rooms.ownerId, ownerId))).map(toRoom);
  }

  async get(id: RoomId): Promise<OwnedRoom | undefined> {
    const [row] = await this.db.select().from(rooms).where(eq(rooms.id, id));
    return row && toRoom(row);
  }

  async save(room: OwnedRoom): Promise<void> {
    const values = { ...room, createdAt: new Date(room.createdAt) };
    await this.db
      .insert(rooms)
      .values(values)
      .onConflictDoUpdate({ target: rooms.id, set: { name: room.name, runtime: room.runtime } });
  }

  async delete(id: RoomId): Promise<void> {
    await this.db.delete(rooms).where(eq(rooms.id, id));
  }
}

function toRoom(row: typeof rooms.$inferSelect): OwnedRoom {
  if (!isRuntime(row.runtime)) throw new Error(`Room ${row.id} has unknown runtime`);
  return { ...row, runtime: row.runtime, createdAt: row.createdAt.toISOString() };
}
