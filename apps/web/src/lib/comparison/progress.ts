/**
 * What the Compare page shows while the comparison is being computed, one request per site:
 * which columns to draw before the first answer arrives, the progress sentence, plain error
 * text for a failed row and when a failed request is worth repeating automatically.
 */
import { ApiError, describeError, SITE_COMPARISON_TIMEOUT_MS, type SiteComparison } from "@/lib/api/client";

export type CompareColumn = SiteComparison["columns"][number];

/**
 * The columns the API returns today, in order. They are used only to draw the header while the
 * first request is still running, so people can see what is being worked out. As soon as an
 * answer arrives its own `columns` replace these, so a column added to the API still appears.
 */
export const EXPECTED_COLUMNS: readonly Pick<CompareColumn, "key" | "unit">[] = [
  { key: "surface_height_m", unit: "m" },
  { key: "slope_at_site_deg", unit: "deg" },
  { key: "slope_p95_deg", unit: "deg" },
  { key: "roughness_rms_m", unit: "m" },
  { key: "horizon_min_deg", unit: "deg" },
  { key: "horizon_max_deg", unit: "deg" },
  { key: "horizon_truncated_azimuths", unit: "count" },
  { key: "sun_mean_visible_disk_fraction", unit: "fraction" },
  { key: "sun_illuminated_fraction", unit: "fraction" },
  { key: "sun_longest_hidden_s", unit: "s" },
  { key: "earth_visible_fraction", unit: "fraction" },
  { key: "earth_longest_outage_s", unit: "s" },
];

/** The columns of the first answer, or the expected ones while nothing has answered yet. */
export function columnsFor(first: SiteComparison | undefined): readonly CompareColumn[] {
  if (first) return first.columns;
  // Placeholders claim no direction: `better` comes only from the API's answer (T-18, D9).
  return EXPECTED_COLUMNS.map((c) => ({
    ...c,
    label: c.key,
    description: "",
    better: null,
    better_rationale: "",
  }));
}

export type RowStatus = "ready" | "pending" | "error";

/** A row is ready once it has data, failed once its request has given up, and pending otherwise. */
export function rowStatus(query: {
  data: unknown;
  /** This site's row in the answer, when the answer has one. */
  row: unknown;
  isFetching: boolean;
  isError: boolean;
}): RowStatus {
  // An answer without a row for this site cannot be shown, so it counts as a failure.
  if (query.data) return query.row ? "ready" : "error";
  // A retry (automatic or the Retry button) runs while the query still reports its old error.
  if (query.isFetching || !query.isError) return "pending";
  return "error";
}

export interface Progress {
  ready: number;
  failed: number;
  total: number;
}

export function countProgress(statuses: readonly RowStatus[]): Progress {
  return {
    ready: statuses.filter((s) => s === "ready").length,
    failed: statuses.filter((s) => s === "error").length,
    total: statuses.length,
  };
}

/** "Computing 2 of 3 sites. Usually 20 to 40 seconds the first time; saved results load instantly." */
export function progressMessage({ ready, failed, total }: Progress): string {
  const sites = total === 1 ? "site" : "sites";
  const failedNote = failed > 0 ? `, ${failed} failed` : "";
  return `Computing ${ready} of ${total} ${sites}${failedNote}. Usually 20 to 40 seconds the first time; saved results load instantly.`;
}

/** Plain sentence for a failed row, plus the technical message for a tooltip. */
export function describeRowError(error: unknown): { message: string; detail: string } {
  const detail = describeError(error);
  if (error instanceof ApiError) {
    if (error.kind === "timeout") {
      return {
        message: `Took longer than ${SITE_COMPARISON_TIMEOUT_MS / 1000} seconds. The server may be busy or still waking up.`,
        detail,
      };
    }
    if (error.kind === "network") return { message: "Could not reach the server.", detail };
  }
  return { message: detail, detail };
}

/**
 * Whether a failed comparison request should be repeated once automatically. A timeout is not
 * repeated, because that would double the wait before the Retry button appears. Neither is a
 * 4xx answer (unknown site, bad request): asking again gives the same answer.
 */
export function shouldRetryComparison(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (error instanceof ApiError) {
    if (error.kind === "timeout") return false;
    if (error.kind === "http" && error.status !== null && error.status >= 400 && error.status < 500) {
      return false;
    }
  }
  return true;
}
