"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { DatasetAvailabilityPill } from "@/components/data/dataset-status";
import { useShippedTextures } from "@/components/data/use-shipped-textures";
import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { describeError } from "@/lib/api/client";
import { useDatasetsQuery } from "@/lib/api/queries";

import { PanelSection } from "./panel-section";

export function DataSourcesCard() {
  const datasets = useDatasetsQuery();
  const textures = useShippedTextures();

  return (
    <PanelSection
      id="data-sources"
      title="Data sources"
      aside={
        <Link
          href="/data"
          className="flex items-center gap-0.5 text-3xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Registry <ArrowUpRight className="size-3" />
        </Link>
      }
    >
      {datasets.isPending ? (
        <div className="space-y-1.5">
          <Skeleton className="h-7" />
          <Skeleton className="h-7" />
          <Skeleton className="h-7" />
        </div>
      ) : datasets.isError ? (
        <p role="alert" className="text-2xs text-critical/90">
          {describeError(datasets.error)}
        </p>
      ) : (
        <ul className="space-y-2" data-testid="data-source-list">
          {datasets.data.datasets.map((dataset) => (
            <li key={dataset.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-2xs text-foreground" title={dataset.title}>
                  {dataset.title}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5">
                  <EvidenceBadge kind={dataset.evidence_kind} />
                  <span className="truncate text-3xs text-dim">{dataset.provider}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <DatasetAvailabilityPill dataset={dataset} shippedTextureIds={textures.ids} />
                <span className="text-3xs text-dim" title={dataset.url_verification.note}>
                  {dataset.url_verification.status === "verified"
                    ? `URLs verified ${dataset.url_verification.checked_on ?? ""}`
                    : "URLs unverified"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
