import type { Metadata } from "next";

import { ComparisonView } from "@/components/comparison/comparison-view";

export const metadata: Metadata = { title: "Site comparison" };

export default function ComparePage() {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
        <header className="space-y-1.5">
          <p className="label-caps">Mission intelligence · site comparison</p>
          <h1 className="text-lg font-medium text-foreground">Candidate site comparison</h1>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            One row per site, one column per metric with its unit. Every value opens its own evidence: kind,
            method, sources with checksum or HTTP validators, and limitations. A value that cannot be computed
            shows the reason; it is never shown as 0. No score or ranking is computed.
          </p>
        </header>
        <ComparisonView />
      </div>
    </div>
  );
}
