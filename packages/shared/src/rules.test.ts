import { describe, expect, it } from "vitest";
import { isRuntime, normalizeDisplayName, normalizeRoomName } from "./index";

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
