import { describe, expect, it } from "vitest";
import { isRuntime, normalizeDisplayName, normalizeRoomName, roomPhase } from "./index";

describe("normalizeRoomName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeRoomName("  Mock   interview ")).toBe("Mock interview");
  });

  it("rejects empty and overlong names", () => {
    expect(normalizeRoomName("   ")).toBeNull();
    expect(normalizeRoomName("x".repeat(61))).toBeNull();
  });
});

describe("normalizeDisplayName", () => {
  it("rejects empty and overlong names", () => {
    expect(normalizeDisplayName("")).toBeNull();
    expect(normalizeDisplayName("x".repeat(33))).toBeNull();
    expect(normalizeDisplayName(" Ada ")).toBe("Ada");
  });
});

describe("isRuntime", () => {
  it("accepts only supported runtimes", () => {
    expect(isRuntime("python")).toBe(true);
    expect(isRuntime("cobol")).toBe(false);
    expect(isRuntime("toString")).toBe(false);
  });
});

describe("roomPhase", () => {
  const room = { startsAt: "2026-10-03T14:00:00Z", endsAt: "2026-10-03T15:00:00Z" };
  const at = (time: string) => Date.parse(`2026-10-03T${time}:00Z`);

  it("is upcoming before the start, open during the slot, ended after", () => {
    expect(roomPhase(room, { now: at("13:55") })).toBe("upcoming");
    expect(roomPhase(room, { now: at("14:00") })).toBe("open");
    expect(roomPhase(room, { now: at("15:00") })).toBe("ended");
  });

  it("lets the owner in a few minutes early", () => {
    expect(roomPhase(room, { owner: true, now: at("13:51") })).toBe("open");
    expect(roomPhase(room, { owner: true, now: at("13:45") })).toBe("upcoming");
  });
});
