import type { Availability, Booking } from "@pairbox/shared";
import type { BookingRepository, Capacity } from "./ports";

const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;
const MINUTE = 60_000;

export class SlotFullError extends Error {
  constructor() {
    super("No sandbox is free for the whole slot. Try another time.");
  }
}

/**
 * The calendar of booked rooms. A booking is accepted only if, at every moment of its slot,
 * fewer rooms are booked than there are workers.
 */
export class Schedule {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly capacity: Capacity,
    private readonly now = () => Date.now(),
  ) {}

  async book(booking: Booking): Promise<void> {
    const from = new Date(booking.startsAt);
    const to = new Date(booking.endsAt);
    const capacity = await this.capacity.workers();
    await this.bookings.exclusively(async () => {
      const taken = await this.bookings.overlapping(from, to);
      if (peakOverlap(taken, from, to) >= capacity) throw new SlotFullError();
      await this.bookings.insert(booking);
    });
  }

  cancel(roomId: string): Promise<void> {
    return this.bookings.delete(roomId);
  }

  /** Every half hour of the day starting at `from`: can a session of that length start then? */
  async availability(from: Date, durationMinutes: number): Promise<Availability> {
    const length = durationMinutes * MINUTE;
    const until = new Date(from.getTime() + SLOTS_PER_DAY * SLOT_MINUTES * MINUTE + length);
    const [capacity, taken] = await Promise.all([
      this.capacity.workers(),
      this.bookings.overlapping(from, until),
    ]);

    const slots = Array.from({ length: SLOTS_PER_DAY }, (_, i) => {
      const start = new Date(from.getTime() + i * SLOT_MINUTES * MINUTE);
      const end = new Date(start.getTime() + length);
      const free =
        start.getTime() >= this.now() - SLOT_MINUTES * MINUTE &&
        peakOverlap(taken, start, end) < capacity;
      return { startsAt: start.toISOString(), free };
    });
    return { slots };
  }
}

/** The most bookings running at the same moment within [from, to). */
export function peakOverlap(bookings: Booking[], from: Date, to: Date): number {
  // Sweep through every start and end inside the window, counting rooms running at once.
  const changes: [number, number][] = [];
  for (const booking of bookings) {
    const start = Math.max(Date.parse(booking.startsAt), from.getTime());
    const end = Math.min(Date.parse(booking.endsAt), to.getTime());
    if (start < end) changes.push([start, +1], [end, -1]);
  }
  // At the same instant, an end comes before a start: back-to-back slots don't overlap.
  changes.sort(([a, x], [b, y]) => a - b || x - y);
  let running = 0;
  let peak = 0;
  for (const [, change] of changes) peak = Math.max(peak, (running += change));
  return peak;
}
