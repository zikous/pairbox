import { httpAuth, httpRecordings, httpRooms } from "./http";
import { joinRoom } from "./room-session";
import type { Api } from "./types";

export type * from "./types";
export { HttpError, sessionEnded } from "./http";

/** The server API: HTTP for accounts and rooms, WebSockets for live rooms. */
export const api: Api = {
  auth: httpAuth,
  rooms: httpRooms,
  recordings: httpRecordings,
  join: joinRoom,
};
