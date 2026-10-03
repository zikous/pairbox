import type { FastifyServerOptions } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { ShareInfoSchema } from "@pairbox/shared";
import { createService } from "@pairbox/service";
import type { AuthService } from "../../application/auth";
import type { RoomEvents } from "../../application/events";
import type { Lobby } from "../../application/lobby";
import type { Scheduler } from "../../application/ports";
import type { NoteService } from "../../application/notes";
import type { RecordingService } from "../../application/recordings";
import type { RoomService } from "../../application/rooms";
import type { SessionClock } from "../../application/session-clock";
import type { TerminalService } from "../../application/terminals";
import type { YjsCollaboration } from "../collaboration/yjs-collaboration";
import type { PublicAddress } from "../sharing/public-address";
import { authRoutes } from "./auth-routes";
import { errorHandler } from "./errors";
import { lobbyRoutes } from "./lobby-routes";
import { notesRoutes } from "./notes-routes";
import { recordingsRoutes } from "./recordings-routes";
import { roomSockets } from "./room-sockets";
import { roomsRoutes } from "./rooms-routes";

export interface AppDeps {
  auth: AuthService;
  rooms: RoomService;
  lobby: Lobby;
  clock: SessionClock;
  scheduler: Scheduler;
  recordings: RecordingService;
  notes: NoteService;
  terminals: TerminalService;
  events: RoomEvents;
  collaboration: YjsCollaboration;
  publicAddress: PublicAddress;
  logger?: FastifyServerOptions["logger"];
}

/** Builds the HTTP and WebSocket server. API docs are served at /docs. */
export async function buildApp({ logger, publicAddress, ...deps }: AppDeps) {
  const app = await createService({
    title: "pairbox api",
    description: [
      "Accounts, booked sessions (rooms), the lobby and recordings over HTTP.",
      "Each open room also has two WebSockets, for its owner and the guests they let in:",
      "",
      "- `/ws/rooms/{id}/sync`: the shared document and presence (Yjs, y-websocket protocol)",
      "- `/ws/rooms/{id}/session`: terminal and run controls (JSON, see `@pairbox/shared`)",
    ].join("\n"),
    logger,
    // Behind nginx (and maybe a tunnel): trust their X-Forwarded-* headers for IPs and https.
    trustProxy: true,
    sessionCookie: "pairbox_session",
  });
  app.setErrorHandler(errorHandler);
  await app.register(websocket, { options: { maxPayload: 1024 * 1024 } });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.get(
    "/api/share",
    {
      schema: {
        summary: "Where invite links should point",
        tags: ["meta"],
        response: { 200: ShareInfoSchema },
      },
    },
    () => publicAddress.get(),
  );
  await app.register(authRoutes, { prefix: "/api/auth", auth: deps.auth });
  await app.register(roomsRoutes, { prefix: "/api/rooms", ...deps });
  await app.register(lobbyRoutes, { prefix: "/api/rooms", ...deps });
  await app.register(recordingsRoutes, { prefix: "/api/rooms", ...deps });
  await app.register(notesRoutes, { prefix: "/api/rooms", ...deps });
  await app.register(roomSockets, { prefix: "/ws/rooms", ...deps });
  // Save what the open sessions recorded so far when shutting down.
  app.addHook("onClose", () => deps.recordings.pauseAll());

  return app;
}
