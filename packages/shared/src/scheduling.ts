import { z } from "zod";
import { RoomIdSchema } from "./room";

/** The scheduler's view of a booked room: when it needs a worker. */
export const BookingSchema = z
  .object({
    roomId: RoomIdSchema,
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "Booking" });
export type Booking = z.infer<typeof BookingSchema>;

/** Which start times can be booked, for a day and a duration. */
export const AvailabilitySchema = z
  .object({
    slots: z.array(z.object({ startsAt: z.iso.datetime({ offset: true }), free: z.boolean() })),
  })
  .meta({ id: "Availability" });
export type Availability = z.infer<typeof AvailabilitySchema>;

export const AvailabilityQuerySchema = z.object({
  /** First moment of the day, in the viewer's time zone. */
  from: z.iso.datetime({ offset: true }),
  durationMinutes: z.coerce.number().int().positive(),
});
