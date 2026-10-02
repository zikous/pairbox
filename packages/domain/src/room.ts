export type RoomId = string;

export const LANGUAGES = {
  python: { label: "Python", file: "main.py" },
  javascript: { label: "JavaScript", file: "main.js" },
} as const;

export type Language = keyof typeof LANGUAGES;

export const isLanguage = (value: string): value is Language => Object.hasOwn(LANGUAGES, value);

export interface Room {
  id: RoomId;
  name: string;
  language: Language;
  createdAt: string;
}

export const ROOM_NAME_MAX = 60;

/** Trims and collapses whitespace. Returns null when the name is unusable. */
export function normalizeRoomName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= ROOM_NAME_MAX ? name : null;
}
