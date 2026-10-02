import type { RoomId, ServerMessage } from "@pairbox/shared";

/** Room events are exactly what the session socket sends to browsers. */
export type RoomEvent = ServerMessage;

type Listener = (event: RoomEvent) => void;

/** In-process pub/sub: everything that happens in a room, for whoever is connected to it. */
export class RoomEvents {
  private readonly listeners = new Map<RoomId, Set<Listener>>();

  subscribe(roomId: RoomId, listener: Listener): () => void {
    const set = this.listeners.get(roomId) ?? new Set();
    set.add(listener);
    this.listeners.set(roomId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(roomId);
    };
  }

  publish(roomId: RoomId, event: RoomEvent): void {
    for (const listener of this.listeners.get(roomId) ?? []) listener(event);
  }
}
