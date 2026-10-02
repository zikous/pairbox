import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { Room, RunStatus, ServerMessage } from "@pairbox/shared";
import type { Sandboxes, SandboxSession } from "./application/ports";
import { connectDatabase } from "./adapters/storage/database";
import { createServer } from "./server";

// Runs against the real database: `docker compose up -d db` creates pairbox_test.
const envFile = new URL("../../../.env", import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);
const testDatabaseUrl = process.env["TEST_DATABASE_URL"];
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");

const auth = { authorization: "Bearer test-secret" };

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

let database: Awaited<ReturnType<typeof connectDatabase>>;
let app: Awaited<ReturnType<typeof createServer>>;

beforeAll(async () => {
  database = await connectDatabase(testDatabaseUrl);
});
afterAll(() => database.close());

beforeEach(async () => {
  await database.db.execute(sql`truncate rooms, templates cascade`);
  app = await createServer({
    hostSecret: "test-secret",
    db: database.db,
    sandboxes: testSandboxes,
  });
});
afterEach(() => app.close());

async function createRoom(name = "Interview", runtime = "python"): Promise<Room> {
  const response = await app.inject({
    method: "POST",
    url: "/api/rooms",
    headers: auth,
    payload: { name, runtime },
  });
  expect(response.statusCode).toBe(201);
  return response.json();
}

describe("rooms API", () => {
  it("requires the host secret to list, create and delete", async () => {
    expect((await app.inject({ url: "/api/rooms" })).statusCode).toBe(401);
    const wrong = { authorization: "Bearer nope" };
    expect((await app.inject({ url: "/api/rooms", headers: wrong })).statusCode).toBe(401);
    const created = await app.inject({ method: "POST", url: "/api/rooms", payload: {} });
    expect(created.statusCode).toBe(401);
  });

  it("creates, reads, lists and deletes a room", async () => {
    const room = await createRoom("  Mock   interview ");
    expect(room).toMatchObject({ name: "Mock interview", runtime: "python" });

    const fetched = await app.inject({ url: `/api/rooms/${room.id}` });
    expect(fetched.json()).toEqual(room);

    const list = await app.inject({ url: "/api/rooms", headers: auth });
    expect(list.json()).toEqual([room]);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/rooms/${room.id}`,
      headers: auth,
    });
    expect(deleted.statusCode).toBe(204);
    expect((await app.inject({ url: `/api/rooms/${room.id}` })).statusCode).toBe(404);
  });

  it("rejects invalid input", async () => {
    const bad = (payload: object) =>
      app.inject({ method: "POST", url: "/api/rooms", headers: auth, payload });
    expect((await bad({ name: "   ", runtime: "python" })).statusCode).toBe(400);
    expect((await bad({ name: "x", runtime: "cobol" })).statusCode).toBe(400);
    expect((await app.inject({ url: "/api/rooms/NOT_AN_ID" })).statusCode).toBe(400);
  });

  it("serves the OpenAPI document", async () => {
    const spec = (await app.inject({ url: "/docs/json" })).json();
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(["/api/rooms/", "/api/rooms/{id}", "/api/health"]),
    );
  });
});

describe("storage", () => {
  it("keeps rooms and their code across restarts", async () => {
    const room = await createRoom("Survivor");
    await app.close();
    app = await createServer({
      hostSecret: "test-secret",
      db: database.db,
      sandboxes: testSandboxes,
    });

    expect((await app.inject({ url: `/api/rooms/${room.id}` })).json()).toEqual(room);
    const [row] = await database.db
      .execute<{ size: number }>(
        sql`select length(state) as size from workspaces where room_id = ${room.id}`,
      )
      .then((result) => result.rows);
    expect(row?.size).toBeGreaterThan(0);
  });
});

describe("session socket", () => {
  it("shares the terminal and runs code", async () => {
    const room = await createRoom();
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
