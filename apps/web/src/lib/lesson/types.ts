import type { components } from "@lunaris/shared-types";

/**
 * Types the lesson route reads. Lesson code never imports `lib/api/client` or `lib/api/queries`
 * (contract L3, decision D10); these are the same response shapes, taken from the generated
 * contract.
 */
export type SunDirectionSeries = components["schemas"]["SunDirectionSeries"];
export type Evidence = components["schemas"]["EvidenceSchema"];

export type MoonPhaseSeries = components["schemas"]["MoonPhaseSeries"];
export type MoonPhaseSample = components["schemas"]["MoonPhaseSample"];

/** Where the numbers on screen came from. A synthetic source is always labelled in the UI. */
export type PackProvenance =
  | { kind: "pack"; version: string; generatedAtUtc: string | null; codeCommit: string | null }
  | { kind: "synthetic"; reason: string };

export interface LessonPack {
  provenance: PackProvenance;
  sun: SunDirectionSeries;
  phase: MoonPhaseSeries;
}
