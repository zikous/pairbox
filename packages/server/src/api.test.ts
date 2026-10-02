import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { Room, ServerMessage } from "@pairbox/shared";
import { createServer } from "./server";

const auth = { authorization: "Bearer test-secret" };

let app: Awaited<ReturnType<typeof createServer>>;

beforeEach(async () => {
  app = await createServer({ hostSecret: "test-secret" });
});
afterEach(() => app.close());

async function createRoom(name = "Interview", language = "python"): Promise<Room> {
  const response = await app.inject({
    method: "POST",
    url: "/api/rooms",
    headers: auth,
    payload: { name, language },
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
    expect(room).toMatchObject({ name: "Mock interview", language: "python" });

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
    expect((await bad({ name: "   ", language: "python" })).statusCode).toBe(400);
    expect((await bad({ name: "x", language: "cobol" })).statusCode).toBe(400);
    expect((await app.inject({ url: "/api/rooms/NOT_AN_ID" })).statusCode).toBe(400);
  });

  it("serves the OpenAPI document", async () => {
    const spec = (await app.inject({ url: "/docs/json" })).json();
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(["/api/rooms/", "/api/rooms/{id}", "/api/health"]),
    );
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

    await waitFor((m) => m.type === "output" && m.data.includes("sandbox"));
    socket.send(JSON.stringify({ type: "run" }));
    await waitFor((m) => m.type === "output" && m.data.includes("Hello from pairbox!"));
    await waitFor((m) => m.type === "status" && m.status.state === "exited");

    socket.send(JSON.stringify({ type: "set_language", language: "javascript" }));
    await waitFor((m) => m.type === "language" && m.language === "javascript");
    socket.terminate();
  });

  it("closes with 4404 for an unknown room", async () => {
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const socket = new WebSocket(`${address.replace("http", "ws")}/ws/rooms/doesnotexist/session`);
    const code = await new Promise((resolve) => socket.on("close", resolve));
    expect(code).toBe(4404);
  });
});
