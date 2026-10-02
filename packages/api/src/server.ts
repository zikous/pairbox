import type { FastifyServerOptions } from "fastify";
import { RoomEvents } from "./application/events";
import type { Sandboxes } from "./application/ports";
import { RoomService } from "./application/rooms";
import { TerminalService } from "./application/terminals";
import { YjsCollaboration } from "./adapters/collaboration/yjs-collaboration";
import { PublicAddress } from "./adapters/sharing/public-address";
import type { Database } from "./adapters/storage/database";
import { PostgresRoomRepository } from "./adapters/storage/postgres-rooms";
import { PostgresWorkspaceRepository } from "./adapters/storage/postgres-workspaces";
import { buildApp } from "./adapters/transport/app";

/** Composition root: picks an adapter for each port and wires the application together. */
export function createServer(options: {
  hostSecret: string;
  db: Database;
  sandboxes: Sandboxes;
  publicUrl?: string | undefined;
  tunnelStatusUrl?: string | undefined;
  logger?: FastifyServerOptions["logger"];
}) {
  const { db, sandboxes, publicUrl, tunnelStatusUrl, ...appOptions } = options;
  const publicAddress = new PublicAddress(publicUrl, tunnelStatusUrl);
  const collaboration = new YjsCollaboration(new PostgresWorkspaceRepository(db));
  const events = new RoomEvents();
  const terminals = new TerminalService(sandboxes, collaboration, events);
  const rooms = new RoomService(new PostgresRoomRepository(db), collaboration, terminals, events);

  return buildApp({ rooms, terminals, events, collaboration, publicAddress, ...appOptions });
}
