import type { Api } from "../types";
import { createFakeRooms } from "./rooms";
import { joinFakeRoom } from "./session";

export function createFakeApi(): Api {
  return { rooms: createFakeRooms(), join: joinFakeRoom };
}
