import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ErrorSchema, RoomIdSchema, SaveNotesSchema, SessionNotesSchema } from "@pairbox/shared";
import type { AuthService } from "../../application/auth";
import type { NoteService } from "../../application/notes";
import { requireUser, signedInUser } from "./session";

const params = z.object({ id: RoomIdSchema });
const denied = { 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema };

/**
 * A room owner's private notes, over plain HTTP: never on the room's sockets, so nobody else in
 * the room ever receives them.
 */
export const notesRoutes: FastifyPluginAsyncZod<{ notes: NoteService; auth: AuthService }> = async (
  app,
  { notes, auth },
) => {
  const onRequest = requireUser(auth);
  const common = { tags: ["notes"], security: [{ session: [] }], params };

  app.get(
    "/:id/notes",
    {
      onRequest,
      schema: {
        ...common,
        summary: "Your notes on a session",
        description: "One Markdown document. Empty until you first write in it.",
        response: { 200: SessionNotesSchema, ...denied },
      },
    },
    (request) => notes.get(signedInUser(request).id, request.params.id),
  );

  app.put(
    "/:id/notes",
    {
      onRequest,
      schema: {
        ...common,
        summary: "Save your notes on a session",
        body: SaveNotesSchema,
        response: { 200: SessionNotesSchema, 400: ErrorSchema, ...denied },
      },
    },
    (request) => notes.save(signedInUser(request).id, request.params.id, request.body.body),
  );
};
