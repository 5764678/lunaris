import type {
  HorizonMask,
  LessonPack,
  LessonSite,
  MoonPhaseSeries,
  PackManifest,
  SiteComparison,
  SunDirectionSeries,
  TimelineAnalysis,
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
  cacheByKey.clear();
}

function isManifest(v: unknown): v is PackManifest {
  return (
    isObject(v) &&
    isObject(v.lunation) &&
    Array.isArray(v.demo_trio) &&
    Array.isArray(v.comparisons) &&
    isObject(v.shadowed_scan) &&
    Array.isArray(v.shadowed_scan.sites)
  );
}

/** Reads one pack file, with the same error rules as the rest of the loader. */
async function readFile(fetchImpl: Fetch, path: string): Promise<unknown> {
  const result = await getJson(fetchImpl, path);
  if (!result.ok) throw new LessonPackError(`${path} answered HTTP ${result.status}.`);
  return result.body;
}

/** `manifest.json`, checked for the parts the steps use. */
export async function loadManifest(fetchImpl: Fetch = (url) => fetch(url)): Promise<PackManifest> {
  const body = await readFile(fetchImpl, PACK_FILES.manifest);
  if (!isManifest(body))
    throw new LessonPackError("manifest.json is missing the lunation, demo trio, comparisons or scan.");
  return body;
}

/** A demo-trio site: horizon mask and timeline, found through the manifest (catalogue id → files). */
export async function loadSite(
  catalogSiteId: string,
  fetchImpl: Fetch = (url) => fetch(url),
): Promise<LessonSite> {
  const manifest = await loadManifest(fetchImpl);
  const entry = manifest.demo_trio.find((s) => s.catalog_site_id === catalogSiteId);
  if (!entry) throw new LessonPackError(`${catalogSiteId} is not in the pack's demo trio.`);
  const pathOf = (name: string) => entry.files.find((f) => f.endsWith(`/${name}`));
  const horizonPath = pathOf("horizon.json");
  const timelinePath = pathOf("timeline.json");
  if (!horizonPath || !timelinePath)
    throw new LessonPackError(`${catalogSiteId} has no horizon or timeline file in the manifest.`);
  const [horizon, timeline] = await Promise.all([
    readFile(fetchImpl, horizonPath),
    readFile(fetchImpl, timelinePath),
  ]);
  if (
    !isObject(horizon) ||
    !Array.isArray(horizon.azimuth_deg) ||
    !Array.isArray(horizon.elevation_deg) ||
    !Array.isArray(horizon.truncated)
  ) {
    throw new LessonPackError(`${horizonPath} is not a horizon mask.`);
  }
  if (!isObject(timeline) || !isObject(timeline.illumination) || !isObject(timeline.earth_visibility)) {
    throw new LessonPackError(`${timelinePath} is not a timeline analysis.`);
  }
  return {
    name: entry.name,
    catalogSiteId,
    horizon: horizon as unknown as HorizonMask,
    timeline: timeline as unknown as TimelineAnalysis,
  };
}

/** One of the four packed comparisons ("default", "power-critical", "comms-critical", "landing-critical"). */
export async function loadComparison(
  variant: string,
  fetchImpl: Fetch = (url) => fetch(url),
): Promise<SiteComparison> {
  const manifest = await loadManifest(fetchImpl);
  const entry = manifest.comparisons.find((c) => c.variant === variant);
  if (!entry) throw new LessonPackError(`The pack has no comparison named ${variant}.`);
  const body = await readFile(fetchImpl, entry.file);
  if (
    !isObject(body) ||
    !Array.isArray(body.rows) ||
    !Array.isArray(body.columns) ||
    !isObject(body.summary)
  ) {
    throw new LessonPackError(`${entry.file} is not a site comparison.`);
  }
  return body as unknown as SiteComparison;
}

const cacheByKey = new Map<string, Promise<unknown>>();

/** One load per key per page visit; a failed load is not cached. */
export function cachedPackLoad<T>(key: string, load: () => Promise<T>): Promise<T> {
  let hit = cacheByKey.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = load().catch((error: unknown) => {
      cacheByKey.delete(key);
      throw error;
    });
    cacheByKey.set(key, hit);
  }
  return hit;
}
