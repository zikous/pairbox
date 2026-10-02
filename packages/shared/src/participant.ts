export interface Participant {
  name: string;
  color: string;
}

export const DISPLAY_NAME_MAX = 32;

/** Trims and collapses whitespace. Returns null when the name is unusable. */
export function normalizeDisplayName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= DISPLAY_NAME_MAX ? name : null;
}
