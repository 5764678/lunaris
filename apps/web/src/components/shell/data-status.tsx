"use client";

import Link from "next/link";

import { useDatasetsQuery } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

/** Compact "acquired / downloadable" dataset indicator for the top bar. Remote-window
 * datasets are read over HTTP and never acquired, so they are not counted. */
export function DataStatusIndicator() {
  const { data, isError, isPending } = useDatasetsQuery();
  const acquired = data?.datasets.filter((d) => d.local.status === "acquired").length ?? 0;
  const total = data?.datasets.filter((d) => d.local.status !== "remote_window").length ?? 0;
  const tone = isError
    ? "text-critical"
    : isPending
      ? "text-dim"
      : acquired === total && total > 0
        ? "text-ok"
        : "text-warn";

  return (
    <Link
      href="/data"
      data-testid="data-status"
      className="hidden h-7 items-center gap-2 rounded-md border border-border bg-panel px-2.5 outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/50 md:flex"
    >
      <span className="label-caps text-muted-foreground">Data</span>
      <span className={cn("numeric font-mono text-2xs", tone)}>
        {isError ? "unavailable" : isPending ? "—" : `${acquired}/${total} acquired`}
      </span>
    </Link>
  );
}
