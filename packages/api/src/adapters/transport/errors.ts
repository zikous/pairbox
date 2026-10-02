import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { InvalidInputError, RoomNotFoundError } from "../../application/errors";

/** Turns application errors into HTTP responses with an `{ error }` body. */
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.code(400).send({ error: error.message });
  }
  if (error instanceof RoomNotFoundError) return reply.code(404).send({ error: error.message });
  if (error instanceof InvalidInputError) return reply.code(400).send({ error: error.message });

  request.log.error(error);
  return reply.code(500).send({ error: "Internal server error" });
}
