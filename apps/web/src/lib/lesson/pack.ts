import {
  COMPARE_VARIANTS,
  type CompareVariant,
  type HorizonMaskResponse,
  type LessonPack,
  type MoonPhaseSeries,
  type PackIndex,
  type SiteBundle,
  type SiteComparison,
  type SunDirectionSeries,
  type TimelineAnalysis,
} from "./types";

/**
 * The only door to the numbers the lesson route shows (contract L3, decision D10).
 *
 * It reads the committed lesson pack, static files served with the web app
 * (`/lesson-pack/v1/`, contract L2; `manifest.json` lists every file with its model name).
 * It never calls the API, and lesson code must not import `lib/api/client` or
 * `lib/api/queries`; an end-to-end test checks that no request leaves for the API host.
 *
 * A pack that is missing or unreadable is an error the page reports, never a silent fall
 * back to made-up numbers. (`fixtures/synthetic-pack.ts` is a labelled stand-in for unit
 * tests only; nothing in the shipped route imports it.)
 */
export const PACK_BASE = "/lesson-pack/v1";
export const PACK_FILES = {
  manifest: "manifest.json",
  /** Defaults, used only when the manifest does not name a file for the model. */
  sun: "ephemeris/sun.json",
  phase: "ephemeris/moon-phase.json",
} as const;

/** The path of the manifest file whose `model` is `model`, else the default. */
export function packPathFor(manifest: unknown, model: string, fallback: string): string {
  const files = isObject(manifest) && Array.isArray(manifest.files) ? manifest.files : [];
  for (const f of files) {
    if (
      isObject(f) &&
      f.model === model &&
      typeof f.path === "string" &&
      /^[A-Za-z0-9._/-]+$/.test(f.path) &&
      !f.path.includes("..")
    ) {
      return f.path;
    }
  }
  return fallback;
}

export class LessonPackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LessonPackError";
  }
}

type Fetch = (input: string) => Promise<Response>;

async function getJson(
  fetchImpl: Fetch,
  file: string,
): Promise<{ ok: true; body: unknown } | { ok: false; status: number }> {
  let response: Response;
  try {
    response = await fetchImpl(`${PACK_BASE}/${file}`);
  } catch (error) {
    throw new LessonPackError(
      `Could not fetch ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) return { ok: false, status: response.status };
  try {
    return { ok: true, body: await response.json() };
  } catch {
    throw new LessonPackError(`${file} is not valid JSON.`);
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function isSunSeries(v: unknown): v is SunDirectionSeries {
  return (
    isObject(v) &&
    v.frame === "MOON_ME" &&
    Array.isArray(v.samples) &&
    v.samples.length > 0 &&
    isObject(v.evidence)
  );
}

export function isMoonPhaseSeries(v: unknown): v is MoonPhaseSeries {
  return (
    isObject(v) &&
    v.frame === "MOON_ME" &&
    v.viewpoint === "geocentric" &&
    Array.isArray(v.samples) &&
    v.samples.length > 0 &&
    isObject(v.evidence)
  );
}

export async function loadLessonPack(fetchImpl: Fetch = (url) => fetch(url)): Promise<LessonPack> {
  const manifest = await getJson(fetchImpl, PACK_FILES.manifest);
  if (!manifest.ok) throw new LessonPackError(`${PACK_FILES.manifest} answered HTTP ${manifest.status}.`);
  const m = isObject(manifest.body) ? manifest.body : {};
  const sunPath = packPathFor(manifest.body, "SunDirectionSeries", PACK_FILES.sun);
  const phasePath = packPathFor(manifest.body, "MoonPhaseSeries", PACK_FILES.phase);
  const [sun, phase] = await Promise.all([getJson(fetchImpl, sunPath), getJson(fetchImpl, phasePath)]);
  if (!sun.ok) throw new LessonPackError(`${sunPath} answered HTTP ${sun.status}.`);
  if (!phase.ok) throw new LessonPackError(`${phasePath} answered HTTP ${phase.status}.`);
  if (!isSunSeries(sun.body)) throw new LessonPackError(`${sunPath} is not a Sun direction series.`);
  if (!isMoonPhaseSeries(phase.body)) throw new LessonPackError(`${phasePath} is not a Moon phase series.`);
  return {
    provenance: {
      kind: "pack",
      version: typeof m.pack_version === "string" ? m.pack_version : "1",
      generatedAtUtc: typeof m.generated_at_utc === "string" ? m.generated_at_utc : null,
      codeCommit: isObject(m.code) && typeof m.code.commit === "string" ? m.code.commit : null,
    },
    sun: sun.body,
    phase: phase.body,
  };
}

let cached: Promise<LessonPack> | null = null;

/** One load per page visit; a failed load is not cached, so a retry can succeed. */
export function getLessonPack(): Promise<LessonPack> {
  cached ??= loadLessonPack().catch((error: unknown) => {
    cached = null;
    throw error;
  });
  return cached;
}

/** Test helper. */
export function resetLessonPackCache(): void {
  cached = null;
}

// ── Periods 4 and 5: the demo trio and the comparison variants ─────────────

function isHorizonMaskResponse(v: unknown): v is HorizonMaskResponse {
  return (
    isObject(v) &&
    Array.isArray(v.azimuth_deg) &&
    Array.isArray(v.elevation_deg) &&
    Array.isArray(v.truncated) &&
    v.azimuth_deg.length > 0 &&
    v.azimuth_deg.length === v.elevation_deg.length &&
    v.azimuth_deg.length === v.truncated.length &&
    isObject(v.evidence)
  );
}

function isTimelineAnalysis(v: unknown): v is TimelineAnalysis {
  return (
    isObject(v) &&
    typeof v.site_name === "string" &&
    isObject(v.illumination) &&
    isObject(v.illumination.astronomical) &&
    isObject(v.illumination.terrain) &&
    Array.isArray(v.illumination.samples) &&
    isObject(v.illumination.evidence) &&
    isObject(v.earth_visibility) &&
    Array.isArray(v.earth_visibility.samples)
  );
}

function isSiteComparison(v: unknown): v is SiteComparison {
  return (
    isObject(v) &&
    Array.isArray(v.rows) &&
    Array.isArray(v.columns) &&
    isObject(v.summary) &&
    isObject(v.summary.recommendation) &&
    Array.isArray(v.summary.recommendation.ranking) &&
    Array.isArray(v.summary.recommendation.needs) &&
    isObject(v.summary.recommendation.evidence)
  );
}

/** A path read from the manifest must stay inside the pack. */
function safePath(v: unknown): string | null {
  return typeof v === "string" && /^[A-Za-z0-9._/-]+$/.test(v) && !v.includes("..") ? v : null;
}

async function getPackJson(file: string): Promise<unknown> {
  const result = await getJson((url) => fetch(url), file);
  if (!result.ok) throw new LessonPackError(`${file} answered HTTP ${result.status}.`);
  return result.body;
}

/** Reads what periods 4 and 5 need from `manifest.json`: which files, and the shadowed-site scan. */
export function parsePackIndex(manifest: unknown): PackIndex {
  if (!isObject(manifest)) throw new LessonPackError("manifest.json is not an object.");
  const m = manifest;
  const lun = isObject(m.lunation) ? m.lunation : {};
  const win = isObject(lun.window) ? lun.window : {};
  const trio = Array.isArray(m.demo_trio) ? m.demo_trio : [];
  const demoTrio: PackIndex["demoTrio"] = [];
  for (const entry of trio) {
    if (!isObject(entry) || !Array.isArray(entry.files)) continue;
    const files = entry.files.map(safePath);
    const horizonFile = files.find((f) => f?.endsWith("/horizon.json"));
    const timelineFile = files.find((f) => f?.endsWith("/timeline.json"));
    if (
      typeof entry.catalog_site_id === "string" &&
      typeof entry.name === "string" &&
      typeof entry.terrain_sunlit_fraction === "number" &&
      horizonFile &&
      timelineFile
    ) {
      demoTrio.push({
        catalogSiteId: entry.catalog_site_id,
        name: entry.name,
        horizonFile,
        timelineFile,
        terrainSunlitFraction: entry.terrain_sunlit_fraction,
      });
    }
  }
  const comparisons: PackIndex["comparisons"] = [];
  for (const entry of Array.isArray(m.comparisons) ? m.comparisons : []) {
    if (!isObject(entry)) continue;
    const file = safePath(entry.file);
    const variant = (COMPARE_VARIANTS as readonly unknown[]).includes(entry.variant)
      ? (entry.variant as CompareVariant)
      : null;
    if (file && variant) comparisons.push({ variant, file });
  }
  const scan = isObject(m.shadowed_scan) ? m.shadowed_scan : {};
  const scanWindow = isObject(scan.window) ? scan.window : {};
  const scanSites = (Array.isArray(scan.sites) ? scan.sites : []).flatMap((s) =>
    isObject(s) && typeof s.catalog_site_id === "string" && typeof s.sunlit_fraction === "number"
      ? [{ catalogSiteId: s.catalog_site_id, sunlitFraction: s.sunlit_fraction }]
      : [],
  );
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  if (demoTrio.length === 0) throw new LessonPackError("manifest.json lists no demo sites.");
  return {
    lunation: {
      newMoonUtc: str(lun.new_moon_utc),
      nextNewMoonUtc: str(lun.next_new_moon_utc),
      startUtc: str(win.start_utc),
      endUtc: str(win.end_utc),
    },
    demoTrio,
    comparisons,
    shadowed: {
      ran: scan.ran === true,
      permanentlyShadowedExample:
        typeof m.permanently_shadowed_example === "string" ? m.permanently_shadowed_example : null,
      criterion: str(scan.criterion),
      windowStartUtc: str(scanWindow.start_utc),
      windowEndUtc: str(scanWindow.end_utc),
      sites: scanSites,
    },
    provenance: {
      kind: "pack",
      version: typeof m.pack_version === "string" ? m.pack_version : "1",
      generatedAtUtc: typeof m.generated_at_utc === "string" ? m.generated_at_utc : null,
      codeCommit: isObject(m.code) && typeof m.code.commit === "string" ? m.code.commit : null,
    },
  };
}

export async function loadPackIndex(): Promise<PackIndex> {
  return parsePackIndex(await getPackJson(PACK_FILES.manifest));
}

function demoSite(index: PackIndex, catalogSiteId: string) {
  const entry = index.demoTrio.find((s) => s.catalogSiteId === catalogSiteId);
  if (!entry) throw new LessonPackError(`The pack has no demo site ${catalogSiteId}.`);
  return entry;
}

/** The timeline of one demo site, found through the manifest. */
export async function loadSiteTimeline(index: PackIndex, catalogSiteId: string): Promise<TimelineAnalysis> {
  const entry = demoSite(index, catalogSiteId);
  const timeline = await getPackJson(entry.timelineFile);
  if (!isTimelineAnalysis(timeline)) throw new LessonPackError(`${entry.timelineFile} is not a timeline.`);
  return timeline;
}

/** The horizon mask and the timeline of one demo site, found through the manifest. */
export async function loadSiteBundle(index: PackIndex, catalogSiteId: string): Promise<SiteBundle> {
  const entry = demoSite(index, catalogSiteId);
  const [horizon, timeline] = await Promise.all([
    getPackJson(entry.horizonFile),
    loadSiteTimeline(index, catalogSiteId),
  ]);
  if (!isHorizonMaskResponse(horizon))
    throw new LessonPackError(`${entry.horizonFile} is not a horizon mask.`);
  return { catalogSiteId, name: entry.name, horizon, timeline };
}

/** One of the four packed comparisons. */
export async function loadComparison(index: PackIndex, variant: CompareVariant): Promise<SiteComparison> {
  const entry = index.comparisons.find((c) => c.variant === variant);
  if (!entry) throw new LessonPackError(`The pack has no comparison variant ${variant}.`);
  const body = await getPackJson(entry.file);
  if (!isSiteComparison(body)) throw new LessonPackError(`${entry.file} is not a site comparison.`);
  return body;
}
