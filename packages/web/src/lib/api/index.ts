import { prefs } from "$lib/prefs.svelte";
import { createHttpRooms } from "./http-rooms";
import { joinRoom } from "./room-session";
import type { Api } from "./types";

export type * from "./types";

/** The server API: HTTP for rooms, WebSockets for live rooms. */
export const api: Api = {
  rooms: createHttpRooms({
    hostSecret: () => prefs.hostSecret,
    onUnauthorized: () => (prefs.hostSecret = ""),
  }),
  join: joinRoom,
};
