import type { FastifyServerOptions } from "fastify";
import { RoomEvents } from "./application/events";
import { RoomService } from "./application/rooms";
import { TerminalService } from "./application/terminals";
import { YjsCollaboration } from "./adapters/collaboration/yjs-collaboration";
import { FakeSandbox } from "./adapters/sandbox/fake-sandbox";
import { MemoryRoomRepository } from "./adapters/storage/memory-rooms";
import { buildApp } from "./adapters/transport/app";

/** Composition root: picks an adapter for each port and wires the application together. */
export function createServer(options: {
  hostSecret: string;
  logger?: FastifyServerOptions["logger"];
}) {
  const repository = new MemoryRoomRepository();
  const collaboration = new YjsCollaboration();
  const events = new RoomEvents();
  const terminals = new TerminalService(new FakeSandbox(), repository, collaboration, events);
  const rooms = new RoomService(repository, collaboration, terminals, events);

  return buildApp({ rooms, terminals, events, collaboration, ...options });
}
