import { eq } from "drizzle-orm";
import { isRuntime, type Room, type RoomId } from "@pairbox/shared";
import type { RoomRepository } from "../../application/ports";
import type { Database } from "./database";
import { rooms } from "./schema";

export class PostgresRoomRepository implements RoomRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Room[]> {
    return (await this.db.select().from(rooms)).map(toRoom);
  }

  async get(id: RoomId): Promise<Room | undefined> {
    const [row] = await this.db.select().from(rooms).where(eq(rooms.id, id));
    return row && toRoom(row);
  }

  async save(room: Room): Promise<void> {
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

function toRoom(row: typeof rooms.$inferSelect): Room {
  if (!isRuntime(row.runtime)) throw new Error(`Room ${row.id} has unknown runtime`);
  return { ...row, runtime: row.runtime, createdAt: row.createdAt.toISOString() };
}
