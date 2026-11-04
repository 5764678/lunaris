"use client";

import { EvidenceLegend } from "@/components/evidence/evidence-badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import { AnalysisReadiness } from "./analysis-readiness";
import { DataSourcesCard } from "./data-sources-card";
import { PanelSection } from "./panel-section";
import { SelectedSite } from "./selected-site";
import { SiteRegistry } from "./site-registry";

export function MissionPanel() {
  return (
    <aside
      aria-label="Mission information"
      className="flex min-h-0 flex-col border-border bg-panel lg:border-l"
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <h1 className="font-mono text-2xs font-medium uppercase tracking-[0.18em] text-foreground">
          Mission workspace
        </h1>
        <span className="font-mono text-3xs text-dim">South polar survey</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <SelectedSite />
        <SiteRegistry />
        <AnalysisReadiness />
        <DataSourcesCard />
        <PanelSection id="legend" title="Evidence legend" className="border-b-0">
          <EvidenceLegend />
          <p className="mt-2 text-3xs leading-relaxed text-dim">
            Every value is tagged with what kind of knowledge it is. Placeholders and uncomputed values never
            contribute to an assessment.
          </p>
        </PanelSection>
      </ScrollArea>
    </aside>
  );
}
