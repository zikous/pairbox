import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { CredentialsSchema, ErrorSchema, UserSchema } from "@pairbox/shared";
import type { AuthService } from "../../application/auth";
import {
  clearSessionCookie,
  requireUser,
  sessionToken,
  setSessionCookie,
  signedInUser,
} from "./session";

/** Slows down password guessing: a few attempts per minute per address. */
const rateLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };

export const authRoutes: FastifyPluginAsyncZod<{ auth: AuthService }> = async (app, { auth }) => {
  app.post(
    "/signup",
    {
      config: rateLimit,
      schema: {
        summary: "Create an account and sign in",
        tags: ["auth"],
        body: CredentialsSchema,
        response: { 201: UserSchema, 400: ErrorSchema, 409: ErrorSchema },
      },
    },
    async (request, reply) => {
      const { user, token, expiresAt } = await auth.signUp(request.body);
      setSessionCookie(reply, token, expiresAt);
      return reply.code(201).send(user);
    },
  );

  app.post(
    "/login",
    {
      config: rateLimit,
      schema: {
        summary: "Sign in",
        tags: ["auth"],
        body: CredentialsSchema,
        response: { 200: UserSchema, 401: ErrorSchema },
      },
    },
    async (request, reply) => {
      const { user, token, expiresAt } = await auth.signIn(request.body);
      setSessionCookie(reply, token, expiresAt);
      return user;
    },
  );

  app.post(
    "/logout",
    { schema: { summary: "Sign out", tags: ["auth"], response: { 204: z.null() } } },
    async (request, reply) => {
      const token = sessionToken(request);
      if (token) await auth.signOut(token);
      clearSessionCookie(reply);
      return reply.code(204).send(null);
    },
  );

  app.get(
    "/me",
    {
      onRequest: requireUser(auth),
      schema: {
        summary: "The signed-in user",
        tags: ["auth"],
        response: { 200: UserSchema, 401: ErrorSchema },
      },
    },
    (request) => signedInUser(request),
  );
};
