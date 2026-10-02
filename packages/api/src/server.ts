import type { FastifyServerOptions } from "fastify";
import { RoomEvents } from "./application/events";
import type { Sandboxes } from "./application/ports";
import { RoomService } from "./application/rooms";
import { TerminalService } from "./application/terminals";
import { YjsCollaboration } from "./adapters/collaboration/yjs-collaboration";
import type { Database } from "./adapters/storage/database";
import { PostgresRoomRepository } from "./adapters/storage/postgres-rooms";
import { PostgresWorkspaceRepository } from "./adapters/storage/postgres-workspaces";
import { buildApp } from "./adapters/transport/app";

/** Composition root: picks an adapter for each port and wires the application together. */
export function createServer(options: {
  hostSecret: string;
  db: Database;
  sandboxes: Sandboxes;
  logger?: FastifyServerOptions["logger"];
}) {
  const { db, sandboxes, ...appOptions } = options;
  const collaboration = new YjsCollaboration(new PostgresWorkspaceRepository(db));
  const events = new RoomEvents();
  const terminals = new TerminalService(sandboxes, collaboration, events);
  const rooms = new RoomService(new PostgresRoomRepository(db), collaboration, terminals, events);

  return buildApp({ rooms, terminals, events, collaboration, ...appOptions });
}
