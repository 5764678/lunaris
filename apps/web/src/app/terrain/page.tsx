import type { Metadata } from "next";

import { PageInProgress } from "@/components/shell/page-in-progress";

export const metadata: Metadata = { title: "Terrain" };

/** Placeholder until the Terrain page (T-19) lands. */
export default function TerrainPage() {
  return (
    <PageInProgress
      title="Terrain"
      task="T-19"
      coming="Per-site terrain analysis: LOLA height, slope and roughness with their baselines, hazard indicators and the horizon profile with truncation flags."
      availableNow={[
        { label: "Overview → Pole terrain: the LOLA south-pole scene with site markers", href: "/" },
        { label: "Compare → height, slope, roughness and horizon columns with evidence", href: "/compare" },
      ]}
    />
  );
}
