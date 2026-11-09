import type { Metadata } from "next";

import { IlluminationView } from "./_components/illumination-view";

export const metadata: Metadata = { title: "Illumination & Earth visibility" };

export default function IlluminationPage() {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="space-y-4 px-4 py-5 sm:px-6">
        <header className="space-y-1.5">
          <p className="label-caps">Illumination &amp; Earth · sunlight and line of sight per site</p>
          <h1 className="text-lg font-medium text-foreground">Illumination &amp; Earth visibility</h1>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            The skyline around each site from the LOLA terrain model, with the paths of the Sun and the Earth
            across it over the chosen window, and when each one is in view. Every value is computed by the
            API; click it to see what it means, where it came from and its limits. Where the terrain horizon
            is not available the reason is shown, never 0. Earth line of sight is geometry only and does not
            imply a radio link.
          </p>
        </header>
        <IlluminationView />
      </div>
    </div>
  );
}
