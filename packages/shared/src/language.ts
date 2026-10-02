import { z } from "zod";

export const LANGUAGES = {
  python: { label: "Python", file: "main.py" },
  javascript: { label: "JavaScript", file: "main.js" },
} as const;

export type Language = keyof typeof LANGUAGES;

export const LanguageSchema = z.enum(Object.keys(LANGUAGES) as [Language, ...Language[]]);

export const isLanguage = (value: string): value is Language => Object.hasOwn(LANGUAGES, value);
