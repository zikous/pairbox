import { z } from "zod";

export const DISPLAY_NAME_MAX = 32;

export const ParticipantSchema = z.object({
  name: z.string().trim().min(1).max(DISPLAY_NAME_MAX),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export type Participant = z.infer<typeof ParticipantSchema>;

/** Trims and collapses whitespace. Returns null when the name is unusable. */
export function normalizeDisplayName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= DISPLAY_NAME_MAX ? name : null;
}
