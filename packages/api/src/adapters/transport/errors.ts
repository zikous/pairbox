import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import {
  EmailTakenError,
  InvalidCredentialsError,
  InvalidInputError,
  NotRoomOwnerError,
  RoomNotFoundError,
} from "../../application/errors";

const STATUS = new Map<new (...args: never[]) => Error, number>([
  [InvalidInputError, 400],
  [InvalidCredentialsError, 401],
  [NotRoomOwnerError, 403],
  [RoomNotFoundError, 404],
  [EmailTakenError, 409],
]);

/** Turns errors into HTTP responses with an `{ error }` body. */
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.code(400).send({ error: error.message });
  }
  const status = STATUS.get(error.constructor as new () => Error) ?? error.statusCode;
  // Application errors, and client errors raised by plugins (like 429 from rate limiting).
  if (status && status < 500) return reply.code(status).send({ error: error.message });

  request.log.error(error);
  return reply.code(500).send({ error: "Internal server error" });
}
