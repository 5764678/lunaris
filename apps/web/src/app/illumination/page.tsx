import type { Metadata } from "next";

import { PageInProgress } from "@/components/shell/page-in-progress";

export const metadata: Metadata = { title: "Illumination & Earth" };

/** Placeholder until the Illumination & Earth page (T-27) lands. */
export default function IlluminationPage() {
  return (
    <PageInProgress
      title="Illumination & Earth"
      task="T-27"
      coming="Per-site Sun and Earth geometry over a window: elevation against the astronomical and terrain horizons, visible-disk fractions, sunlit and direct-to-Earth windows."
      availableNow={[
        {
          label:
            "Overview → timeline: Sun/Earth elevation, illumination and line-of-sight lanes (select a site)",
          href: "/",
        },
        {
          label: "Overview → Pole terrain: the terrain lit by the SPICE Sun, with the site's computed value",
          href: "/",
        },
        { label: "Compare → illumination and Earth-visibility columns with evidence", href: "/compare" },
      ]}
    />
  );
}
