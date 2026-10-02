import { normalizeRoomName, type Language, type Room, type RoomId } from "@pairbox/shared";
import { InvalidInputError, RoomNotFoundError } from "./errors";
import type { RoomEvents } from "./events";
import type { Collaboration, RoomRepository } from "./ports";
import type { TerminalService } from "./terminals";

const STARTER_CODE: Record<Language, string> = {
  python: 'name = "pairbox"\nprint(f"Hello from {name}!")\nprint("Edit me, then press Run.")\n',
  javascript:
    'const name = "pairbox";\nconsole.log(`Hello from ${name}!`);\nconsole.log("Edit me, then press Run.");\n',
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

  list(): Room[] {
    return this.repository.list().toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  find(id: RoomId): Room | undefined {
    return this.repository.get(id);
  }

  get(id: RoomId): Room {
    const room = this.find(id);
    if (!room) throw new RoomNotFoundError(id);
    return room;
  }

  create(input: { name: string; language: Language }): Room {
    const name = normalizeRoomName(input.name);
    if (!name) throw new InvalidInputError("Room name is empty or too long");

    const room: Room = {
      id: newRoomId(),
      name,
      language: input.language,
      createdAt: new Date().toISOString(),
    };
    this.repository.save(room);
    this.collaboration.create(room.id, STARTER_CODE[room.language]);
    return room;
  }

  delete(id: RoomId): void {
    this.get(id);
    this.events.publish(id, { type: "room_deleted" });
    this.terminals.close(id);
    this.collaboration.destroy(id);
    this.repository.delete(id);
  }

  setLanguage(id: RoomId, language: Language): void {
    const room = this.get(id);
    if (room.language === language) return;
    this.repository.save({ ...room, language });
    this.events.publish(id, { type: "language", language });
  }
}
