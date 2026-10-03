import type { RoomId, SessionNotes } from "@pairbox/shared";
import type { NoteRepository } from "./ports";
import type { RoomService } from "./rooms";

/** The private notes a room's owner keeps on a session, as one document. Only they can see it. */
export class NoteService {
  constructor(
    private readonly repository: NoteRepository,
    private readonly rooms: RoomService,
  ) {}

  async get(ownerId: string, roomId: RoomId): Promise<SessionNotes> {
    await this.rooms.owned(ownerId, roomId);
    return (await this.repository.get(roomId)) ?? { body: "", updatedAt: null };
  }

  async save(ownerId: string, roomId: RoomId, body: string): Promise<SessionNotes> {
    await this.rooms.owned(ownerId, roomId);
    return this.repository.save(roomId, body);
  }
}
