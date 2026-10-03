import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@pairbox/shared";
import type { AuthService } from "../../application/auth";

/** The cookie holding the session token. HttpOnly, so page scripts can never read it. */
const COOKIE = "pairbox_session";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by `requireUser` on routes that need a signed-in user. */
    user?: User;
  }
}

export function setSessionCookie(reply: FastifyReply, token: string, expires: Date): void {
  reply.setCookie(COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: reply.request.protocol === "https",
    expires,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE, { path: "/" });
}

export function sessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[COOKIE];
}

/** Fastify hook: rejects the request unless it carries a valid session cookie. */
export function requireUser(auth: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = sessionToken(request);
    const user = token ? await auth.userFor(token) : undefined;
    if (!user) return reply.code(401).send({ error: "Sign in first" });
    request.user = user;
  };
}

/** The user `requireUser` let through. */
export function signedInUser(request: FastifyRequest): User {
  if (!request.user) throw new Error("Route is missing the requireUser hook");
  return request.user;
}
