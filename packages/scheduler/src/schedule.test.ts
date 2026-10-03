import { describe, expect, it } from "vitest";
import type { Booking, Runtime } from "@pairbox/shared";
import type { BookingRepository } from "./application/ports";
import { peakOverlap, Schedule, SlotFullError } from "./application/schedule";

const at = (time: string) => `2026-10-03T${time}:00.000Z`;
const booking = (roomId: string, start: string, end: string, runtime: Runtime = "python") => ({
  roomId,
  runtime,
  startsAt: at(start),
  endsAt: at(end),
});

function memoryBookings(): BookingRepository {
  const all: Booking[] = [];
  return {
    overlapping: async (runtime, from, to) =>
      all.filter(
        (b) =>
          b.runtime === runtime && Date.parse(b.startsAt) < +to && Date.parse(b.endsAt) > +from,
      ),
    insert: async (b) => void all.push(b),
    delete: async (roomId) =>
      void all.splice(
        all.findIndex((b) => b.roomId === roomId),
        1,
      ),
    exclusively: (_runtime, work) => work(),
  };
}

const twoPythonWorkers = { of: async (runtime: Runtime) => (runtime === "python" ? 2 : 1) };
const schedule = () =>
  new Schedule(memoryBookings(), twoPythonWorkers, () => Date.parse(at("00:00")));

describe("peakOverlap", () => {
  it("counts the most bookings running at the same moment", () => {
    const taken = [
      booking("a", "10:00", "11:00"),
      booking("b", "10:30", "12:00"),
      booking("c", "11:30", "12:30"),
    ];
    expect(peakOverlap(taken, new Date(at("10:00")), new Date(at("13:00")))).toBe(2);
    expect(peakOverlap(taken, new Date(at("12:30")), new Date(at("13:00")))).toBe(0);
  });

  it("doesn't count back-to-back slots as overlapping", () => {
    const taken = [booking("a", "10:00", "11:00"), booking("b", "11:00", "12:00")];
    expect(peakOverlap(taken, new Date(at("10:00")), new Date(at("12:00")))).toBe(1);
  });
});

describe("Schedule", () => {
  it("books up to the number of workers, then refuses", async () => {
    const s = schedule();
    await s.book(booking("a", "10:00", "11:00"));
    await s.book(booking("b", "10:00", "11:00"));
    await expect(s.book(booking("c", "10:30", "11:30"))).rejects.toThrow(SlotFullError);
    await s.book(booking("d", "11:00", "12:00")); // a and b are over by then
  });

  it("counts each runtime's workers separately", async () => {
    const s = schedule();
    await s.book(booking("a", "10:00", "11:00", "typescript"));
    await expect(s.book(booking("b", "10:00", "11:00", "typescript"))).rejects.toThrow(
      SlotFullError,
    );
    await s.book(booking("c", "10:00", "11:00", "python"));
  });

  it("frees a slot when a booking is cancelled", async () => {
    const s = schedule();
    await s.book(booking("a", "10:00", "11:00", "typescript"));
    await s.cancel("a");
    await s.book(booking("b", "10:00", "11:00", "typescript"));
  });

  it("lists which half hours are still free", async () => {
    const s = schedule();
    await s.book(booking("a", "10:00", "11:00", "typescript"));
    const { slots } = await s.availability("typescript", new Date(at("00:00")), 60);
    const free = (time: string) => slots.find((slot) => slot.startsAt === at(time))?.free;
    expect(slots).toHaveLength(48);
    expect(free("09:00")).toBe(true); // ends exactly when the booking starts
    expect(free("09:30")).toBe(false);
    expect(free("10:30")).toBe(false);
    expect(free("11:00")).toBe(true);
  });
});
