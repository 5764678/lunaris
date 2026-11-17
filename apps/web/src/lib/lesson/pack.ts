import { buildSyntheticPack } from "./fixtures/synthetic-pack";
import type { LessonPack, MoonPhaseSeries, SunDirectionSeries } from "./types";

/**
 * The only door to the numbers the lesson route shows (contract L3, decision D10).
 *
 * It reads the committed lesson pack, static files served with the web app
 * (`/lesson-pack/v1/`, contract L2). It never calls the API, and lesson code must not import
 * `lib/api/client` or `lib/api/queries`; an end-to-end test checks that no request leaves for
 * the API host.
 *
 * File names below follow the order of contract L2 but are ASSUMED until K-02 lands: confirm
 * them against the real `manifest.json` and fix `PACK_FILES` if they differ. While the pack
 * is absent (the manifest answers 404) the loader returns a SYNTHETIC fixture whose provenance
 * says so; the UI shows that label wherever a number appears. A pack that is present but
 * unreadable is an error, never a silent fall back to synthetic numbers.
 */
export const PACK_BASE = "/lesson-pack/v1";
export const PACK_FILES = {
  manifest: "manifest.json",
  sun: "sun-direction.json",
  phase: "moon-phase.json",
} as const;

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
  if (!manifest.ok) {
    if (manifest.status === 404) {
      return buildSyntheticPack("The lesson pack is not in this build yet (manifest.json answered 404).");
    }
    throw new LessonPackError(`manifest.json answered HTTP ${manifest.status}.`);
  }
  const m = isObject(manifest.body) ? manifest.body : {};
  const [sun, phase] = await Promise.all([
    getJson(fetchImpl, PACK_FILES.sun),
    getJson(fetchImpl, PACK_FILES.phase),
  ]);
  if (!sun.ok) throw new LessonPackError(`${PACK_FILES.sun} answered HTTP ${sun.status}.`);
  if (!phase.ok) throw new LessonPackError(`${PACK_FILES.phase} answered HTTP ${phase.status}.`);
  if (!isSunSeries(sun.body)) throw new LessonPackError(`${PACK_FILES.sun} is not a Sun direction series.`);
  if (!isMoonPhaseSeries(phase.body))
    throw new LessonPackError(`${PACK_FILES.phase} is not a Moon phase series.`);
  return {
    provenance: {
      kind: "pack",
      version: typeof m.pack_version === "string" ? m.pack_version : "v1",
      generatedAtUtc: typeof m.generated_at_utc === "string" ? m.generated_at_utc : null,
      codeCommit: typeof m.code_commit === "string" ? m.code_commit : null,
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
