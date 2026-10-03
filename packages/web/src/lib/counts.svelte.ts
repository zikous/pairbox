import type { RoomCounts } from "@pairbox/shared";
import { api } from "$lib/api";

let counts = $state<RoomCounts>();

/** How many sessions are live, upcoming and past, for the sidebar's badges. */
export const sessionCounts = {
  get current() {
    return counts;
  },
  /** Badges are a hint: if this fails, they stay as they were. */
  async refresh() {
    counts = await api.rooms.counts().catch(() => counts);
  },
};
