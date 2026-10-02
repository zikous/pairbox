import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { INTERNAL_AUTH_HEADER } from "@pairbox/shared";

/** Fastify hook that only lets other pairbox services through. */
export function requireInternal(secret: string) {
  const expected = Buffer.from(secret);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers[INTERNAL_AUTH_HEADER];
    const given = Buffer.from(typeof header === "string" ? header : "");
    const ok = given.length === expected.length && timingSafeEqual(given, expected);
    if (!ok) return reply.code(401).send({ error: "Not a pairbox service" });
  };
}
