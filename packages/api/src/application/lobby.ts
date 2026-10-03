import type { JoinRequest, JoinStatus, Participant, RoomId } from "@pairbox/shared";
import type { RoomEvents } from "./events";

interface Request {
  participant: Participant;
  status: JoinStatus;
}

/**
 * Guests ask to join a room and wait; the owner lets them in or not. A guest who is let in
 * gets a ticket that opens the room's channels for the rest of the session.
 */
export class Lobby {
  private readonly requests = new Map<RoomId, Map<string, Request>>();
  private readonly tickets = new Map<string, { roomId: RoomId; participant: Participant }>();

  constructor(private readonly events: RoomEvents) {}

  ask(roomId: RoomId, participant: Participant): string {
    const id = crypto.randomUUID();
    const requests = this.requests.get(roomId) ?? new Map<string, Request>();
    requests.set(id, { participant, status: { status: "pending" } });
    this.requests.set(roomId, requests);
    this.announce(roomId);
    return id;
  }

  status(roomId: RoomId, requestId: string): JoinStatus | undefined {
    return this.requests.get(roomId)?.get(requestId)?.status;
  }

  /** Returns false when there is no such pending request. */
  decide(roomId: RoomId, requestId: string, admit: boolean): boolean {
    const request = this.requests.get(roomId)?.get(requestId);
    if (request?.status.status !== "pending") return false;
    if (admit) {
      const ticket = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
      this.tickets.set(ticket, { roomId, participant: request.participant });
      request.status = { status: "admitted", ticket };
    } else {
      request.status = { status: "denied" };
    }
    this.announce(roomId);
    return true;
  }

  pending(roomId: RoomId): JoinRequest[] {
    return [...(this.requests.get(roomId) ?? [])]
      .filter(([, request]) => request.status.status === "pending")
      .map(([id, request]) => ({ id, participant: request.participant }));
  }

  /** The guest a ticket belongs to, if it was issued for this room. */
  guest(roomId: RoomId, ticket: string): Participant | undefined {
    const entry = this.tickets.get(ticket);
    return entry?.roomId === roomId ? entry.participant : undefined;
  }

  /** Forgets the room's requests and tickets: the session is over. */
  close(roomId: RoomId): void {
    this.requests.delete(roomId);
    for (const [ticket, entry] of this.tickets)
      if (entry.roomId === roomId) this.tickets.delete(ticket);
  }

  private announce(roomId: RoomId): void {
    this.events.publish(roomId, { type: "join_requests", requests: this.pending(roomId) });
  }
}
