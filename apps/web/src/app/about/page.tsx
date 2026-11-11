import type { Metadata } from "next";
import Link from "next/link";

import { EvidenceTagGuide } from "@/components/evidence/evidence-badge";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "About" };

const GLOSSARY: { term: string; meaning: string }[] = [
  {
    term: "Elevation",
    meaning:
      "How high something appears above the level horizon, in degrees. 0° is level, 90° is straight up.",
  },
  {
    term: "Azimuth",
    meaning: "The compass direction, in degrees clockwise from north: 90° is east, 180° is south.",
  },
  {
    term: "Skyline",
    meaning:
      "The highest ground you can see in each compass direction from the site. Hills and crater rims raise it above level.",
  },
  {
    term: "No hills",
    meaning:
      "The same calculation with a perfectly level horizon (0°), as if the ground around the site were flat.",
  },
  {
    term: "Sunlit share",
    meaning:
      "How much of the Sun's disk is above the skyline. 100 % means the whole Sun is up; 0 % means it is hidden.",
  },
  {
    term: "Earth in view (line of sight)",
    meaning:
      "Whether Earth is above the skyline, so a straight line to it is not blocked. This is geometry only: it does not mean a radio link would work.",
  },
  {
    term: "Slope",
    meaning:
      "How steep the ground is, in degrees. 0° is flat. The slope a lander can take depends on the lander.",
  },
  {
    term: "Bumpiness",
    meaning: "Typical height of bumps across the footprint once the overall tilt is removed (RMS roughness).",
  },
  {
    term: "Footprint",
    meaning: "The patch of ground around a site that slope and bumpiness are measured over.",
  },
  {
    term: "UTC",
    meaning:
      "Coordinated Universal Time, the standard clock for space work. The Moon has no time zone, so LUNARIS shows UTC first and your own time beside it.",
  },
  {
    term: "LOLA",
    meaning:
      "The Lunar Orbiter Laser Altimeter on NASA's Lunar Reconnaissance Orbiter, which measured the height of the Moon's surface.",
  },
  {
    term: "SPICE",
    meaning:
      "NASA's toolkit (from the Navigation and Ancillary Information Facility) for the positions of the Sun, Earth and Moon.",
  },
];

export default function AboutPage() {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6">
        <header className="space-y-2">
          <p className="label-caps">About</p>
          <h1 className="text-xl font-medium text-foreground">What LUNARIS is</h1>
          <p className="text-sm leading-relaxed text-foreground/90" data-testid="about-purpose">
            LUNARIS compares candidate landing sites near the Moon&apos;s south pole by how much sunlight they
            get, when Earth is in view, and how rough the ground is. It is for mission planners, students and
            anyone asking how choosing a different site or date changes a mission.
          </p>
        </header>

        <section aria-labelledby="start-heading" className="space-y-2">
          <h2 id="start-heading" className="text-base font-medium text-foreground">
            Where to start
          </h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              On the{" "}
              <Link href="/" className="text-primary underline underline-offset-2">
                Overview
              </Link>
              , pick a site on the globe or in the list, then drag the timeline to see the Sun and Earth move.
            </li>
            <li>
              Open{" "}
              <Link href="/illumination" className="text-primary underline underline-offset-2">
                Illumination &amp; Earth
              </Link>{" "}
              for the skyline and the dates the Sun and Earth are up.
            </li>
            <li>
              Use{" "}
              <Link href="/compare" className="text-primary underline underline-offset-2">
                Compare
              </Link>{" "}
              to put three sites side by side.
            </li>
            <li>Click any number to see what it means, where it comes from and what limits it.</li>
          </ol>
        </section>

        <section aria-labelledby="trust-heading" className="space-y-2">
          <h2 id="trust-heading" className="text-base font-medium text-foreground">
            How far to trust it
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Every number is computed from NASA data: LOLA elevation maps and NAIF SPICE positions. Each one
            opens its sources, method and limits, and no overall score is shown unless you choose a mission
            profile. LUNARIS is a preliminary planning and research tool. It is <strong>not</strong> a
            certified spacecraft landing system.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The tags next to values say what kind of knowledge each one is:
          </p>
          <EvidenceTagGuide />
        </section>

        <section aria-labelledby="built-heading" className="space-y-2">
          <h2 id="built-heading" className="text-base font-medium text-foreground">
            Who made it and how
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground" data-testid="about-team">
            Built for the NASA International Space Apps Challenge (14–15 November 2026)
            {config.teamName ? ` by ${config.teamName}` : ""}. Datasets and references are listed on the{" "}
            <Link href="/data" className="text-primary underline underline-offset-2">
              Data Sources
            </Link>{" "}
            page.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground" data-testid="about-ai">
            Much of the code was written with AI coding assistants (Anthropic&apos;s Claude) under human
            direction and review. Results are trusted because they are tested and checked against published
            references, not because of who or what wrote the code.
          </p>
        </section>

        <section aria-labelledby="glossary-heading" className="space-y-2">
          <h2 id="glossary-heading" className="text-base font-medium text-foreground">
            Glossary
          </h2>
          <dl className="divide-y divide-hairline" data-testid="glossary">
            {GLOSSARY.map((g) => (
              <div key={g.term} className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4">
                <dt className="text-sm font-medium text-foreground">{g.term}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
