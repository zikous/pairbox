import {
  normalizeRoomName,
  type CreateRoom,
  type Room,
  type RoomCounts,
  type RoomId,
  type RoomListQuery,
  type RoomPage,
  type Runtime,
} from "@pairbox/shared";
import { InvalidInputError, NotRoomOwnerError, RoomNotFoundError } from "./errors";
import type { RoomEvents } from "./events";
import type { Collaboration, OwnedRoom, RoomRepository, Scheduler } from "./ports";
import type { RecordingService } from "./recordings";
import type { SessionClock } from "./session-clock";
import type { TerminalService } from "./terminals";

const STARTER_CODE: Record<Runtime, string> = {
  python: 'name = "pairbox"\nprint(f"Hello from {name}!")\nprint("Edit me, then press Run.")\n',
  typescript:
    'const name: string = "pairbox";\nconsole.log(`Hello from ${name}!`);\nconsole.log("Edit me, then press Run.");\n',
};

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
/** A session can be booked for a time that started a moment ago (the form took a while). */
const START_GRACE_MS = 5 * 60_000;

/** 10 characters from a 32-letter alphabet: 50 bits, hard to guess. */
function newRoomId(): RoomId {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}

/** Rooms are booked sessions: a name, a runtime and a time slot, owned by one user. */
export class RoomService {
  constructor(
    private readonly repository: RoomRepository,
    private readonly scheduler: Scheduler,
    private readonly collaboration: Collaboration,
    private readonly terminals: TerminalService,
    private readonly recordings: RecordingService,
    private readonly clock: SessionClock,
    private readonly events: RoomEvents,
  ) {}

  /** One page of the user's sessions in a tab: live and upcoming soonest first, past latest first. */
  search(ownerId: string, query: RoomListQuery): Promise<RoomPage> {
    return this.repository.search(ownerId, query, new Date());
  }

  counts(ownerId: string): Promise<RoomCounts> {
    return this.repository.counts(ownerId, new Date());
  }

  find(id: RoomId): Promise<OwnedRoom | undefined> {
    return this.repository.get(id);
  }

  async get(id: RoomId): Promise<OwnedRoom> {
    const room = await this.find(id);
    if (!room) throw new RoomNotFoundError(id);
    return room;
  }

  /** The room, if it belongs to this user. */
  async owned(ownerId: string, id: RoomId): Promise<OwnedRoom> {
    const room = await this.get(id);
    if (room.ownerId !== ownerId) throw new NotRoomOwnerError();
    return room;
  }

  /** Books a session. Fails with SlotTakenError when no worker is free for the whole slot. */
  async create(ownerId: string, input: CreateRoom): Promise<Room> {
    const name = normalizeRoomName(input.name);
    if (!name) throw new InvalidInputError("Room name is empty or too long");
    const start = Date.parse(input.startsAt);
    if (start < Date.now() - START_GRACE_MS)
      throw new InvalidInputError("Pick a time in the future");

    const room: OwnedRoom = {
      id: newRoomId(),
      ownerId,
      name,
      runtime: input.runtime,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(start + input.durationMinutes * 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    const { id: roomId, runtime, startsAt, endsAt } = room;
    await this.scheduler.book({ roomId, runtime, startsAt, endsAt });
    try {
      await this.repository.save(room);
      await this.collaboration.create(room.id, STARTER_CODE[room.runtime]);
    } catch (error) {
      await this.scheduler.cancel(room.id);
      throw error;
    }
    return room;
  }

  /** Ends a session before its slot does: everyone is disconnected and the slot is freed. */
  async end(ownerId: string, id: RoomId): Promise<void> {
    const room = await this.owned(ownerId, id);
    if (Date.parse(room.endsAt) <= Date.now()) return;
    await this.repository.save({ ...room, endsAt: new Date().toISOString() });
    await this.scheduler.cancel(id);
    await this.clock.end(id);
  }

  async delete(ownerId: string, id: RoomId): Promise<void> {
    await this.owned(ownerId, id);
    this.events.publish(id, { type: "room_deleted" });
    this.clock.forget(id);
    await this.terminals.close(id);
    this.collaboration.destroy(id);
    await this.recordings.deleteRoom(id);
    await this.scheduler.cancel(id);
    await this.repository.delete(id);
  }
}
