import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

/** Fastify hook that only lets requests carrying `Authorization: Bearer <host secret>` through. */
export function requireHost(secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const given = Buffer.from(request.headers.authorization ?? "");
    const ok = given.length === expected.length && timingSafeEqual(given, expected);
    if (!ok) return reply.code(401).send({ error: "Missing or wrong host secret" });
  };
}
