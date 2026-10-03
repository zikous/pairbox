import type { Booking } from "@pairbox/shared";

export interface BookingRepository {
  /** Bookings that overlap [from, to). */
  overlapping(from: Date, to: Date): Promise<Booking[]>;
  insert(booking: Booking): Promise<void>;
  delete(roomId: string): Promise<void>;
  /** Runs `work` while no other booking can be made. */
  exclusively<T>(work: () => Promise<T>): Promise<T>;
}

/** How many workers exist, so how many rooms can run at once. */
export interface Capacity {
  workers(): Promise<number>;
}
