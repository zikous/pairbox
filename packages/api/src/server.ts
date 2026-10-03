import type { FastifyServerOptions } from "fastify";
import { AuthService } from "./application/auth";
import { RoomEvents } from "./application/events";
import type { Sandboxes } from "./application/ports";
import { RoomService } from "./application/rooms";
import { TerminalService } from "./application/terminals";
import { YjsCollaboration } from "./adapters/collaboration/yjs-collaboration";
import { ScryptHasher } from "./adapters/security/scrypt-hasher";
import { PublicAddress } from "./adapters/sharing/public-address";
import type { Database } from "./adapters/storage/database";
import { PostgresRoomRepository } from "./adapters/storage/postgres-rooms";
import {
  PostgresSessionRepository,
  PostgresUserRepository,
} from "./adapters/storage/postgres-users";
import { PostgresWorkspaceRepository } from "./adapters/storage/postgres-workspaces";
import { buildApp } from "./adapters/transport/app";

/** Composition root: picks an adapter for each port and wires the application together. */
export function createServer(options: {
  db: Database;
  sandboxes: Sandboxes;
  publicUrl?: string | undefined;
  tunnelStatusUrl?: string | undefined;
  logger?: FastifyServerOptions["logger"];
}) {
  const { db, sandboxes, logger } = options;
  const collaboration = new YjsCollaboration(new PostgresWorkspaceRepository(db));
  const events = new RoomEvents();
  const terminals = new TerminalService(sandboxes, collaboration, events);

  return buildApp({
    auth: new AuthService(
      new PostgresUserRepository(db),
      new PostgresSessionRepository(db),
      new ScryptHasher(),
    ),
    rooms: new RoomService(new PostgresRoomRepository(db), collaboration, terminals, events),
    terminals,
    events,
    collaboration,
    publicAddress: new PublicAddress(options.publicUrl, options.tunnelStatusUrl),
    logger,
  });
}
