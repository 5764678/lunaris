"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useShippedTextures } from "@/components/data/use-shipped-textures";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDatasetsQuery } from "@/lib/api/queries";
import { describeDataSummary, summarizeDatasets, type DataSummary } from "@/lib/datasets/availability";
import { cn } from "@/lib/utils";

type ChipState = "loading" | "unavailable" | "partial" | "ready";

const LOOK: Record<ChipState, { dot: string; text: string }> = {
  loading: { dot: "bg-dim", text: "text-dim" },
  unavailable: { dot: "bg-critical", text: "text-critical" },
  partial: { dot: "bg-warn", text: "text-warn" },
  ready: { dot: "bg-ok", text: "text-ok" },
};

/**
 * Top-bar data indicator: "n/m ready", green when every dataset can be used. A dataset is ready
 * when it is downloaded to the server, streamed from NASA on demand, or (the globe texture)
 * shipped with the web app. The tooltip says which is which and names anything not ready.
 */
export function DataStatusIndicator() {
  const { data, isError } = useDatasetsQuery();
  const textures = useShippedTextures();
  const summary = useMemo(
    () => (data ? summarizeDatasets(data.datasets, textures.ids) : null),
    [data, textures.ids],
  );

  // Wait for the texture lookup too, so the chip never flashes "not ready" and then turns green.
  const state: ChipState = isError
    ? "unavailable"
    : !summary || !textures.settled
      ? "loading"
      : summary.total > 0 && summary.ready === summary.total
        ? "ready"
        : "partial";
  const look = LOOK[state];
  const label =
    state === "unavailable"
      ? "unavailable"
      : state === "loading" || !summary
        ? "—"
        : `${summary.ready}/${summary.total} ready`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/data"
          data-testid="data-status"
          data-state={state}
          className="hidden h-9 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-panel px-2.5 outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/50 md:flex"
        >
          <span className={cn("size-1.5 rounded-full", look.dot)} aria-hidden="true" />
          <span className="label-caps text-muted-foreground">Data</span>
          <span className={cn("numeric text-2xs font-medium", look.text)}>{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        {state === "unavailable" ? (
          <p>The dataset list could not be loaded. Open the data page to try again.</p>
        ) : state === "loading" || !summary ? (
          <p>Checking which datasets are available…</p>
        ) : (
          <DataDetails summary={summary} />
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function DataDetails({ summary }: { summary: DataSummary }) {
  const { headline, where, notReady } = describeDataSummary(summary);
  return (
    <div className="space-y-1.5">
      <p className="text-foreground">{headline}</p>
      {where.length > 0 && (
        <ul className="text-muted-foreground">
          {where.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {notReady.length > 0 && (
        <ul className="text-warn">
          {notReady.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className="text-dim">Click to see every dataset and where it comes from.</p>
    </div>
  );
}
