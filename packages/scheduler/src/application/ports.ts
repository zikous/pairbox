import type { Booking, Runtime } from "@pairbox/shared";

export interface BookingRepository {
  /** Bookings for the runtime that overlap [from, to). */
  overlapping(runtime: Runtime, from: Date, to: Date): Promise<Booking[]>;
  insert(booking: Booking): Promise<void>;
  delete(roomId: string): Promise<void>;
  /** Runs `work` while no other booking for this runtime can be made. */
  exclusively<T>(runtime: Runtime, work: () => Promise<T>): Promise<T>;
}

/** How many workers of a runtime exist, so how many rooms can run at once. */
export interface Capacity {
  of(runtime: Runtime): Promise<number>;
}
