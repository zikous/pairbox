import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type {
  RecordingEvent,
  RecordingReplay,
  Room,
  RunStatus,
  ServerMessage,
} from "@pairbox/shared";
import type { RecordingStore, Sandboxes, SandboxSession } from "./application/ports";
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
      run: (code) => {
        onOutput(`ran: ${code.split("\n")[0]}\r\n`);
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

const recordingStore = memoryRecordingStore();
let database: Awaited<ReturnType<typeof connectDatabase>>;
let app: Awaited<ReturnType<typeof createServer>>;
const start = async () =>
  (app = await createServer({ db: database.db, sandboxes: testSandboxes, recordingStore }));

beforeAll(async () => {
  database = await connectDatabase(testDatabaseUrl);
});
afterAll(() => database.close());
beforeEach(async () => {
  await database.db.execute(sql`truncate users, templates cascade`);
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

async function createRoom(headers: { cookie: string }, name = "Interview"): Promise<Room> {
  const response = await app.inject({
    method: "POST",
    url: "/api/rooms",
    headers,
    payload: { name, runtime: "python" },
  });
  expect(response.statusCode).toBe(201);
  return response.json();
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
  it("needs a signed-in user to list, create and delete", async () => {
    expect((await app.inject({ url: "/api/rooms" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/rooms", payload: {} })).statusCode).toBe(
      401,
    );
  });

  it("creates, reads, lists and deletes a room", async () => {
    const headers = await signUp();
    const room = await createRoom(headers, "  Mock   interview ");
    expect(room).toMatchObject({ name: "Mock interview", runtime: "python" });

    // Anyone with the link can look a room up.
    expect((await app.inject({ url: `/api/rooms/${room.id}` })).json()).toEqual(room);
    expect((await app.inject({ url: "/api/rooms", headers })).json()).toEqual([room]);

    const deleted = await app.inject({ method: "DELETE", url: `/api/rooms/${room.id}`, headers });
    expect(deleted.statusCode).toBe(204);
    expect((await app.inject({ url: `/api/rooms/${room.id}` })).statusCode).toBe(404);
  });

  it("keeps each user's rooms to themselves", async () => {
    const ada = await signUp("ada@example.com");
    const bob = await signUp("bob@example.com");
    const room = await createRoom(ada);

    expect((await app.inject({ url: "/api/rooms", headers: bob })).json()).toEqual([]);
    const steal = await app.inject({
      method: "DELETE",
      url: `/api/rooms/${room.id}`,
      headers: bob,
    });
    expect(steal.statusCode).toBe(403);
  });

  it("rejects invalid input", async () => {
    const headers = await signUp();
    const bad = (payload: object) =>
      app.inject({ method: "POST", url: "/api/rooms", headers, payload });
    expect((await bad({ name: "   ", runtime: "python" })).statusCode).toBe(400);
    expect((await bad({ name: "x", runtime: "cobol" })).statusCode).toBe(400);
    expect((await app.inject({ url: "/api/rooms/NOT_AN_ID" })).statusCode).toBe(400);
  });

  it("keeps rooms and their code across restarts", async () => {
    const room = await createRoom(await signUp());
    await app.close();
    await start();

    expect((await app.inject({ url: `/api/rooms/${room.id}` })).json()).toEqual(room);
    const { rows } = await database.db.execute<{ size: number }>(
      sql`select length(state) as size from workspaces where room_id = ${room.id}`,
    );
    expect(rows[0]?.size).toBeGreaterThan(0);
  });
});

describe("session socket", () => {
  it("shares the terminal and runs code", async () => {
    const room = await createRoom(await signUp());
    const socket = await app.injectWS(`/ws/rooms/${room.id}/session`);
    const messages: ServerMessage[] = [];
    socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
    const waitFor = (predicate: (m: ServerMessage) => boolean) =>
      expect.poll(() => messages.some(predicate), { timeout: 2000 }).toBe(true);

    await waitFor((m) => m.type === "sandbox" && m.sandbox.state === "ready");
    socket.send(JSON.stringify({ type: "run" }));
    await waitFor((m) => m.type === "output" && m.data.startsWith("ran: name ="));
    await waitFor((m) => m.type === "status" && m.status.state === "exited");

    socket.send(JSON.stringify({ type: "set_runtime", runtime: "typescript" }));
    await waitFor((m) => m.type === "runtime" && m.runtime === "typescript");
    socket.terminate();
  });

  it("closes with 4404 for an unknown room", async () => {
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const socket = new WebSocket(`${address.replace("http", "ws")}/ws/rooms/doesnotexist/session`);
    const code = await new Promise((resolve) => socket.on("close", resolve));
    expect(code).toBe(4404);
  });
});

describe("recordings", () => {
  it("records a session for the room's owner to replay, and no one else", async () => {
    const ada = await signUp("ada@example.com");
    const bob = await signUp("bob@example.com");
    const room = await createRoom(ada);

    // Opening the document starts the recording; the session socket carries terminal actions.
    const sync = await app.injectWS(`/ws/rooms/${room.id}/sync`);
    const session = await app.injectWS(`/ws/rooms/${room.id}/session`);
    const send = (message: object) => session.send(JSON.stringify(message));
    send({ type: "hello", participant: { name: "Ada", color: "#0090ff" } });
    send({ type: "input", data: "ls\r" });
    send({ type: "run" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    session.terminate();
    sync.terminate();

    await app.close(); // ends the session and saves what it recorded
    await start();

    const list = await app.inject({ url: `/api/rooms/${room.id}/recordings`, headers: ada });
    const [recording] = list.json();
    expect(recording).toMatchObject({ participants: [{ name: "Ada" }] });
    expect(recording.endedAt).not.toBeNull();

    const replay: RecordingReplay = (
      await app.inject({ url: `/api/recordings/${recording.id}`, headers: ada })
    ).json();
    const actions = replay.events.map((e) =>
      "by" in e && e.by ? `${e.type}:${e.by.name}` : e.type,
    );
    expect(actions).toEqual(expect.arrayContaining(["join:Ada", "input:Ada", "run:Ada"]));
    expect(replay.snapshot.length).toBeGreaterThan(0);

    const asBob = (url: string) => app.inject({ url, headers: bob });
    expect((await asBob(`/api/rooms/${room.id}/recordings`)).statusCode).toBe(403);
    expect((await asBob(`/api/recordings/${recording.id}`)).statusCode).toBe(403);
  });
});
