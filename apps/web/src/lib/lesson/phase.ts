import type { MoonPhaseSample } from "./types";

/**
 * The eight phase names of PLAN.md section 6 (Thai wording in the catalogue, pending the
 * team's review). The lunar-calendar day number (ค่ำ) is NOT computed: it is a calendar
 * convention and can differ from the astronomical phase by a day.
 */
export type PhaseName =
  | "new"
  | "waxingCrescent"
  | "firstQuarter"
  | "waxingGibbous"
  | "full"
  | "waningGibbous"
  | "lastQuarter"
  | "waningCrescent";

/**
 * Teaching bands on the illuminated fraction. These are classroom thresholds chosen so each
 * name lasts a visible number of days, not astronomical definitions (an astronomical "quarter"
 * is an instant). The readout says so.
 */
export const PHASE_BANDS = {
  /** Below this lit fraction the Moon is called new. */
  newBelow: 0.03,
  /** Lit fractions from here up to `halfUpTo` are called half (quarter). */
  halfFrom: 0.4,
  halfUpTo: 0.6,
  /** From this lit fraction up the Moon is called full. */
  fullFrom: 0.97,
} as const;

export function phaseName(illuminatedFraction: number, waxing: boolean): PhaseName {
  const f = illuminatedFraction;
  if (f < PHASE_BANDS.newBelow) return "new";
  if (f >= PHASE_BANDS.fullFrom) return "full";
  if (f < PHASE_BANDS.halfFrom) return waxing ? "waxingCrescent" : "waningCrescent";
  if (f <= PHASE_BANDS.halfUpTo) return waxing ? "firstQuarter" : "lastQuarter";
  return waxing ? "waxingGibbous" : "waningGibbous";
}

export interface PhaseReadout {
  /** Whole percent of the disk lit, as seen from the Earth's centre. */
  percentLit: number;
  waxing: boolean;
  name: PhaseName;
  phaseAngleDeg: number;
  elongationDeg: number;
}

export function readoutFor(sample: MoonPhaseSample): PhaseReadout {
  return {
    percentLit: Math.round(sample.illuminated_fraction * 100),
    waxing: sample.waxing,
    name: phaseName(sample.illuminated_fraction, sample.waxing),
    phaseAngleDeg: sample.phase_angle_deg,
    elongationDeg: sample.elongation_deg,
  };
}
