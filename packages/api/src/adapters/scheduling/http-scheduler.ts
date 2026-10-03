import type { Availability, Booking, RoomId, Runtime } from "@pairbox/shared";
import { internalHeaders } from "@pairbox/service";
import { SlotTakenError } from "../../application/errors";
import type { Scheduler } from "../../application/ports";

/** Talks to the scheduler service. */
export class HttpScheduler implements Scheduler {
  constructor(
    private readonly url: string,
    private readonly internalSecret: string,
  ) {}

  async book(booking: Booking): Promise<void> {
    const response = await this.call("POST", "/bookings", booking);
    if (response.status === 409) throw new SlotTakenError();
    await ok(response);
  }

  async cancel(roomId: RoomId): Promise<void> {
    await ok(await this.call("DELETE", `/bookings/${roomId}`));
  }

  async availability(runtime: Runtime, from: Date, durationMinutes: number): Promise<Availability> {
    const query = new URLSearchParams({
      runtime,
      from: from.toISOString(),
      durationMinutes: String(durationMinutes),
    });
    return (
      await ok(await this.call("GET", `/availability?${query}`))
    ).json() as Promise<Availability>;
  }

  private call(method: string, path: string, body?: unknown) {
    return fetch(`${this.url}${path}`, {
      method,
      headers: {
        ...internalHeaders(this.internalSecret),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : null,
    });
  }
}

async function ok(response: Response): Promise<Response> {
  if (!response.ok) throw new Error(`Scheduler answered ${response.status}`);
  return response;
}
