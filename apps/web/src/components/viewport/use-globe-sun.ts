"use client";

import type { Evidence } from "@lunaris/shared-types";
import { useMemo } from "react";

import { describeError } from "@/lib/api/client";
import { useSunDirection } from "@/lib/api/queries";
import { bodyFixedToScene, type Vec3 } from "@/lib/geo/selenographic";
import { globeSunAt, toGlobeSunSeries } from "@/lib/globe/sun";
import { useMissionStore } from "@/store/mission-store";

export type GlobeSun =
  | { kind: "display"; reason: string }
  | {
      kind: "spice";
      /** Unit vector toward the Sun in scene axes (MOON_ME rotated to Y-up). */
      sceneDirection: Vec3;
      subsolarLatDeg: number;
      subsolarLonDeg: number;
      epochMs: number;
      evidence: Evidence;
    };

/**
 * The SPICE Sun for the globe at the timeline epoch (T-26: Moon-centred apparent
 * direction, CN+S). Falls back to the labelled display light with the reason.
 */
export function useGlobeSun(): GlobeSun {
  const epochMs = useMissionStore((s) => s.epochMs);
  const startMs = useMissionStore((s) => s.windowStartMs);
  const endMs = useMissionStore((s) => s.windowEndMs);
  const query = useSunDirection(startMs, endMs);
  const series = useMemo(() => (query.data ? toGlobeSunSeries(query.data) : null), [query.data]);

  return useMemo((): GlobeSun => {
    if (query.isError)
      return { kind: "display", reason: `SPICE Sun unavailable: ${describeError(query.error)}` };
    if (!series || !query.data || epochMs === null) {
      return { kind: "display", reason: "Computing the SPICE Sun direction…" };
    }
    const sun = globeSunAt(series, epochMs);
    if (!sun) return { kind: "display", reason: "Epoch outside the computed window." };
    return {
      kind: "spice",
      sceneDirection: bodyFixedToScene(sun.direction),
      subsolarLatDeg: sun.subsolarLatDeg,
      subsolarLonDeg: sun.subsolarLonDeg,
      epochMs,
      evidence: query.data.evidence,
    };
  }, [query.isError, query.error, query.data, series, epochMs]);
}
