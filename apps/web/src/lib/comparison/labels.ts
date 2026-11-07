/**
 * Plain-language names and one-sentence explanations for the site metrics, so the site
 * panel and the comparison table use one name for one thing.
 *
 * The API keeps its technical column labels and descriptions (`services/compare.py`); the
 * web shows these instead. A column key this file does not know falls back to the API's own
 * label and description, so a new column still renders.
 *
 * Meanings follow `docs/SCIENCE.md`: `mean_visible_disk_fraction` is the time average of the
 * visible disk fraction, `illuminated_fraction` / `visible_fraction` the share of time with
 * any part of the disk above the horizon, and a run touching the window edge is censored.
 */

export interface MetricCopy {
  /** Short name for the panel row and the column header. */
  label: string;
  /** One or two plain sentences: what the number means. */
  tip: string;
}

const CENSORED =
  "If it touches the start or end of the dates, the real stretch may be longer, so treat it as a minimum.";

const METRIC_COPY: Record<string, MetricCopy> = {
  surface_height_m: {
    label: "Height",
    tip: "Ground height at the site above the Moon's reference sphere (radius 1,737.4 km).",
  },
  slope_at_site_deg: {
    label: "Slope at site",
    tip: "How steep the ground is at the site, in degrees. 0° is flat. Landers need gentle slopes, and the limit depends on the lander.",
  },
  slope_p95_deg: {
    label: "Steep spots (slope, worst 5 %)",
    tip: "Within the footprint, the patch of ground around the site, only 5 % of the ground is steeper than this angle. It catches steep patches that an average hides.",
  },
  roughness_rms_m: {
    label: "Bumpiness",
    tip: "Typical bump height across the footprint once the overall tilt is removed (RMS roughness). Smaller is smoother.",
  },
  horizon_min_deg: {
    label: "Skyline, lowest",
    tip: "The skyline is the highest ground seen in each compass direction. This is how high it rises above level at its lowest point around the site, in degrees.",
  },
  horizon_max_deg: {
    label: "Skyline, highest",
    tip: "How high the skyline rises above level at its highest point around the site, in degrees. A high value means a ridge blocks part of the sky.",
  },
  horizon_truncated_azimuths: {
    label: "Directions with missing map data",
    tip: "Compass directions where the map data ran out before the skyline was found. Results for those directions are less certain, and the real skyline may be higher.",
  },
  sun_mean_visible_disk_fraction: {
    label: "Sunlit, average",
    tip: "Over the chosen dates, the average share of the Sun's disk that is above the skyline. 100 % means the whole Sun is always up. Comparable to published average-illumination maps.",
  },
  sun_illuminated_fraction: {
    label: "Time with any sunlight",
    tip: "The share of the chosen dates when at least part of the Sun is above the skyline. It is never smaller than the average.",
  },
  sun_longest_hidden_s: {
    label: "Longest dark spell",
    tip: `The longest unbroken stretch with the whole Sun hidden. ${CENSORED}`,
  },
  earth_visible_fraction: {
    label: "Earth visible",
    tip: "The share of the chosen dates when at least part of Earth is above the skyline. Geometry only: it does not promise a working radio link.",
  },
  earth_longest_outage_s: {
    label: "Longest time without Earth",
    tip: `The longest unbroken stretch with Earth out of view. ${CENSORED}`,
  },
};

/** Plain label and explanation for a metric; the API's own text when the key is unknown. */
export function metricCopy(key: string, apiLabel: string, apiDescription?: string): MetricCopy {
  return METRIC_COPY[key] ?? { label: apiLabel, tip: apiDescription ?? "" };
}

/** Hover text for a column header: the plain explanation, then the API's technical description. */
export function metricTitle(key: string, apiLabel: string, apiDescription?: string): string {
  const { tip } = metricCopy(key, apiLabel, apiDescription);
  return apiDescription && apiDescription !== tip ? `${tip} (Technical: ${apiDescription})` : tip;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2027-01-01T00:00:00Z` → `1 Jan 2027`. Returns the input unchanged if it is not a date. */
export function formatDateUtc(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `1 Jan 2027 to 1 Jan 2028 (UTC)`; the exact timestamps belong in a tooltip. */
export function formatPeriodUtc(startIso: string, endIso: string): string {
  return `${formatDateUtc(startIso)} to ${formatDateUtc(endIso)} (UTC)`;
}
