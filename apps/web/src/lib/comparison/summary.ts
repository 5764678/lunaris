/**
 * Helpers for the T-18 comparison summary: plain labels for column keys, the column leaders as a
 * lookup for the table, and the header note for a column's ranking direction.
 */
import type { ComparisonSummary } from "@/lib/api/client";

import { metricCopy } from "./labels";
import type { CompareColumn } from "./progress";

/** The page's plain label for a column key; the key itself when the column is unknown. */
export function leaderLabel(key: string, columns: readonly CompareColumn[]): string {
  const column = columns.find((c) => c.key === key);
  return column ? metricCopy(key, column.label, column.description).label : key;
}

export interface Leader {
  siteIds: ReadonlySet<string>;
  tied: boolean;
}

/**
 * Column key → the sites that lead it. Only columns where at least two sites have a value and a
 * leading value exists: one value alone leads nothing.
 */
export function leadersByColumn(summary: ComparisonSummary | null | undefined): ReadonlyMap<string, Leader> {
  const map = new Map<string, Leader>();
  for (const l of summary?.leaders ?? []) {
    if (l.value === null || l.compared_sites < 2 || l.site_ids.length === 0) continue;
    map.set(l.key, { siteIds: new Set(l.site_ids), tied: l.site_ids.length > 1 });
  }
  return map;
}

/** Header note for a column's ranking direction. */
export function directionNote(column: Pick<CompareColumn, "better">): string {
  if (column.better === "higher") return "↑ higher is better";
  if (column.better === "lower") return "↓ lower is better";
  return "not ranked";
}
