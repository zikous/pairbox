import type { FastifyRequest } from "fastify";
import {
  CLOSE_NOT_ADMITTED,
  CLOSE_SESSION_ENDED,
  roomPhase,
  type Participant,
} from "@pairbox/shared";
import type { AuthService } from "../../application/auth";
import type { Lobby } from "../../application/lobby";
import type { OwnedRoom } from "../../application/ports";
import { sessionToken } from "./session";

export type Access =
  | { allowed: true; owner: true }
  | { allowed: true; owner: false; participant: Participant }
  | { allowed: false; code: number; reason: string };

/**
 * Who may open a room's channels: its owner (signed in, from a few minutes before the start),
 * or a guest the owner let in (with their ticket, during the slot).
 */
export async function roomAccess(
  request: FastifyRequest,
  room: OwnedRoom,
  { auth, lobby }: { auth: AuthService; lobby: Lobby },
): Promise<Access> {
  const token = sessionToken(request);
  const user = token ? await auth.userFor(token) : undefined;
  const owner = user?.id === room.ownerId;

  const phase = roomPhase(room, { owner });
  if (phase === "ended")
    return { allowed: false, code: CLOSE_SESSION_ENDED, reason: "Session ended" };
  if (phase === "upcoming")
    return { allowed: false, code: CLOSE_NOT_ADMITTED, reason: "Not open yet" };
  if (owner) return { allowed: true, owner: true };

  const ticket = (request.query as { ticket?: string }).ticket;
  const participant = ticket ? lobby.guest(room.id, ticket) : undefined;
  if (!participant) return { allowed: false, code: CLOSE_NOT_ADMITTED, reason: "Not let in" };
  return { allowed: true, owner: false, participant };
}
