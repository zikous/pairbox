import { describe, expect, it, vi } from "vitest";
import type { Runtime } from "@pairbox/shared";
import { WorkerPool } from "./application/pool";

const worker = (id: string, runtime: Runtime = "python") => ({
  id,
  url: `http://${id}:8744`,
  runtime,
});

function setup(clean = vi.fn(async () => {})) {
  let now = 0;
  const pool = new WorkerPool({ clean }, 15_000, () => now);
  return { pool, clean, advance: (ms: number) => (now += ms) };
}

// Lets the background cleaning finish.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("WorkerPool", () => {
  it("reserves a free worker of the room's runtime", () => {
    const { pool } = setup();
    pool.register(worker("py-1"));
    pool.register(worker("ts-1", "typescript"));

    const reservation = pool.reserve({ roomId: "room1", runtime: "typescript" });
    expect(reservation).toMatchObject({ status: "reserved", worker: { id: "ts-1" } });
    expect(pool.list().find((w) => w.id === "ts-1")).toMatchObject({
      state: "reserved",
      roomId: "room1",
    });
  });

  it("returns the same reservation when a room asks twice", () => {
    const { pool } = setup();
    pool.register(worker("py-1"));
    const first = pool.reserve({ roomId: "room1", runtime: "python" });
    expect(pool.reserve({ roomId: "room1", runtime: "python" })).toEqual(first);
  });

  it("queues rooms in order when no worker is free", () => {
    const { pool } = setup();
    pool.register(worker("py-1"));
    pool.reserve({ roomId: "room1", runtime: "python" });

    const second = pool.reserve({ roomId: "room2", runtime: "python" });
    const third = pool.reserve({ roomId: "room3", runtime: "python" });
    expect(second).toMatchObject({ status: "queued", position: 1 });
    expect(third).toMatchObject({ status: "queued", position: 2 });
  });

  it("cleans a released worker, then gives it to the next room in line", async () => {
    const { pool, clean } = setup();
    pool.register(worker("py-1"));
    const first = pool.reserve({ roomId: "room1", runtime: "python" });
    const second = pool.reserve({ roomId: "room2", runtime: "python" });

    pool.release(first.id);
    expect(clean).toHaveBeenCalledWith(expect.objectContaining({ id: "py-1" }));
    expect(pool.get(second.id)).toMatchObject({ status: "queued" }); // still cleaning

    await settle();
    expect(pool.get(second.id)).toMatchObject({ status: "reserved", worker: { id: "py-1" } });
    expect(pool.get(first.id)).toBeUndefined();
  });

  it("drops a worker that fails to clean", async () => {
    const { pool } = setup(vi.fn(async () => Promise.reject(new Error("boom"))));
    pool.register(worker("py-1"));
    pool.release(pool.reserve({ roomId: "room1", runtime: "python" }).id);
    await settle();
    expect(pool.list()).toEqual([]);
  });

  it("leaving the queue moves everyone behind up", () => {
    const { pool } = setup();
    const waiting = pool.reserve({ roomId: "room1", runtime: "python" });
    const behind = pool.reserve({ roomId: "room2", runtime: "python" });
    pool.release(waiting.id);
    expect(pool.get(behind.id)).toMatchObject({ status: "queued", position: 1 });
  });

  it("serves the queue when a new worker registers", () => {
    const { pool } = setup();
    const waiting = pool.reserve({ roomId: "room1", runtime: "python" });
    pool.register(worker("py-1"));
    expect(pool.get(waiting.id)).toMatchObject({ status: "reserved" });
  });

  it("forgets workers that stop sending heartbeats", () => {
    const { pool, advance } = setup();
    pool.register(worker("py-1"));
    pool.register(worker("py-2"));
    const reservation = pool.reserve({ roomId: "room1", runtime: "python" });

    advance(10_000);
    pool.heartbeat("py-2");
    advance(10_000);
    pool.removeSilentWorkers();

    expect(pool.list().map((w) => w.id)).toEqual(["py-2"]);
    expect(pool.get(reservation.id)).toBeUndefined();
    expect(pool.heartbeat("py-1")).toBe(false);
  });
});
