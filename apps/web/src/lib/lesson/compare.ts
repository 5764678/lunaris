import type { CompareCell, SiteComparison } from "./types";

/** The four packed comparisons and the mission answers each stands for. */
export const VARIANTS = ["default", "power-critical", "comms-critical", "landing-critical"] as const;
export type Variant = (typeof VARIANTS)[number];

export type Role = "geologist" | "power" | "comms";

/** Table columns by team role (lesson plan 5): what each role reads from the comparison. */
export const ROLE_METRICS: Readonly<Record<Role, readonly string[]>> = {
  geologist: ["slope_at_site_deg", "slope_p95_deg", "roughness_rms_m"],
  power: ["sun_illuminated_fraction", "sun_longest_hidden_s", "sun_longest_visible_s"],
  comms: ["earth_visible_fraction", "earth_longest_outage_s"],
};

export const ROLES = Object.keys(ROLE_METRICS) as Role[];
const SHOWN = new Set(Object.values(ROLE_METRICS).flat());

/** Metrics folded away: everything else the comparison carries. */
export function otherMetrics(comparison: SiteComparison): string[] {
  return comparison.columns.map((c) => c.key).filter((k) => !SHOWN.has(k));
}

export type SiteRow = SiteComparison["rows"][number];

/** A comparison cell by metric key; undefined when the row has no such column. */
export function cellOf(row: SiteRow, key: string): CompareCell | undefined {
  const value = (row as unknown as Record<string, unknown>)[key];
  return typeof value === "object" && value !== null && "evidence" in value
    ? (value as CompareCell)
    : undefined;
}

export type PriorityId = "none" | "low" | "medium" | "high";
export const isPriority = (v: unknown): v is PriorityId =>
  v === "none" || v === "low" || v === "medium" || v === "high";

/** Score on the API's 0–1 scale shown as "71.3/100". */
export const outOf100 = (score: number): string => `${(score * 100).toFixed(1)}/100`;
