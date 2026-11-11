import Link from "next/link";

import { PanelSection } from "./panel-section";

/**
 * First thing on the Overview: what the tool is, who it is for, and where to start. Plain words,
 * no codes. The About page carries the longer version and the glossary.
 */
export function IntroCard() {
  return (
    <PanelSection id="intro" title="What this is">
      <p className="text-xs leading-relaxed text-foreground" data-testid="intro-purpose">
        Compare candidate landing sites near the Moon&apos;s south pole by sunlight, Earth contact and
        terrain. Built for mission planners, students and anyone asking how a different site or date changes a
        mission.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Start here:</span> pick a site below or on the globe,
        then drag the timeline. Click any number to see where it comes from.{" "}
        <Link href="/about" className="text-primary underline underline-offset-2">
          About &amp; glossary
        </Link>
      </p>
    </PanelSection>
  );
}
