"use client";

import { useMemo } from "react";

import { useSitesQuery } from "@/lib/api/queries";
import { selenographicToScene } from "@/lib/geo/selenographic";
import { useMissionStore } from "@/store/mission-store";

import type { LabelSpec } from "./label-layer";

const GRATICULE_CLASS =
  "font-mono text-[12px] tracking-wider text-chart-label [text-shadow:0_0_3px_#000,0_0_6px_#000]";
const SITE_CLASS =
  "rounded-[3px] border border-white/15 bg-scrim-chip px-1.5 py-px font-mono text-[12px] text-foreground backdrop-blur-sm";
const SITE_SELECTED_CLASS =
  "rounded-[3px] border border-primary/60 bg-scrim-selected px-1.5 py-px font-mono text-[12px] text-primary";

const GRATICULE_LABELS: LabelSpec[] = [
  ...[-60, -70, -80, -85].map((lat) => ({
    id: `lat${lat}`,
    text: `${Math.abs(lat)}°S`,
    position: selenographicToScene(lat, 15, 1.004),
    offset: "center" as const,
    className: GRATICULE_CLASS,
  })),
  ...[
    [0, "0°"],
    [90, "90°E"],
    [180, "180°"],
    [270, "270°E"],
  ].map(([lon, text]) => ({
    id: `lon${lon}`,
    text: String(text),
    position: selenographicToScene(-75, Number(lon), 1.004),
    offset: "center" as const,
    className: GRATICULE_CLASS,
  })),
];

/** Labels to display, honouring layer visibility. */
export function useSurfaceLabels(): LabelSpec[] {
  const layers = useMissionStore((s) => s.layers);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const sites = useSitesQuery().data?.sites;

  return useMemo(() => {
    if (!layers.labels) return [];
    const labels: LabelSpec[] = layers.graticule ? [...GRATICULE_LABELS] : [];
    if (layers.sites && sites) {
      for (const site of sites) {
        labels.push({
          id: `site:${site.id}`,
          text: site.name,
          position: selenographicToScene(site.coordinate.latitude_deg, site.coordinate.longitude_deg, 1.003),
          offset: "above",
          className: site.id === selectedSiteId ? SITE_SELECTED_CLASS : SITE_CLASS,
        });
      }
    }
    return labels;
  }, [layers.labels, layers.graticule, layers.sites, sites, selectedSiteId]);
}
