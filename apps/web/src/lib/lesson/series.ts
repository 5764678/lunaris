import type { LessonPack, MoonPhaseSample } from "./types";

export const SAMPLES_PER_DAY_FALLBACK = 24;

export interface LunationFrame {
  index: number;
  phase: MoonPhaseSample;
  /** Unit vector toward the Sun, MOON_ME, from the Sun series sample with the same epoch. */
  sunDirectionMoonMe: readonly [number, number, number];
  subsolarLatDeg: number;
  subsolarLonDeg: number;
  /** Whole days since the start of the series, starting at 1. */
  day: number;
}

/** Samples per day, from the series step. */
export function samplesPerDay(stepS: number): number {
  return stepS > 0 ? Math.max(1, Math.round(86_400 / stepS)) : SAMPLES_PER_DAY_FALLBACK;
}

/** Total days covered, rounded up (so a 29.5-day lunation reads as 30 days). */
export function totalDays(pack: LessonPack): number {
  const perDay = samplesPerDay(pack.phase.step_s);
  return Math.ceil(pack.phase.samples.length / perDay);
}

/**
 * The frame at sample `index` (clamped). The Sun sample is looked up by epoch, never by
 * position, so two series with different grids cannot silently disagree; if no Sun sample has
 * that epoch the frame is null and the caller says so.
 */
export function frameAt(
  pack: LessonPack,
  index: number,
  sunByEpoch: Map<string, number>,
): LunationFrame | null {
  const samples = pack.phase.samples;
  const i = Math.min(Math.max(0, Math.round(index)), samples.length - 1);
  const phase = samples[i];
  if (!phase) return null;
  const sunIndex = sunByEpoch.get(phase.epoch_utc);
  const sun = sunIndex === undefined ? undefined : pack.sun.samples[sunIndex];
  if (!sun) return null;
  const d = sun.direction_moon_me;
  return {
    index: i,
    phase,
    sunDirectionMoonMe: [d[0]!, d[1]!, d[2]!],
    subsolarLatDeg: sun.subsolar_latitude_deg,
    subsolarLonDeg: sun.subsolar_longitude_deg,
    day: Math.floor(i / samplesPerDay(pack.phase.step_s)) + 1,
  };
}

export function indexSunByEpoch(pack: LessonPack): Map<string, number> {
  return new Map(pack.sun.samples.map((s, i) => [s.epoch_utc, i]));
}
