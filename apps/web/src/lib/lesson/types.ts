import type { components } from "@lunaris/shared-types";

/**
 * Types the lesson route reads. Lesson code never imports `lib/api/client` or `lib/api/queries`
 * (contract L3, decision D10); these are the same response shapes, taken from the generated
 * contract or, until it carries the Moon phase series, declared here.
 */
export type SunDirectionSeries = components["schemas"]["SunDirectionSeries"];
export type Evidence = components["schemas"]["EvidenceSchema"];

/**
 * Contract L1 (K-01, PR #47): the Moon phase series. Declared locally until `MoonPhaseSeries`
 * reaches the generated contract; the field names and meanings are the contract's. Replace
 * this block with `components["schemas"]["MoonPhaseSeries"]` when it lands.
 */
export interface MoonPhaseSample {
  epoch_utc: string;
  /** Apparent unit vector, Moon centre to Earth centre, MOON_ME. */
  earth_direction_moon_me: number[];
  subearth_latitude_deg: number;
  /** East longitude, [0, 360). */
  subearth_longitude_deg: number;
  /** Sun–Moon–Earth angle at the Moon's centre, [0, 180]. */
  phase_angle_deg: number;
  /** Lit fraction of the disk seen from the Earth's centre, in [0, 1]. */
  illuminated_fraction: number;
  /** Sun–Earth–Moon angle at the Earth's centre. */
  elongation_deg: number;
  waxing: boolean;
}

export interface MoonPhaseSeries {
  start_utc: string;
  end_utc: string;
  step_s: number;
  sample_count: number;
  max_samples: number;
  frame: "MOON_ME";
  origin: "MOON";
  viewpoint: "geocentric";
  aberration_correction: "CN+S";
  samples: MoonPhaseSample[];
  evidence: Evidence;
  limitations: string[];
}

/** Where the numbers on screen came from. A synthetic source is always labelled in the UI. */
export type PackProvenance =
  | { kind: "pack"; version: string; generatedAtUtc: string | null; codeCommit: string | null }
  | { kind: "synthetic"; reason: string };

export interface LessonPack {
  provenance: PackProvenance;
  sun: SunDirectionSeries;
  phase: MoonPhaseSeries;
}
