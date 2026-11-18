import type { Language } from "@/lib/i18n";

/** `2027-01-07T20:00:00Z` → `7 ม.ค. 2570` (Thai, Buddhist year) or `7 Jan 2027`, read in UTC. */
export function formatUtcDate(iso: string, lang: Language): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH-u-ca-buddhist" : "en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(ms);
}

export const SECONDS_PER_DAY = 86_400;

/** Seconds to days. A change of unit only; the value is the pack's. */
export const secondsToDays = (s: number): number => s / SECONDS_PER_DAY;

/** `0.713…` → `71.3` (a 0–1 score shown out of 100). */
export const points = (score: number): string => (score * 100).toFixed(1);
