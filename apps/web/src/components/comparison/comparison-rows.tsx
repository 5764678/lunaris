"use client";

import type { CandidateSite } from "@lunaris/shared-types";
import { LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { CellEvidence } from "@/components/evidence/cell-evidence";
import { SiteOriginBadge } from "@/components/mission/site-origin";
import { Button } from "@/components/ui/button";
import type { CompareCell, CompareRow } from "@/lib/api/client";
import { metricCopy } from "@/lib/comparison/labels";
import { describeRowError, type CompareColumn } from "@/lib/comparison/progress";
import type { Leader } from "@/lib/comparison/summary";
import { cn } from "@/lib/utils";
import { formatLatitude, formatLongitude } from "@/lib/geo/selenographic";

/** First cell of every row: the site, which stays in view while the metrics scroll sideways. */
function SiteHeaderCell({
  name,
  latitude,
  longitude,
  badge,
}: {
  name: string;
  latitude: number;
  longitude: number;
  badge: ReactNode;
}) {
  return (
    <th scope="row" className="sticky left-0 z-10 bg-panel px-2 py-1.5 align-top font-normal">
      <span className="flex items-center gap-1.5 text-2xs text-foreground">
        <span className="max-w-36 truncate">{name}</span>
      </span>
      <span className="numeric block font-mono text-3xs text-dim">
        {formatLatitude(latitude, 2)} {formatLongitude(longitude, 2)}
      </span>
      <span className="mt-0.5 inline-block">{badge}</span>
    </th>
  );
}

/** A site whose numbers have arrived. */
export function ReadyRow({
  row,
  columns,
  leaders,
}: {
  row: CompareRow;
  columns: readonly CompareColumn[];
  /** Column leaders from the summary (T-18); empty until it has answered. */
  leaders?: ReadonlyMap<string, Leader>;
}) {
  return (
    <tr className="border-b border-hairline last:border-b-0" data-testid="compare-row">
      <SiteHeaderCell
        name={row.name}
        latitude={row.latitude_deg}
        longitude={row.longitude_deg}
        badge={
          <SiteOriginBadge
            site={{ origin: row.origin, reference: null } as Parameters<typeof SiteOriginBadge>[0]["site"]}
          />
        }
      />
      {columns.map((c) => {
        const cell = (row as unknown as Record<string, CompareCell | undefined>)[c.key];
        const copy = metricCopy(c.key, c.label, c.description);
        const leader = leaders?.get(c.key);
        const leads = leader?.siteIds.has(row.site_id) ?? false;
        return (
          <td
            key={c.key}
            className={cn("max-w-44 px-1 py-1 align-top", leads && "bg-primary/10")}
            data-leader={leads ? "true" : undefined}
          >
            {cell ? (
              <CellEvidence
                cell={cell}
                label={`${row.name} · ${copy.label}`}
                meaning={copy.tip}
                testId={`cell-${c.key}`}
              />
            ) : (
              <span className="font-mono text-3xs text-dim italic">N/C · not in response</span>
            )}
            {leads && (
              <span className="block px-1 font-mono text-3xs text-primary" data-testid="leader-mark">
                best{leader?.tied ? " (tied)" : ""}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

/** A site still being worked out: its name is known, every number shows a spinner. */
export function PendingRow({ site, columns }: { site: CandidateSite; columns: readonly CompareColumn[] }) {
  return (
    <tr className="border-b border-hairline last:border-b-0" data-testid="compare-row-pending">
      <SiteHeaderCell
        name={site.name}
        latitude={site.coordinate.latitude_deg}
        longitude={site.coordinate.longitude_deg}
        badge={<SiteOriginBadge site={site} />}
      />
      {columns.map((c) => (
        <td key={c.key} className="max-w-44 px-1 py-1 align-top" data-testid="cell-pending">
          <span className="inline-flex px-1 py-0.5 text-dim">
            <LoaderCircle aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" />
            <span className="sr-only">Computing {metricCopy(c.key, c.label, c.description).label}</span>
          </span>
        </td>
      ))}
    </tr>
  );
}

/** A site whose request failed or timed out. The other rows are not affected. */
export function ErrorRow({
  site,
  columns,
  error,
  onRetry,
}: {
  site: CandidateSite;
  columns: readonly CompareColumn[];
  error: unknown;
  onRetry: () => void;
}) {
  const { message, detail } = describeRowError(error);
  return (
    <tr className="border-b border-hairline last:border-b-0" data-testid="compare-row-error">
      <SiteHeaderCell
        name={site.name}
        latitude={site.coordinate.latitude_deg}
        longitude={site.coordinate.longitude_deg}
        badge={<SiteOriginBadge site={site} />}
      />
      <td colSpan={columns.length} className="px-2 py-1.5 align-top">
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-2xs text-critical/90">
          <span className="inline-flex items-start gap-1.5" title={detail}>
            <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            <span>Could not work out this site. {message}</span>
          </span>
          <Button type="button" size="xs" variant="outline" onClick={onRetry} data-testid="compare-row-retry">
            <RotateCcw /> Retry
          </Button>
        </div>
      </td>
    </tr>
  );
}
