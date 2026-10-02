import type { Room, RoomId } from "@pairbox/shared";
import type { RoomRepository } from "../../application/ports";

/** Keeps rooms in memory. Everything is lost on restart; SQLite comes later. */
export class MemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<RoomId, Room>();

  list(): Room[] {
    return [...this.rooms.values()];
  }

  get(id: RoomId): Room | undefined {
    return this.rooms.get(id);
  }

  save(room: Room): void {
    this.rooms.set(room.id, room);
  }

  delete(id: RoomId): void {
    this.rooms.delete(id);
  }
}
