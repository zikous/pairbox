import { z } from "zod";
import { RuntimeSchema } from "./runtime";
import { RoomIdSchema } from "./room";
import type { RunStatus } from "./run";

/** Header carrying the shared secret that services use to trust each other. */
export const INTERNAL_AUTH_HEADER = "x-pairbox-internal";

// Worker → pool

/** Body of `POST /workers`: a worker announcing itself. */
export const RegisterWorkerSchema = z
  .object({
    id: z.string().min(1).max(64),
    url: z.url(),
  })
  .meta({ id: "RegisterWorker" });
export type RegisterWorker = z.infer<typeof RegisterWorkerSchema>;

export const WorkerStateSchema = z.enum(["free", "reserved", "cleaning"]);
export type WorkerState = z.infer<typeof WorkerStateSchema>;

export const WorkerSchema = RegisterWorkerSchema.extend({
  state: WorkerStateSchema,
  roomId: RoomIdSchema.nullable(),
  lastSeen: z.string().meta({ format: "date-time" }),
}).meta({ id: "Worker" });
export type Worker = z.infer<typeof WorkerSchema>;

// api → pool

/** Body of `POST /reservations`: a room asking for a worker. */
export const ReserveSchema = z.object({ roomId: RoomIdSchema }).meta({ id: "Reserve" });
export type Reserve = z.infer<typeof ReserveSchema>;

/** A room's claim on a worker: either waiting in line or holding one. */
export const ReservationSchema = z
  .discriminatedUnion("status", [
    z.object({
      id: z.string(),
      roomId: RoomIdSchema,
      status: z.literal("queued"),
      /** 1 means next in line. */
      position: z.number().int().positive(),
    }),
    z.object({
      id: z.string(),
      roomId: RoomIdSchema,
      status: z.literal("reserved"),
      worker: z.object({ id: z.string(), url: z.url() }),
    }),
  ])
  .meta({ id: "Reservation" });
export type Reservation = z.infer<typeof ReservationSchema>;

// api ↔ worker: the terminal WebSocket at `/terminal`

/** Messages the api sends to a worker. */
export const WorkerCommandSchema = z.discriminatedUnion("type", [
  /** Keystrokes for the shell. */
  z.object({ type: z.literal("input"), data: z.string() }),
  z.object({
    type: z.literal("resize"),
    cols: z.number().int().min(2),
    rows: z.number().int().min(1),
  }),
  /** Saves the room's code into the workspace, in the file of its language. */
  z.object({ type: z.literal("write"), code: z.string(), runtime: RuntimeSchema }),
  /** Saves the code, then runs it in the shell. */
  z.object({ type: z.literal("run"), code: z.string(), runtime: RuntimeSchema }),
  /** Interrupts the running program (ctrl-c). */
  z.object({ type: z.literal("stop") }),
]);
export type WorkerCommand = z.infer<typeof WorkerCommandSchema>;

/** Messages a worker sends to the api. */
export type WorkerEvent = { type: "output"; data: string } | { type: "status"; status: RunStatus };
