/**
 * T-19 terrain page data: GET /api/v1/sites/{id}/terrain (T-14), plus adapters that turn
 * each value into a CompareCell so it opens the shared evidence popover.
 *
 * Kept inside the page folder (S-TERRAIN owns `app/terrain/**`; the shared client is
 * S-WEB's). Cold requests read a PGDA window over HTTP and can take ~15 s, so the timeout
 * is longer than the client default.
 */
import type { components } from "@lunaris/shared-types";

import type { CompareCell } from "@/lib/api/client";
import { config } from "@/lib/config";

export type SiteTerrain = components["schemas"]["SiteTerrainResponse"];
type Evidence = components["schemas"]["EvidenceSchema"];

export const TERRAIN_TIMEOUT_MS = 60_000;
export const DEFAULT_FOOTPRINT_RADIUS_M = 50;

export interface TerrainQuery {
  siteId: string;
  footprintRadiusM: number;
  maxSlopeDeg: number | null;
  maxRoughnessM: number | null;
}

export class TerrainRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "TerrainRequestError";
  }
}

export function terrainUrl(q: TerrainQuery, baseUrl: string = config.apiBaseUrl): string {
  const params = new URLSearchParams({ footprint_radius_m: String(q.footprintRadiusM) });
  if (q.maxSlopeDeg !== null) params.set("max_slope_deg", String(q.maxSlopeDeg));
  if (q.maxRoughnessM !== null) params.set("max_roughness_m", String(q.maxRoughnessM));
  return `${baseUrl}/api/v1/sites/${encodeURIComponent(q.siteId)}/terrain?${params.toString()}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Shallow shape check: a wrong server or a stale contract fails loudly. */
export function isSiteTerrain(v: unknown): v is SiteTerrain {
  if (!isRecord(v)) return false;
  const fp = v.footprint;
  const slope = v.slope_at_site;
  const dem = v.dem;
  const ev = v.evidence;
  return (
    typeof v.site_id === "string" &&
    typeof v.height_m === "number" &&
    isRecord(slope) &&
    typeof slope.baseline_m === "number" &&
    isRecord(fp) &&
    typeof fp.roughness_baseline_m === "number" &&
    typeof fp.missing_cell_count === "number" &&
    isRecord(dem) &&
    typeof dem.url === "string" &&
    isRecord(ev) &&
    Array.isArray(ev.sources) &&
    Array.isArray(v.limitations)
  );
}

export async function fetchSiteTerrain(q: TerrainQuery, signal?: AbortSignal): Promise<SiteTerrain> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TERRAIN_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  let response: Response;
  try {
    response = await fetch(terrainUrl(q), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new TerrainRequestError(
      controller.signal.aborted
        ? `The terrain analysis did not answer within ${TERRAIN_TIMEOUT_MS / 1000} s.`
        : `LUNARIS API unreachable at ${config.apiBaseUrl}.`,
      null,
      null,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const err = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
    throw new TerrainRequestError(
      typeof err?.message === "string" ? err.message : `HTTP ${response.status}`,
      response.status,
      typeof err?.code === "string" ? err.code : null,
    );
  }
  if (!isSiteTerrain(payload)) {
    throw new TerrainRequestError("Unexpected response shape from /terrain.", response.status, null);
  }
  return payload;
}

/** Window provenance lines for the evidence popover (URL, validators, bytes, cache). */
export function windowProvenance(t: SiteTerrain): string[] {
  const d = t.dem;
  const [col, row, w, h] = d.window_col_row_width_height;
  return [
    `DEM window: ${d.url} — columns ${col}–${col + w - 1}, rows ${row}–${row + h - 1} at ${d.resolution_m} m.`,
    `HTTP validators: ETag ${d.etag ?? "none"}; Last-Modified ${d.last_modified ?? "none"}.`,
    `Transfer: ${d.bytes_requested.toLocaleString("en-US")} bytes requested, ${d.http_retries} retried request(s); ${
      d.served_from_cache ? "served from the local window cache" : "read remotely"
    } (${d.read_at_utc}).`,
  ];
}

function cell(
  t: SiteTerrain,
  value: number | null,
  unit: string,
  baselineM: number | null,
  reason: string,
): CompareCell {
  return {
    value,
    unit,
    baseline_m: baselineM,
    reason: value === null ? reason : null,
    evidence: t.evidence as Evidence,
    limitations: [...windowProvenance(t), ...t.limitations],
  };
}

export interface TerrainCells {
  height: CompareCell;
  slopeAtSite: CompareCell;
  slopeP95: CompareCell;
  slopeMean: CompareCell;
  slopeMax: CompareCell;
  roughness: CompareCell;
  missingCells: CompareCell;
}

/** Every number on the page as a CompareCell; a null value carries its reason, never 0. */
export function terrainCells(t: SiteTerrain): TerrainCells {
  const fp = t.footprint;
  const noValue = "the DEM has no value next to the site";
  return {
    height: cell(t, t.height_m, "m", null, noValue),
    slopeAtSite: cell(t, t.slope_at_site.slope_deg, "deg", t.slope_at_site.baseline_m, noValue),
    slopeP95: cell(t, fp.slope_p95_deg, "deg", fp.slope_baseline_m, noValue),
    slopeMean: cell(t, fp.slope_mean_deg, "deg", fp.slope_baseline_m, noValue),
    slopeMax: cell(t, fp.slope_max_deg, "deg", fp.slope_baseline_m, noValue),
    roughness: cell(t, fp.roughness_rms_m, "m", fp.roughness_baseline_m, noValue),
    missingCells: cell(t, fp.missing_cell_count, "count", null, noValue),
  };
}

/** Parse an optional positive threshold input; "" means "not set". */
export function parseThreshold(raw: string, max?: number): number | null | "invalid" {
  const s = raw.trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || (max !== undefined && n >= max)) return "invalid";
  return n;
}
