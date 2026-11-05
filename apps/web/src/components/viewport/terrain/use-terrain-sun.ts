"use client";

import type { Evidence } from "@lunaris/shared-types";
import { useMemo } from "react";

import { describeError } from "@/lib/api/client";
import { useSiteEphemeris, useSitesQuery } from "@/lib/api/queries";
import { directionAt, elevationAtMs, toDirectionSeries, type Direction } from "@/lib/terrain/sun";
import { useMissionStore } from "@/store/mission-store";

export type TerrainSun =
  | { kind: "display"; reason: string }
  | {
      kind: "spice";
      direction: Direction;
      /** Astronomical elevation at the selected site (C0 plane), display-interpolated. */
      elevationDeg: number;
      siteName: string;
      epochMs: number;
      evidence: Evidence;
    };

/**
 * Sun direction for lighting the terrain (D5): C2 `direction_moon_me` of the selected
 * site at the selected epoch. The Sun's parallax across the ±125 km scene is below
 * 0.01°, so one site's direction lights the whole scene. Shares the timeline lanes'
 * ephemeris query (same key), so scrubbing costs no requests.
 */
export function useTerrainSun(): TerrainSun {
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const epochMs = useMissionStore((s) => s.epochMs);
  const startMs = useMissionStore((s) => s.windowStartMs);
  const endMs = useMissionStore((s) => s.windowEndMs);
  const site = useSitesQuery().data?.sites.find((s) => s.id === selectedSiteId) ?? null;
  const query = useSiteEphemeris(site?.id ?? null, startMs, endMs);

  const sun = useMemo(() => {
    const body = query.data?.bodies.find((b) => b.body === "sun");
    return body ? { series: toDirectionSeries(body.samples), evidence: body.evidence } : null;
  }, [query.data]);

  return useMemo((): TerrainSun => {
    if (!site) return { kind: "display", reason: "Select a site to light the terrain with the SPICE Sun." };
    if (query.isError)
      return { kind: "display", reason: `SPICE Sun unavailable: ${describeError(query.error)}` };
    if (!sun || epochMs === null) return { kind: "display", reason: "Computing the SPICE Sun direction…" };
    const direction = directionAt(sun.series, epochMs);
    const elevationDeg = elevationAtMs(sun.series, epochMs);
    if (!direction || elevationDeg === null) {
      return { kind: "display", reason: "Epoch outside the computed window." };
    }
    return { kind: "spice", direction, elevationDeg, siteName: site.name, epochMs, evidence: sun.evidence };
  }, [site, query.isError, query.error, sun, epochMs]);
}
