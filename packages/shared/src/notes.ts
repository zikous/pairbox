import { z } from "zod";

export const NOTES_MAX = 50_000;

/**
 * Body of `GET /api/rooms/:id/notes`: the session owner's private notes, one Markdown document
 * per session. Nobody else can see it.
 */
export const SessionNotesSchema = z
  .object({
    body: z.string(),
    /** Null until the first save. */
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .meta({ id: "SessionNotes" });
export type SessionNotes = z.infer<typeof SessionNotesSchema>;

/** Body of `PUT /api/rooms/:id/notes`: the whole document. */
export const SaveNotesSchema = z
  .object({ body: z.string().max(NOTES_MAX) })
  .meta({ id: "SaveNotes" });
export type SaveNotes = z.infer<typeof SaveNotesSchema>;
