import { describe, expect, it, vi } from "vitest";
import { WorkerPool } from "./application/pool";

const worker = (id: string) => ({ id, url: `http://${id}:8744` });

function setup(clean = vi.fn(async () => {})) {
  let now = 0;
  const pool = new WorkerPool({ clean }, 15_000, () => now);
  return { pool, clean, advance: (ms: number) => (now += ms) };
}

// Lets the background cleaning finish.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("WorkerPool", () => {
  it("reserves a free worker", () => {
    const { pool } = setup();
    pool.register(worker("w-1"));
    pool.register(worker("w-2"));
    pool.reserve({ roomId: "room1" });

    const reservation = pool.reserve({ roomId: "room2" });
    expect(reservation).toMatchObject({ status: "reserved", worker: { id: "w-2" } });
    expect(pool.list().find((w) => w.id === "w-2")).toMatchObject({
      state: "reserved",
      roomId: "room2",
    });
  });

  it("returns the same reservation when a room asks twice", () => {
    const { pool } = setup();
    pool.register(worker("w-1"));
    const first = pool.reserve({ roomId: "room1" });
    expect(pool.reserve({ roomId: "room1" })).toEqual(first);
  });

  it("queues rooms in order when no worker is free", () => {
    const { pool } = setup();
    pool.register(worker("w-1"));
    pool.reserve({ roomId: "room1" });

    const second = pool.reserve({ roomId: "room2" });
    const third = pool.reserve({ roomId: "room3" });
    expect(second).toMatchObject({ status: "queued", position: 1 });
    expect(third).toMatchObject({ status: "queued", position: 2 });
  });

  it("cleans a released worker, then gives it to the next room in line", async () => {
    const { pool, clean } = setup();
    pool.register(worker("w-1"));
    const first = pool.reserve({ roomId: "room1" });
    const second = pool.reserve({ roomId: "room2" });

    pool.release(first.id);
    expect(clean).toHaveBeenCalledWith(expect.objectContaining({ id: "w-1" }));
    expect(pool.get(second.id)).toMatchObject({ status: "queued" }); // still cleaning

    await settle();
    expect(pool.get(second.id)).toMatchObject({ status: "reserved", worker: { id: "w-1" } });
    expect(pool.get(first.id)).toBeUndefined();
  });

  it("drops a worker that fails to clean", async () => {
    const { pool } = setup(vi.fn(async () => Promise.reject(new Error("boom"))));
    pool.register(worker("w-1"));
    pool.release(pool.reserve({ roomId: "room1" }).id);
    await settle();
    expect(pool.list()).toEqual([]);
  });

  it("leaving the queue moves everyone behind up", () => {
    const { pool } = setup();
    const waiting = pool.reserve({ roomId: "room1" });
    const behind = pool.reserve({ roomId: "room2" });
    pool.release(waiting.id);
    expect(pool.get(behind.id)).toMatchObject({ status: "queued", position: 1 });
  });

  it("serves the queue when a new worker registers", () => {
    const { pool } = setup();
    const waiting = pool.reserve({ roomId: "room1" });
    pool.register(worker("w-1"));
    expect(pool.get(waiting.id)).toMatchObject({ status: "reserved" });
  });

  it("forgets workers that stop sending heartbeats", () => {
    const { pool, advance } = setup();
    pool.register(worker("w-1"));
    pool.register(worker("w-2"));
    const reservation = pool.reserve({ roomId: "room1" });

    advance(10_000);
    pool.heartbeat("w-2");
    advance(10_000);
    pool.removeSilentWorkers();

    expect(pool.list().map((w) => w.id)).toEqual(["w-2"]);
    expect(pool.get(reservation.id)).toBeUndefined();
    expect(pool.heartbeat("w-1")).toBe(false);
  });
});
