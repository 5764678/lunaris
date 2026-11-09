/**
 * Pure view model for the Illumination & Earth visibility page (T-27).
 *
 * Every number shown comes from the API: the T-16 horizon mask
 * (`GET /api/v1/sites/{id}/horizon`) or the T-24 timeline (`POST /api/v1/analysis/timeline`).
 * Values are wrapped as `CompareCell`s so they open the same evidence popover as /compare.
 * A value that is not served (no terrain mask) is null with its reason — never 0.
 */
import type { Evidence, components } from "@lunaris/shared-types";

import type { CompareCell, TimelineAnalysis } from "@/lib/api/client";

export type HorizonMask = components["schemas"]["HorizonMaskResponse"];
export type VisibilityWindow = components["schemas"]["VisibilityWindow"];
export type IlluminationSummary = components["schemas"]["IlluminationSummary"];
export type EarthVisibilitySummary = components["schemas"]["EarthVisibilitySummary"];
export type HorizonKind = "astronomical" | "terrain";

export const CENSORED_NOTE =
  "The run touches the edge of the analysis window, so its duration is a lower bound (≥).";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isNumberArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x));

/** Shape check for the T-16 horizon response, down to the arrays the chart draws. */
export function isHorizonMask(v: unknown): v is HorizonMask {
  if (!isObject(v)) return false;
  const { azimuth_deg: az, elevation_deg: el, truncated, evidence } = v;
  return (
    typeof v.site_id === "string" &&
    isNumberArray(az) &&
    isNumberArray(el) &&
    Array.isArray(truncated) &&
    truncated.every((t) => typeof t === "boolean") &&
    az.length > 0 &&
    az.length === el.length &&
    az.length === truncated.length &&
    isObject(evidence) &&
    typeof evidence.kind === "string" &&
    typeof evidence.statement === "string" &&
    Array.isArray(v.limitations)
  );
}

export interface HorizonProfile {
  /** Closed profile (first azimuth repeated at 360°) so the filled skyline has no gap. */
  azimuthDeg: number[];
  elevationDeg: number[];
  /** Azimuths whose ray left DEM coverage: the elevation there is only a lower bound. */
  lowerBound: { azimuthDeg: number[]; elevationDeg: number[] };
  truncatedCount: number;
  size: number;
}

export function horizonProfile(mask: HorizonMask): HorizonProfile {
  const az = [...mask.azimuth_deg];
  const el = [...mask.elevation_deg];
  if (az[0] === 0) {
    az.push(360);
    el.push(el[0]!);
  }
  const lowerBound = { azimuthDeg: [] as number[], elevationDeg: [] as number[] };
  mask.truncated.forEach((t, i) => {
    if (t) {
      lowerBound.azimuthDeg.push(mask.azimuth_deg[i]!);
      lowerBound.elevationDeg.push(mask.elevation_deg[i]!);
    }
  });
  return {
    azimuthDeg: az,
    elevationDeg: el,
    lowerBound,
    truncatedCount: lowerBound.azimuthDeg.length,
    size: mask.azimuth_deg.length,
  };
}

export interface BodyTrack {
  body: "sun" | "earth";
  epochsMs: number[];
  azimuthDeg: number[];
  elevationDeg: number[];
  /** Apparent angular radius: the track is drawn as centre ± radius (the disk's height). */
  radiusDeg: number[];
}

export function bodyTracks(analysis: TimelineAnalysis): { sun: BodyTrack; earth: BodyTrack } {
  const sun = analysis.illumination.samples;
  const earth = analysis.earth_visibility.samples;
  return {
    sun: {
      body: "sun",
      epochsMs: sun.map((s) => Date.parse(s.epoch_utc)),
      azimuthDeg: sun.map((s) => s.azimuth_deg),
      elevationDeg: sun.map((s) => s.elevation_deg),
      radiusDeg: sun.map((s) => s.solar_radius_deg),
    },
    earth: {
      body: "earth",
      epochsMs: earth.map((s) => Date.parse(s.epoch_utc)),
      azimuthDeg: earth.map((s) => s.azimuth_deg),
      elevationDeg: earth.map((s) => s.elevation_deg),
      radiusDeg: earth.map((s) => s.earth_radius_deg),
    },
  };
}

/** Elevation range covering the skyline and both disks, padded, at least 4° tall. */
export function chartRange(profile: HorizonProfile | null, tracks: BodyTrack[]): [number, number] {
  const lows: number[] = [0];
  const highs: number[] = [0];
  if (profile) {
    lows.push(Math.min(...profile.elevationDeg));
    highs.push(Math.max(...profile.elevationDeg));
  }
  for (const t of tracks) {
    t.elevationDeg.forEach((e, i) => {
      lows.push(e - t.radiusDeg[i]!);
      highs.push(e + t.radiusDeg[i]!);
    });
  }
  let lo = Math.min(...lows);
  let hi = Math.max(...highs);
  const pad = Math.max(0.5, (hi - lo) * 0.08);
  lo -= pad;
  hi += pad;
  if (hi - lo < 4) {
    const mid = (hi + lo) / 2;
    lo = mid - 2;
    hi = mid + 2;
  }
  return [lo, hi];
}

// ── Cells (values that open their evidence) ────────────────────────────────

export interface Cell {
  cell: CompareCell;
  /** The value is a lower bound (censored run, or a maximum over truncated azimuths). */
  lowerBound: boolean;
}

function cell(
  value: number | null,
  unit: string,
  evidence: Evidence | null,
  limitations: readonly string[],
  reason?: string,
): CompareCell {
  return {
    value,
    unit,
    baseline_m: null,
    reason: value === null ? (reason ?? "not computed") : null,
    evidence,
    limitations: [...limitations],
  };
}

export const TERRAIN_UNAVAILABLE = "terrain horizon not available for this site";

export interface SummaryRow {
  key: string;
  label: string;
  meaning: string;
  astronomical: Cell;
  terrain: Cell;
}

interface Measure<S> {
  key: string;
  label: string;
  meaning: string;
  unit: string;
  value: (s: S) => number;
  censored?: (s: S) => boolean;
}

function rows<S>(
  measures: Measure<S>[],
  astronomical: S,
  terrain: S | null,
  evidence: Evidence,
  limitations: readonly string[],
  terrainReason: string,
): SummaryRow[] {
  const make = (m: Measure<S>, s: S | null): Cell => {
    if (s === null) return { cell: cell(null, m.unit, null, limitations, terrainReason), lowerBound: false };
    const censored = m.censored?.(s) ?? false;
    return {
      cell: cell(m.value(s), m.unit, evidence, censored ? [CENSORED_NOTE, ...limitations] : limitations),
      lowerBound: censored,
    };
  };
  return measures.map((m) => ({
    key: m.key,
    label: m.label,
    meaning: m.meaning,
    astronomical: make(m, astronomical),
    terrain: make(m, terrain),
  }));
}

const SUN_MEASURES: Measure<IlluminationSummary>[] = [
  {
    key: "mean_visible_disk_fraction",
    label: "Mean visible solar disk",
    meaning:
      "Time average of how much of the Sun's disk is above the horizon. This is the number comparable to published average polar illumination.",
    unit: "fraction",
    value: (s) => s.mean_visible_disk_fraction,
  },
  {
    key: "illuminated_fraction",
    label: "Time with any sunlight",
    meaning: "Share of samples with any part of the Sun's disk above the horizon.",
    unit: "fraction",
    value: (s) => s.illuminated_fraction,
  },
  {
    key: "fully_lit_fraction",
    label: "Time fully lit",
    meaning: "Share of samples with the whole of the Sun's disk above the horizon.",
    unit: "fraction",
    value: (s) => s.fully_lit_fraction,
  },
  {
    key: "longest_illumination_s",
    label: "Longest sunlit run",
    meaning: "Longest unbroken run of samples with any sunlight, each sample standing for one step.",
    unit: "s",
    value: (s) => s.longest_illumination_s,
    censored: (s) => s.longest_illumination_censored,
  },
  {
    key: "longest_darkness_s",
    label: "Longest darkness",
    meaning: "Longest unbroken run of samples with the whole Sun below the horizon.",
    unit: "s",
    value: (s) => s.longest_darkness_s,
    censored: (s) => s.longest_darkness_censored,
  },
];

const EARTH_MEASURES: Measure<EarthVisibilitySummary>[] = [
  {
    key: "visible_fraction",
    label: "Time Earth in view",
    meaning:
      "Share of samples with any part of the Earth's disk above the horizon (geometric line of sight).",
    unit: "fraction",
    value: (s) => s.visible_fraction,
  },
  {
    key: "mean_visible_disk_fraction",
    label: "Mean visible Earth disk",
    meaning: "Time average of how much of the Earth's disk is above the horizon.",
    unit: "fraction",
    value: (s) => s.mean_visible_disk_fraction,
  },
  {
    key: "longest_visibility_s",
    label: "Longest Earth view",
    meaning: "Longest unbroken run of samples with any part of the Earth in view.",
    unit: "s",
    value: (s) => s.longest_visibility_s,
    censored: (s) => s.longest_visibility_censored,
  },
  {
    key: "longest_outage_s",
    label: "Longest Earth outage",
    meaning: "Longest unbroken run of samples with the whole Earth below the horizon.",
    unit: "s",
    value: (s) => s.longest_outage_s,
    censored: (s) => s.longest_outage_censored,
  },
];

export function terrainReason(analysis: TimelineAnalysis): string {
  return analysis.terrain_horizon_available ? "terrain summary not served" : TERRAIN_UNAVAILABLE;
}

export function sunRows(analysis: TimelineAnalysis): SummaryRow[] {
  const r = analysis.illumination;
  return rows(
    SUN_MEASURES,
    r.astronomical,
    r.terrain ?? null,
    r.evidence,
    r.limitations,
    terrainReason(analysis),
  );
}

export function earthRows(analysis: TimelineAnalysis): SummaryRow[] {
  const r = analysis.earth_visibility;
  return rows(
    EARTH_MEASURES,
    r.astronomical,
    r.terrain ?? null,
    r.evidence,
    r.limitations,
    terrainReason(analysis),
  );
}

/** Highest skyline elevation in the served mask; a lower bound when any azimuth is truncated. */
export function horizonMaxCell(mask: HorizonMask): Cell {
  const max = Math.max(...mask.elevation_deg);
  const truncated = mask.truncated.some(Boolean);
  const limits = truncated
    ? [
        "Some azimuths left DEM coverage; their elevation is a lower bound, so this maximum is too.",
        ...mask.limitations,
      ]
    : mask.limitations;
  return { cell: cell(max, "deg", mask.evidence, limits), lowerBound: truncated };
}

export function horizonTruncatedCell(mask: HorizonMask): Cell {
  return { cell: cell(mask.truncated_count, "count", mask.evidence, mask.limitations), lowerBound: false };
}

/** Highest centre elevation reached in the window (a maximum over served samples). */
export function trackMaxCell(track: BodyTrack, evidence: Evidence, limitations: readonly string[]): Cell {
  if (track.elevationDeg.length === 0) {
    return { cell: cell(null, "deg", null, limitations, "no samples in the window"), lowerBound: false };
  }
  return { cell: cell(Math.max(...track.elevationDeg), "deg", evidence, limitations), lowerBound: false };
}

// ── Windows ───────────────────────────────────────────────────────────────

export interface WindowList {
  horizon: HorizonKind;
  windows: VisibilityWindow[];
  resolutionS: number;
  evidence: Evidence;
  limitations: string[];
}

/** Terrain windows when a mask was served (the physically relevant skyline), else astronomical. */
export function sunlitWindows(analysis: TimelineAnalysis): WindowList {
  const r = analysis.illumination;
  const s = r.terrain ?? r.astronomical;
  return {
    horizon: s.horizon,
    windows: s.sunlit_windows,
    resolutionS: s.resolution_s,
    evidence: r.evidence,
    limitations: r.limitations,
  };
}

export function earthWindows(analysis: TimelineAnalysis): WindowList {
  const r = analysis.earth_visibility;
  const s = r.terrain ?? r.astronomical;
  return {
    horizon: s.horizon,
    windows: s.windows,
    resolutionS: s.resolution_s,
    evidence: r.evidence,
    limitations: r.limitations,
  };
}

export function windowDurationCell(list: WindowList, w: VisibilityWindow): Cell {
  const censored = w.censored_start || w.censored_end;
  const edges = `Edges are known to ± ${Number((list.resolutionS / 3600).toFixed(2))} h (one sample step).`;
  const limits = censored ? [CENSORED_NOTE, edges, ...list.limitations] : [edges, ...list.limitations];
  return { cell: cell(w.duration_s, "s", list.evidence, limits), lowerBound: censored };
}

/** The radio-link disclaimer as served with the Earth result; falls back to the C4 wording. */
export const RADIO_LINK_FALLBACK =
  "Geometric line of sight only: Earth visibility does not imply a radio link (no antenna, link budget or relay modelled).";

export function radioLinkDisclaimer(analysis: TimelineAnalysis): string {
  return analysis.earth_visibility.limitations.find((l) => /radio link/i.test(l)) ?? RADIO_LINK_FALLBACK;
}

// ── Sites and window ──────────────────────────────────────────────────────

export interface SiteTab {
  id: string;
  name: string;
  demo: boolean;
}

/** Registered sites as tabs: the cited demo trio first (the default), then the others. */
export function siteTabs(
  registered: readonly { id: string; name: string }[],
  demoNames: readonly string[],
): SiteTab[] {
  const demo = new Set(demoNames.map((n) => n.toLowerCase()));
  const tabs = registered.map((s) => ({ id: s.id, name: s.name, demo: demo.has(s.name.toLowerCase()) }));
  return [...tabs.filter((t) => t.demo), ...tabs.filter((t) => !t.demo)];
}

export interface AnalysisWindow {
  key: "30d" | "1y";
  label: string;
  days: number;
  stepS: number;
}

/** 30 d hourly is 721 samples; a year at 3 h is 2 921 (cap 10 000 per body). */
export const WINDOWS: readonly AnalysisWindow[] = [
  { key: "30d", label: "30 days · 1 h", days: 30, stepS: 3_600 },
  { key: "1y", label: "1 year · 3 h", days: 365, stepS: 10_800 },
];

/** Windows start at 00:00 UTC today, so a day's requests share one cache entry. */
export function windowBounds(nowMs: number, w: AnalysisWindow): { startMs: number; endMs: number } {
  const d = new Date(nowMs);
  const startMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return { startMs, endMs: startMs + w.days * 86_400_000 };
}
