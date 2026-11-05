import type { CompareCell } from "@/lib/api/client";

const DAY_S = 86_400;

function grouped(n: number, digits: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Human-readable duration from seconds: h below two days, d above. */
export function formatDuration(s: number): string {
  if (s < 2 * DAY_S) return `${grouped(s / 3600, 1)} h`;
  return `${grouped(s / DAY_S, 1)} d`;
}

/**
 * Display string for a comparison cell value in its unit (m, deg, s, fraction, count).
 * Returns null for a null value: the caller shows the cell's `reason`, never 0.
 */
export function formatCellValue(cell: CompareCell): string | null {
  const v = cell.value;
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  switch (cell.unit) {
    case "m":
      return `${grouped(v, Math.abs(v) < 10 ? 2 : 0)} m`;
    case "deg":
      return `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}°`;
    case "fraction":
      return `${(v * 100).toFixed(1)} %`;
    case "s":
      return formatDuration(v);
    case "count":
      return grouped(v, 0);
    default:
      return `${v} ${cell.unit}`;
  }
}

/** "@ 40 m" for cells measured over a baseline (slope, roughness). */
export function formatBaseline(cell: CompareCell): string | null {
  return cell.baseline_m === null || cell.baseline_m === undefined
    ? null
    : `@ ${grouped(cell.baseline_m, 0)} m`;
}
