"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { CellEvidence } from "@/components/evidence/cell-evidence";
import { CatalogDemoTrio } from "@/components/mission/catalog-demo-trio";
import { SiteOriginBadge } from "@/components/mission/site-origin";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { describeError, type CompareCell, type CompareRow } from "@/lib/api/client";
import { useSiteCatalog, useSiteComparison, useSitesQuery } from "@/lib/api/queries";
import { formatLatitude, formatLongitude } from "@/lib/geo/selenographic";
import { cn } from "@/lib/utils";

const MAX_SITES = 10;
const UNIT_LABEL: Record<string, string> = { m: "m", deg: "°", fraction: "%", s: "h / d", count: "count" };

export function ComparisonView() {
  const sites = useSitesQuery();
  const catalog = useSiteCatalog();
  const [chosen, setChosen] = useState<string[] | null>(null);

  const registered = useMemo(() => sites.data?.sites ?? [], [sites.data]);
  const demoIds = useMemo(() => {
    const names = new Set(
      (catalog.data?.sites ?? []).filter((s) => s.demo_trio).map((s) => s.name.toLowerCase()),
    );
    return registered.filter((s) => names.has(s.name.toLowerCase())).map((s) => s.id);
  }, [catalog.data, registered]);

  // Default: the cited demo trio, once registered. The user can toggle any registered site.
  const selected = (chosen ?? demoIds).filter((id) => registered.some((s) => s.id === id));
  const comparison = useSiteComparison(selected);

  function toggle(id: string) {
    const base = chosen ?? demoIds;
    setChosen(base.includes(id) ? base.filter((x) => x !== id) : [...base, id].slice(0, MAX_SITES));
  }

  return (
    <div className="space-y-4">
      {demoIds.length < 3 && <CatalogDemoTrio />}

      <section aria-label="Sites to compare" className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="label-caps">
            Sites · {selected.length}/{MAX_SITES}
          </p>
          {chosen !== null && (
            <Button size="xs" variant="ghost" onClick={() => setChosen(null)}>
              <RotateCcw /> Demo sites
            </Button>
          )}
        </div>
        {registered.length === 0 ? (
          <p className="text-2xs text-dim">No registered sites. Add the cited demo sites above.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5" data-testid="compare-site-picker">
            {registered.map((s) => {
              const on = selected.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s.id)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-2xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    on
                      ? "border-primary-strong/50 bg-accent/70 text-foreground"
                      : "border-border text-muted-foreground hover:bg-panel-raised",
                  )}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected.length === 0 ? null : comparison.isError ? (
        <div
          role="alert"
          className="rounded-md border border-critical/25 bg-critical/5 p-3 text-2xs text-critical/90"
        >
          Comparison unavailable: {describeError(comparison.error)}
        </div>
      ) : !comparison.data ? (
        <div className="space-y-2" aria-label="Computing comparison">
          <p className="font-mono text-3xs text-dim">
            Computing the comparison (DEM windows, horizon masks, a year of hourly geometry)… first run takes
            seconds per site.
          </p>
          <Skeleton className="h-28" />
        </div>
      ) : (
        <ComparisonTable data={comparison.data} />
      )}
    </div>
  );
}

function ComparisonTable({ data }: { data: NonNullable<ReturnType<typeof useSiteComparison>["data"]> }) {
  return (
    <section aria-label="Comparison table" className="space-y-2">
      <p className="font-mono text-3xs text-dim" data-testid="compare-window">
        Window {data.start_utc} → {data.end_utc} · step {data.step_s / 3600} h · observer height{" "}
        {data.observer_height_m} m · footprint radius {data.footprint_radius_m} m · {data.sample_count}{" "}
        samples
      </p>
      <div
        className="overflow-x-auto rounded-md border border-hairline scrollbar-thin"
        data-testid="compare-scroll"
      >
        <table className="w-max min-w-full border-collapse text-left" data-testid="compare-table">
          <thead>
            <tr className="border-b border-hairline bg-panel-sunken/60">
              <th scope="col" className="sticky left-0 z-10 bg-panel px-2 py-1.5 align-bottom label-caps">
                Site
              </th>
              {data.columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  title={c.description}
                  className="px-2 py-1.5 align-bottom font-mono text-3xs font-medium text-muted-foreground"
                >
                  <span className="block max-w-28 whitespace-normal">{c.label}</span>
                  <span className="text-dim">({UNIT_LABEL[c.unit] ?? c.unit})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={row.site_id}
                className="border-b border-hairline last:border-b-0"
                data-testid="compare-row"
              >
                <th scope="row" className="sticky left-0 z-10 bg-panel px-2 py-1.5 align-top font-normal">
                  <span className="flex items-center gap-1.5 text-2xs text-foreground">
                    <span className="max-w-36 truncate">{row.name}</span>
                  </span>
                  <span className="numeric block font-mono text-3xs text-dim">
                    {formatLatitude(row.latitude_deg, 2)} {formatLongitude(row.longitude_deg, 2)}
                  </span>
                  <OriginBadge row={row} />
                </th>
                {data.columns.map((c) => {
                  const cell = (row as unknown as Record<string, CompareCell | undefined>)[c.key];
                  return (
                    <td key={c.key} className="max-w-44 px-1 py-1 align-top">
                      {cell ? (
                        <CellEvidence
                          cell={cell}
                          label={`${row.name} · ${c.label}`}
                          testId={`cell-${c.key}`}
                        />
                      ) : (
                        <span className="font-mono text-3xs text-dim italic">N/C · not in response</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.assumptions.length > 0 && (
        <ul className="space-y-0.5 text-3xs text-dim">
          {data.assumptions.map((a) => (
            <li key={a}>Assumption: {a}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OriginBadge({ row }: { row: CompareRow }) {
  return (
    <span className="mt-0.5 inline-block">
      <SiteOriginBadge
        site={{ origin: row.origin, reference: null } as Parameters<typeof SiteOriginBadge>[0]["site"]}
      />
    </span>
  );
}
