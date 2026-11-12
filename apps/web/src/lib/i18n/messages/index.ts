import { en } from "./en";
import { th, type Messages } from "./th";

export const LANGUAGES = ["th", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "th";

export const CATALOGUE: Record<Language, Messages> = { th, en };
export type { Messages };

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}
