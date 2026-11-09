import type { Metadata } from "next";

import { TerrainAnalysis } from "./terrain-analysis";

export const metadata: Metadata = { title: "Site terrain" };

export default function TerrainPage() {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6">
        <header className="space-y-1.5">
          <p className="label-caps">Terrain intelligence · site analysis</p>
          <h1 className="text-lg font-medium text-foreground">Site terrain</h1>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Height, slope and roughness at a site from a window of the LOLA 20 m south-pole DEM. Every slope
            and roughness value states the baseline it was measured over. Hazard flags appear only for
            thresholds you enter; they are your assumptions, not LUNARIS defaults. Every value opens its
            evidence, including where the DEM window came from.
          </p>
        </header>
        <TerrainAnalysis />
      </div>
    </div>
  );
}
