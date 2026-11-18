import type { LessonSite, PackManifest, TimelineAnalysis } from "./types";

/** Range of a series, ignoring nothing: the numbers a student reads off the sky chart. */
export interface SkyFacts {
  sunElevationMaxDeg: number;
  sunElevationMinDeg: number;
  /** Fraction of hours the Sun is up over the terrain skyline (the pack's `illuminated_fraction`). */
  sunlitTerrain: number;
  /** The same over a flat astronomical horizon. */
  sunlitFlat: number;
  earthElevationMaxDeg: number;
  earthElevationMinDeg: number;
  earthAzimuthMinDeg: number;
  earthAzimuthMaxDeg: number;
  skylineMinDeg: number;
  skylineMaxDeg: number;
  sampleCount: number;
}

/**
 * Figures read from the pack's timeline and horizon for one site. Nothing here is computed
 * from physics: they are minima, maxima and the two illuminated fractions already in the pack.
 */
export function skyFacts(site: LessonSite): SkyFacts {
  const { illumination, earth_visibility: earth } = site.timeline;
  // The pack is built with terrain horizons; a timeline without one cannot teach this step.
  if (!illumination.terrain) throw new Error(`${site.name}: the pack's timeline has no terrain horizon.`);
  const sunEl = illumination.samples.map((s) => s.elevation_deg);
  const earthEl = earth.samples.map((s) => s.elevation_deg);
  const earthAz = earth.samples.map((s) => s.azimuth_deg);
  return {
    sunElevationMaxDeg: Math.max(...sunEl),
    sunElevationMinDeg: Math.min(...sunEl),
    sunlitTerrain: illumination.terrain.illuminated_fraction,
    sunlitFlat: illumination.astronomical.illuminated_fraction,
    earthElevationMaxDeg: Math.max(...earthEl),
    earthElevationMinDeg: Math.min(...earthEl),
    earthAzimuthMinDeg: Math.min(...earthAz),
    earthAzimuthMaxDeg: Math.max(...earthAz),
    skylineMinDeg: Math.min(...site.horizon.elevation_deg),
    skylineMaxDeg: Math.max(...site.horizon.elevation_deg),
    sampleCount: illumination.samples.length,
  };
}

export type TimelineSample = TimelineAnalysis["illumination"]["samples"][number];

/** Names of catalogue sites the lesson refers to by name (packages/data catalogue, `name`). */
export const CATALOGUE_NAMES: Readonly<Record<string, string>> = {
  "pgda78-npb": "Amundsen 1",
};

export interface NearDark {
  catalogSiteId: string;
  /** Catalogue name when the lesson knows it, else the catalogue id. */
  name: string;
  /** Fraction of hours in the packed lunation with the Sun over the terrain skyline. */
  sunlitFraction: number;
  scannedSites: number;
  windowStartUtc: string;
  windowEndUtc: string;
  criterion: string;
}

/**
 * The darkest site of the pack's scan of the catalogue. The pack has no site with a sunlit
 * fraction of exactly 0, so this is a near-dark example, never called "0 %". The scan carries
 * no per-value evidence label; the caller says where the figure comes from.
 */
export function nearDarkExample(manifest: PackManifest): NearDark | null {
  const scan = manifest.shadowed_scan;
  if (!scan.ran || scan.sites.length === 0) return null;
  const darkest = scan.sites.reduce((a, b) => (b.sunlit_fraction < a.sunlit_fraction ? b : a));
  return {
    catalogSiteId: darkest.catalog_site_id,
    name: CATALOGUE_NAMES[darkest.catalog_site_id] ?? darkest.catalog_site_id,
    sunlitFraction: darkest.sunlit_fraction,
    scannedSites: scan.sites.length,
    windowStartUtc: scan.window.start_utc,
    windowEndUtc: scan.window.end_utc,
    criterion: scan.criterion,
  };
}
