import { describe, expect, it } from "vitest";
import { isLanguage, normalizeDisplayName, normalizeRoomName } from "./index";

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

describe("isLanguage", () => {
  it("accepts only supported languages", () => {
    expect(isLanguage("python")).toBe(true);
    expect(isLanguage("cobol")).toBe(false);
    expect(isLanguage("toString")).toBe(false);
  });
});
