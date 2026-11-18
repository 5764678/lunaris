import type { LessonPack, MoonPhaseSeries, SunDirectionSeries } from "./types";

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
