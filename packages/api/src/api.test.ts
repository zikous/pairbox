import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import type {
  RecordingEvent,
  RecordingReplay,
  Room,
  RunStatus,
  ServerMessage,
} from "@pairbox/shared";
import type { Booking } from "@pairbox/shared";
import type { RecordingStore, Sandboxes, SandboxSession, Scheduler } from "./application/ports";
import { SlotTakenError } from "./application/errors";
import { connectDatabase } from "./adapters/storage/database";
import { createServer } from "./server";

// Runs against a real database: `docker compose up -d db` creates pairbox_test.
const testDatabaseUrl = process.env["TEST_DATABASE_URL"];
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");

/** Stands in for the pool and workers: "runs" code by echoing its first line. */
const testSandboxes: Sandboxes = {
  async open(): Promise<SandboxSession> {
    let onOutput: (data: string) => void = () => {};
    let onStatus: (status: RunStatus) => void = () => {};
    return {
      onOutput: (listener) => (onOutput = listener),
      onStatus: (listener) => (onStatus = listener),
      onLost: () => {},
      input: (data) => onOutput(data),
      resize: () => {},
      write: () => {},
      run: (code, runtime) => {
        onOutput(`ran ${runtime}: ${code.split("\n")[0]}\r\n`);
        onStatus({ state: "exited", exitCode: 0, durationMs: 1 });
      },
      stop: () => {},
      close: async () => {},
    };
  },
};

/** Keeps recordings in memory instead of object storage. */
function memoryRecordingStore(): RecordingStore {
  const snapshots = new Map<string, Uint8Array>();
  const chunks = new Map<string, RecordingEvent[][]>();
  return {
    saveSnapshot: async (_room, id, state) => void snapshots.set(id, state),
    loadSnapshot: async (_room, id) => snapshots.get(id) ?? new Uint8Array(),
    appendChunk: async (_room, id, seq, events) => {
      const list = chunks.get(id) ?? [];
      list[seq] = events;
      chunks.set(id, list);
    },
    readChunks: async (_room, id, count) => (chunks.get(id) ?? []).slice(0, count).flat(),
    deleteRoom: async () => {},
  };
}

/** A calendar with two workers: a third overlapping booking is refused. */
function twoWorkerScheduler(): Scheduler {
  const bookings: Booking[] = [];
  const overlaps = (a: Booking, b: Booking) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;
  return {
    async book(booking) {
      if (bookings.filter((other) => overlaps(other, booking)).length >= 2) {
        throw new SlotTakenError();
      }
      bookings.push(booking);
    },
    async cancel(roomId) {
      const index = bookings.findIndex((b) => b.roomId === roomId);
      if (index >= 0) bookings.splice(index, 1);
    },
    availability: async () => ({ slots: [] }),
  };
}

const recordingStore = memoryRecordingStore();
let scheduler = twoWorkerScheduler();
let database: Awaited<ReturnType<typeof connectDatabase>>;
let app: Awaited<ReturnType<typeof createServer>>;
const start = async () =>
  (app = await createServer({
    db: database.db,
    sandboxes: testSandboxes,
    scheduler,
    recordingStore,
  }));

beforeAll(async () => {
  database = await connectDatabase(testDatabaseUrl);
});
afterAll(() => database.close());
beforeEach(async () => {
  await database.db.execute(sql`truncate users, templates cascade`);
  scheduler = twoWorkerScheduler();
  await start();
});
afterEach(() => app.close());

/** Signs up and returns the session cookie to send with later requests. */
async function signUp(email = "ada@example.com", password = "correct horse") {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/signup",
    payload: { email, password },
  });
  expect(response.statusCode).toBe(201);
  const cookie = response.cookies.find((c) => c.name === "pairbox_session");
  expect(cookie?.httpOnly).toBe(true);
  return { cookie: `pairbox_session=${cookie?.value}` };
}

/** Books a room starting now (or `inMinutes` from now) for an hour. */
async function createRoom(
  headers: { cookie: string },
  { name = "Interview", inMinutes = 0 } = {},
): Promise<Room> {
  const response = await app.inject({
    method: "POST",
    url: "/api/rooms",
    headers,
    payload: { name, startsAt: minutesFromNow(inMinutes), durationMinutes: 60 },
  });
  expect(response.statusCode).toBe(201);
  return response.json();
}

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

/** Opens a room's WebSocket, as the owner (cookie) or a guest (ticket). */
const connect = (path: string, headers?: { cookie: string }) =>
  app.injectWS(path, headers ? { headers } : {});

/** Resolves with the code the server closes a socket with. */
function closeCode(socket: { on(event: "close", listener: (code: number) => void): unknown }) {
  return new Promise<number>((resolve) => socket.on("close", resolve));
}

describe("auth", () => {
  it("signs up, then knows who you are", async () => {
    const headers = await signUp(" Ada@Example.com ");
    const me = await app.inject({ url: "/api/auth/me", headers });
    expect(me.json()).toMatchObject({ email: "ada@example.com" });
  });

  it("refuses a second account with the same email", async () => {
    await signUp();
    const again = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { email: "ada@example.com", password: "another password" },
    });
    expect(again.statusCode).toBe(409);
  });

  it("signs in only with the right password", async () => {
    await signUp();
    const login = (password: string) =>
      app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "ada@example.com", password },
      });
    expect((await login("wrong password")).statusCode).toBe(401);
    expect((await login("correct horse")).statusCode).toBe(200);
  });

  it("signing out ends the session", async () => {
    const headers = await signUp();
    await app.inject({ method: "POST", url: "/api/auth/logout", headers });
    expect((await app.inject({ url: "/api/auth/me", headers })).statusCode).toBe(401);
  });
});

describe("rooms", () => {
  it("needs a signed-in user to list and book", async () => {
    expect((await app.inject({ url: "/api/rooms" })).statusCode).toBe(401);
    const book = await app.inject({ method: "POST", url: "/api/rooms", payload: {} });
    expect(book.statusCode).toBe(401);
  });

  it("books, reads, lists and deletes a session", async () => {
    const headers = await signUp();
    const room = await createRoom(headers, { name: "  Mock   interview " });
    expect(room).toMatchObject({ name: "Mock interview", runtime: "python" });
    expect(Date.parse(room.endsAt) - Date.parse(room.startsAt)).toBe(60 * 60_000);

    // Anyone with the link can look a room up; only its owner is told it's theirs.
    const asGuest = await app.inject({ url: `/api/rooms/${room.id}` });
    expect(asGuest.json()).toEqual({ ...room, owner: false });
    const asOwner = await app.inject({ url: `/api/rooms/${room.id}`, headers });
    expect(asOwner.json()).toMatchObject({ owner: true });
    expect((await app.inject({ url: "/api/rooms?tab=live", headers })).json()).toEqual({
      items: [{ ...room, participants: [] }],
      total: 1,
    });

    const deleted = await app.inject({ method: "DELETE", url: `/api/rooms/${room.id}`, headers });
    expect(deleted.statusCode).toBe(204);
    expect((await app.inject({ url: `/api/rooms/${room.id}` })).statusCode).toBe(404);
  });

  it("refuses a slot when no sandbox is free for it", async () => {
    const headers = await signUp();
    await createRoom(headers);
    const book = (inMinutes: number) =>
      app.inject({
        method: "POST",
        url: "/api/rooms",
        headers,
        payload: { name: "x", startsAt: minutesFromNow(inMinutes), durationMinutes: 60 },
      });
    expect((await book(0)).statusCode).toBe(201); // on the second worker
    expect((await book(30)).statusCode).toBe(409); // both are busy then
    expect((await book(60)).statusCode).toBe(201); // right after the first two
  });

  it("keeps each user's sessions to themselves", async () => {
    const ada = await signUp("ada@example.com");
    const bob = await signUp("bob@example.com");
    const room = await createRoom(ada);

    const list = await app.inject({ url: "/api/rooms?tab=live", headers: bob });
    expect(list.json()).toEqual({ items: [], total: 0 });
    const steal = await app.inject({
      method: "DELETE",
      url: `/api/rooms/${room.id}`,
      headers: bob,
    });
    expect(steal.statusCode).toBe(403);
  });

  it("sorts sessions into tabs, searches them and pages through them", async () => {
    const headers = await signUp();
    const live = await createRoom(headers, { name: "Live one" });
    const soon = await createRoom(headers, {
      name: "Pairing 50%",
      inMinutes: 5, // the owner can open it early
    });
    const later = await createRoom(headers, { name: "Later", inMinutes: 120 });
    const latest = await createRoom(headers, { name: "Latest", inMinutes: 240 });
    const list = async (query: string) =>
      (await app.inject({ url: `/api/rooms?${query}`, headers })).json();
    const names = async (query: string) => (await list(query)).items.map((room: Room) => room.name);

    expect((await app.inject({ url: "/api/rooms/counts", headers })).json()).toEqual({
      live: 2,
      upcoming: 2,
      past: 0,
    });
    expect(await names("tab=live")).toEqual([live.name, soon.name]);
    expect(await names("tab=upcoming")).toEqual([later.name, latest.name]);
    expect(await names("tab=live&q=50%25")).toEqual([soon.name]); // % is matched literally
    expect(await names(`tab=upcoming&from=${encodeURIComponent(latest.startsAt)}`)).toEqual([
      latest.name,
    ]);
    expect(await list("tab=upcoming&pageSize=1&page=2")).toMatchObject({
      items: [{ id: latest.id }],
      total: 2,
    });

    await app.inject({ method: "POST", url: `/api/rooms/${live.id}/end`, headers });
    expect(await names("tab=past")).toEqual([live.name]);
  });

  it("rejects invalid input", async () => {
    const headers = await signUp();
    const bad = (payload: object) =>
      app.inject({ method: "POST", url: "/api/rooms", headers, payload });
    const valid = {
      name: "x",
      startsAt: minutesFromNow(0),
      durationMinutes: 60,
    };
    expect((await bad({ ...valid, name: "   " })).statusCode).toBe(400);
    expect((await bad({ ...valid, durationMinutes: 45 })).statusCode).toBe(400);
    expect((await bad({ ...valid, startsAt: minutesFromNow(-60) })).statusCode).toBe(400);
    expect((await app.inject({ url: "/api/rooms/NOT_AN_ID" })).statusCode).toBe(400);
  });

  it("keeps rooms and their code across restarts", async () => {
    const room = await createRoom(await signUp());
    await app.close();
    await start();

    expect((await app.inject({ url: `/api/rooms/${room.id}` })).json()).toMatchObject(room);
    const { rows } = await database.db.execute<{ size: number }>(
      sql`select length(state) as size from workspaces where room_id = ${room.id}`,
    );
    expect(rows[0]?.size).toBeGreaterThan(0);
  });
});

describe("lobby", () => {
  const ask = (roomId: string) =>
    app.inject({
      method: "POST",
      url: `/api/rooms/${roomId}/join-requests`,
      payload: { participant: { name: "Grace", color: "#30a46c" } },
    });
  const status = (roomId: string, requestId: string) =>
    app.inject({ url: `/api/rooms/${roomId}/join-requests/${requestId}` }).then((r) => r.json());

  it("keeps guests out until the owner lets them in", async () => {
    const owner = await signUp();
    const room = await createRoom(owner);

    expect(await closeCode(await connect(`/ws/rooms/${room.id}/session`))).toBe(4403);

    const { id } = (await ask(room.id)).json();
    expect(await status(room.id, id)).toEqual({ status: "pending" });
    const admit = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.id}/join-requests/${id}/admit`,
      headers: owner,
    });
    expect(admit.statusCode).toBe(204);

    const { ticket } = await status(room.id, id);
    const guest = await connect(`/ws/rooms/${room.id}/session?ticket=${ticket}`);
    const messages: ServerMessage[] = [];
    guest.on("message", (data) => messages.push(JSON.parse(data.toString())));
    await expect
      .poll(() => messages.some((m) => m.type === "sandbox"), { timeout: 2000 })
      .toBe(true);
    guest.terminate();
  });

  it("turned-away guests get no ticket, and only the owner decides", async () => {
    const owner = await signUp("ada@example.com");
    const stranger = await signUp("bob@example.com");
    const room = await createRoom(owner);
    const { id } = (await ask(room.id)).json();
    const decide = (decision: string, headers: { cookie: string }) =>
      app.inject({
        method: "POST",
        url: `/api/rooms/${room.id}/join-requests/${id}/${decision}`,
        headers,
      });

    expect((await decide("admit", stranger)).statusCode).toBe(403);
    expect((await decide("deny", owner)).statusCode).toBe(204);
    expect(await status(room.id, id)).toEqual({ status: "denied" });
  });

  it("can't be joined before the session starts", async () => {
    const room = await createRoom(await signUp(), { inMinutes: 90 });
    expect((await ask(room.id)).statusCode).toBe(409);
  });
});

describe("session socket", () => {
  it("shares the terminal and runs code", async () => {
    const owner = await signUp();
    const room = await createRoom(owner);
    const socket = await connect(`/ws/rooms/${room.id}/session`, owner);
    const messages: ServerMessage[] = [];
    socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
    const waitFor = (predicate: (m: ServerMessage) => boolean) =>
      expect.poll(() => messages.some(predicate), { timeout: 2000 }).toBe(true);

    await waitFor((m) => m.type === "sandbox" && m.sandbox.state === "ready");
    socket.send(JSON.stringify({ type: "run" }));
    await waitFor((m) => m.type === "output" && m.data.startsWith("ran python: name ="));
    await waitFor((m) => m.type === "status" && m.status.state === "exited");
    socket.terminate();
  });

  it("switches the room's language for everyone, starter code included", async () => {
    const owner = await signUp();
    const room = await createRoom(owner);
    const socket = await connect(`/ws/rooms/${room.id}/session`, owner);
    const messages: ServerMessage[] = [];
    socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
    const waitFor = (predicate: (m: ServerMessage) => boolean) =>
      expect.poll(() => messages.some(predicate), { timeout: 2000 }).toBe(true);

    await waitFor((m) => m.type === "runtime" && m.runtime === "python");
    await waitFor((m) => m.type === "sandbox" && m.sandbox.state === "ready");
    socket.send(JSON.stringify({ type: "set_runtime", runtime: "typescript" }));
    await waitFor((m) => m.type === "runtime" && m.runtime === "typescript");
    socket.send(JSON.stringify({ type: "run" }));
    await waitFor((m) => m.type === "output" && m.data.startsWith("ran typescript: const name"));

    const saved = await app.inject({ url: `/api/rooms/${room.id}` });
    expect(saved.json()).toMatchObject({ runtime: "typescript" });
    socket.terminate();
  });

  it("closes with 4404 for an unknown room", async () => {
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const socket = new WebSocket(`${address.replace("http", "ws")}/ws/rooms/doesnotexist/session`);
    expect(await closeCode(socket)).toBe(4404);
  });
});

describe("recordings", () => {
  it("records one recording per session, for its owner only", async () => {
    const ada = await signUp("ada@example.com");
    const bob = await signUp("bob@example.com");
    const room = await createRoom(ada);

    // Two visits to the same session: the second continues the same recording.
    for (const command of ["ls\r", "pwd\r"]) {
      const sync = await connect(`/ws/rooms/${room.id}/sync`, ada);
      const session = await connect(`/ws/rooms/${room.id}/session`, ada);
      const send = (message: object) => session.send(JSON.stringify(message));
      send({ type: "hello", participant: { name: "Ada", color: "#0090ff" } });
      send({ type: "input", data: command });
      await new Promise((resolve) => setTimeout(resolve, 150));
      session.terminate();
      sync.terminate();
      await new Promise((resolve) => setTimeout(resolve, 150)); // leaving saves what was recorded
    }

    // Saving happens in the background once everyone has left.
    const replay = await vi.waitFor(async () => {
      const replay: RecordingReplay = (
        await app.inject({ url: `/api/rooms/${room.id}/recording`, headers: ada })
      ).json();
      const inputs = replay.events.flatMap((e) => (e.type === "input" ? [e.data] : []));
      expect(inputs).toEqual(["ls\r", "pwd\r"]);
      return replay;
    });
    expect(replay.events[0]).toEqual({ t: 0, type: "runtime", runtime: "python" }); // where it starts
    expect(replay.recording.participants).toEqual([{ name: "Ada", color: "#0090ff" }]);
    expect(replay.snapshot.length).toBeGreaterThan(0);

    const asBob = await app.inject({ url: `/api/rooms/${room.id}/recording`, headers: bob });
    expect(asBob.statusCode).toBe(403);
  });

  it("ending a session early disconnects everyone and frees the slot", async () => {
    const owner = await signUp();
    const room = await createRoom(owner);
    const session = await connect(`/ws/rooms/${room.id}/session`, owner);
    const messages: ServerMessage[] = [];
    session.on("message", (data) => messages.push(JSON.parse(data.toString())));

    const end = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.id}/end`,
      headers: owner,
    });
    expect(end.statusCode).toBe(204);
    await expect.poll(() => messages.some((m) => m.type === "session_ended")).toBe(true);

    const ended: Room = (await app.inject({ url: `/api/rooms/${room.id}` })).json();
    expect(Date.parse(ended.endsAt)).toBeLessThanOrEqual(Date.now());
    await createRoom(owner); // the rest of the slot can be booked again
  });
});
