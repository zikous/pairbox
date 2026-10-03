import type { FastifyServerOptions } from "fastify";
import { AuthService } from "./application/auth";
import { RoomEvents } from "./application/events";
import { Lobby } from "./application/lobby";
import type { RecordingStore, Sandboxes, Scheduler } from "./application/ports";
import { NoteService } from "./application/notes";
import { RecordingService } from "./application/recordings";
import { RoomService } from "./application/rooms";
import { SessionClock } from "./application/session-clock";
import { TerminalService } from "./application/terminals";
import { YjsCollaboration } from "./adapters/collaboration/yjs-collaboration";
import { ScryptHasher } from "./adapters/security/scrypt-hasher";
import { PublicAddress } from "./adapters/sharing/public-address";
import type { Database } from "./adapters/storage/database";
import { PostgresRecordingRepository } from "./adapters/storage/postgres-recordings";
import { PostgresNoteRepository } from "./adapters/storage/postgres-notes";
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
  scheduler: Scheduler;
  recordingStore: RecordingStore;
  publicUrl?: string | undefined;
  tunnelStatusUrl?: string | undefined;
  logger?: FastifyServerOptions["logger"];
}) {
  const { db, sandboxes, scheduler, recordingStore, logger } = options;
  const events = new RoomEvents();
  const workspaces = new PostgresWorkspaceRepository(db);
  const rooms = new PostgresRoomRepository(db);
  const recordings = new RecordingService(
    new PostgresRecordingRepository(db),
    recordingStore,
    workspaces,
    rooms,
    events,
  );
  const collaboration = new YjsCollaboration(workspaces, recordings);
  const terminals = new TerminalService(sandboxes, collaboration, events);
  const lobby = new Lobby(events);
  const clock = new SessionClock(events, lobby, terminals, collaboration, recordings);

  const roomService = new RoomService(
    rooms,
    scheduler,
    collaboration,
    terminals,
    recordings,
    clock,
    events,
  );

  return buildApp({
    auth: new AuthService(
      new PostgresUserRepository(db),
      new PostgresSessionRepository(db),
      new ScryptHasher(),
    ),
    rooms: roomService,
    notes: new NoteService(new PostgresNoteRepository(db), roomService),
    lobby,
    clock,
    scheduler,
    recordings,
    terminals,
    events,
    collaboration,
    publicAddress: new PublicAddress(options.publicUrl, options.tunnelStatusUrl),
    logger,
  });
}
