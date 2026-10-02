import { normalizeRoomName, type Runtime, type Room, type RoomId } from "@pairbox/shared";
import { InvalidInputError, RoomNotFoundError } from "./errors";
import type { RoomEvents } from "./events";
import type { Collaboration, RoomRepository } from "./ports";
import type { TerminalService } from "./terminals";

const STARTER_CODE: Record<Runtime, string> = {
  python: 'name = "pairbox"\nprint(f"Hello from {name}!")\nprint("Edit me, then press Run.")\n',
  typescript:
    'const name: string = "pairbox";\nconsole.log(`Hello from ${name}!`);\nconsole.log("Edit me, then press Run.");\n',
};

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** 10 characters from a 32-letter alphabet: 50 bits, hard to guess. */
function newRoomId(): RoomId {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}

export class RoomService {
  constructor(
    private readonly repository: RoomRepository,
    private readonly collaboration: Collaboration,
    private readonly terminals: TerminalService,
    private readonly events: RoomEvents,
  ) {}

  async list(): Promise<Room[]> {
    const rooms = await this.repository.list();
    return rooms.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  find(id: RoomId): Promise<Room | undefined> {
    return this.repository.get(id);
  }

  async get(id: RoomId): Promise<Room> {
    const room = await this.find(id);
    if (!room) throw new RoomNotFoundError(id);
    return room;
  }

  async create(input: { name: string; runtime: Runtime }): Promise<Room> {
    const name = normalizeRoomName(input.name);
    if (!name) throw new InvalidInputError("Room name is empty or too long");

    const room: Room = {
      id: newRoomId(),
      name,
      runtime: input.runtime,
      createdAt: new Date().toISOString(),
    };
    await this.repository.save(room);
    await this.collaboration.create(room.id, STARTER_CODE[room.runtime]);
    return room;
  }

  async delete(id: RoomId): Promise<void> {
    await this.get(id);
    this.events.publish(id, { type: "room_deleted" });
    await this.terminals.close(id);
    this.collaboration.destroy(id);
    await this.repository.delete(id);
  }

  /** Switching runtime also switches the room to a machine that has that runtime. */
  async setRuntime(id: RoomId, runtime: Runtime): Promise<void> {
    const room = await this.get(id);
    if (room.runtime === runtime) return;
    await this.repository.save({ ...room, runtime });
    this.events.publish(id, { type: "runtime", runtime });
    await this.terminals.changeRuntime(id, runtime);
  }
}
