import type { CandidateSite } from "@lunaris/shared-types";

/** The cited site a first-time visitor sees selected: the best known of the demo sites. */
export const DEFAULT_SITE_NAME = "Peak near Shackleton";

/**
 * Which registered site to select when the page first has sites, so the first screen shows
 * computed numbers instead of "select a site".
 *
 * Only cited sites (`origin: "published"`, added from the catalogue) qualify: a site someone
 * typed in is not ours to choose for them. The preferred name wins, otherwise the first cited
 * site in the registry's order. Returns `null` when there is none.
 */
export function pickDefaultSite(sites: readonly CandidateSite[]): string | null {
  const cited = sites.filter((s) => s.origin === "published");
  const preferred = cited.find((s) => s.name.toLowerCase() === DEFAULT_SITE_NAME.toLowerCase());
  return (preferred ?? cited[0])?.id ?? null;
}
