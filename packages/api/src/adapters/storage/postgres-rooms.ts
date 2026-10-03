import { and, asc, count, desc, eq, gt, gte, ilike, lt, lte, or, sql, type SQL } from "drizzle-orm";
import {
  OWNER_EARLY_MINUTES,
  isRuntime,
  type RoomCounts,
  type RoomId,
  type RoomListQuery,
  type RoomPage,
  type SessionTab,
} from "@pairbox/shared";
import type { OwnedRoom, RoomRepository } from "../../application/ports";
import type { Database } from "./database";
import { recordings, rooms } from "./schema";

export class PostgresRoomRepository implements RoomRepository {
  constructor(private readonly db: Database) {}

  async search(ownerId: string, query: RoomListQuery, now: Date): Promise<RoomPage> {
    const where = and(eq(rooms.ownerId, ownerId), inTab(query.tab, now), ...filters(query));
    const order = query.tab === "past" ? desc(rooms.startsAt) : asc(rooms.startsAt);

    const [rows, [total]] = await Promise.all([
      this.db
        .select({ room: rooms, participants: recordings.participants })
        .from(rooms)
        .leftJoin(recordings, eq(recordings.roomId, rooms.id))
        .where(where)
        .orderBy(order, asc(rooms.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ value: count() })
        .from(rooms)
        .leftJoin(recordings, eq(recordings.roomId, rooms.id))
        .where(where),
    ]);
    return {
      items: rows.map(({ room, participants }) => ({
        ...toRoom(room),
        participants: participants ?? [],
      })),
      total: total?.value ?? 0,
    };
  }

  async counts(ownerId: string, now: Date): Promise<RoomCounts> {
    const tally = (tab: SessionTab) => sql<number>`count(*) filter (where ${inTab(tab, now)})::int`;
    const [row] = await this.db
      .select({ live: tally("live"), upcoming: tally("upcoming"), past: tally("past") })
      .from(rooms)
      .where(eq(rooms.ownerId, ownerId));
    return row ?? { live: 0, upcoming: 0, past: 0 };
  }

  async get(id: RoomId): Promise<OwnedRoom | undefined> {
    const [row] = await this.db.select().from(rooms).where(eq(rooms.id, id));
    return row && toRoom(row);
  }

  async save(room: OwnedRoom): Promise<void> {
    const values = {
      ...room,
      startsAt: new Date(room.startsAt),
      endsAt: new Date(room.endsAt),
      createdAt: new Date(room.createdAt),
    };
    await this.db
      .insert(rooms)
      .values(values)
      .onConflictDoUpdate({
        target: rooms.id,
        set: { name: room.name, runtime: room.runtime, endsAt: values.endsAt },
      });
  }

  async delete(id: RoomId): Promise<void> {
    await this.db.delete(rooms).where(eq(rooms.id, id));
  }
}

/** The owner's view of a session's life: they can open it a few minutes early (see roomPhase). */
function inTab(tab: SessionTab, now: Date): SQL | undefined {
  const opens = sql`${rooms.startsAt} - make_interval(mins => ${OWNER_EARLY_MINUTES})`;
  switch (tab) {
    case "live":
      return and(sql`${opens} <= ${now}`, gt(rooms.endsAt, now));
    case "upcoming":
      return sql`${opens} > ${now}`;
    case "past":
      return lte(rooms.endsAt, now);
  }
}

function filters(query: RoomListQuery): (SQL | undefined)[] {
  const pattern = query.q ? `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined;
  const someone = sql`exists (
    select 1 from jsonb_array_elements(${recordings.participants}) as person
    where person->>'name' ilike ${pattern}
  )`;
  return [
    query.from ? gte(rooms.startsAt, new Date(query.from)) : undefined,
    query.to ? lt(rooms.startsAt, new Date(query.to)) : undefined,
    // The session's name, or anyone who took part in it.
    pattern ? or(ilike(rooms.name, pattern), someone) : undefined,
  ];
}

function toRoom(row: typeof rooms.$inferSelect): OwnedRoom {
  if (!isRuntime(row.runtime)) throw new Error(`Room ${row.id} has unknown runtime`);
  return {
    ...row,
    runtime: row.runtime,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
