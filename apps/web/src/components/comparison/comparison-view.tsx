"use client";

import type { CandidateSite } from "@lunaris/shared-types";
import type { UseQueryResult } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorRow, PendingRow, ReadyRow } from "@/components/comparison/comparison-rows";
import { ComparisonSummaryPanel, type SummaryState } from "@/components/comparison/comparison-summary";
import { CatalogDemoTrio } from "@/components/mission/catalog-demo-trio";
import { Button } from "@/components/ui/button";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import type { MissionAnswers, SiteComparison } from "@/lib/api/client";
import { useComparisonSummary, useSiteCatalog, useSiteComparisons, useSitesQuery } from "@/lib/api/queries";
import { formatPeriodUtc, metricCopy, metricTitle } from "@/lib/comparison/labels";
import { DEFAULT_MISSION } from "@/lib/comparison/mission";
import { columnsFor, countProgress, progressMessage, rowStatus } from "@/lib/comparison/progress";
import { directionNote, leadersByColumn } from "@/lib/comparison/summary";
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
  // One request per site, so rows appear as they are ready. Rows follow the order of the site buttons.
  const shown = registered.filter((s) => selected.includes(s.id));
  const comparisons = useSiteComparisons(shown.map((s) => s.id));
  const entries = shown.flatMap((site, i) => {
    const query = comparisons[i];
    return query ? [{ site, query }] : [];
  });

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

      {entries.length > 0 && <ComparisonTable entries={entries} />}
    </div>
  );
}

interface Entry {
  site: CandidateSite;
  query: UseQueryResult<SiteComparison, Error>;
}

function ComparisonTable({ entries }: { entries: Entry[] }) {
  // A one-site request answers with that site's row.
  const rows = entries.map(({ site, query }) => query.data?.rows.find((r) => r.site_id === site.id));
  const statuses = entries.map(({ query }, i) =>
    rowStatus({ data: query.data, row: rows[i], isFetching: query.isFetching, isError: query.isError }),
  );
  const progress = countProgress(statuses);
  const pending = progress.total - progress.ready - progress.failed;
  // The window, columns and assumptions are the same in every answer, so the first one will do.
  const first = entries.find(({ query }) => query.data)?.query.data;
  const columns = columnsFor(first);

  // The summary needs every site in one request; it is asked once every row is ready, after the
  // rows. The API recomputes the rows for it today; fast once the API's row cache lands.
  const [mission, setMission] = useState<MissionAnswers>(DEFAULT_MISSION);
  const allReady = progress.total > 0 && progress.ready === progress.total;
  const summaryQuery = useComparisonSummary(
    entries.map(({ site }) => site.id),
    mission,
    allReady,
  );
  const summary = allReady ? summaryQuery.data?.summary : undefined;
  const leaders = leadersByColumn(summary);
  const summaryState: SummaryState =
    entries.length < 2
      ? { kind: "too-few" }
      : !allReady
        ? progress.failed > 0
          ? { kind: "incomplete" }
          : { kind: "waiting" }
        : summary
          ? { kind: "ready", summary, scoring: summaryQuery.isFetching }
          : summaryQuery.isError
            ? { kind: "error", error: summaryQuery.error, retry: () => void summaryQuery.refetch() }
            : { kind: "loading" };

  return (
    <section aria-label="Comparison table" aria-busy={pending > 0} className="space-y-2">
      {pending > 0 && (
        <p role="status" className="text-3xs text-dim" data-testid="compare-progress">
          {progressMessage(progress)}
        </p>
      )}
      {first && (
        <p
          className="text-3xs text-dim"
          data-testid="compare-window"
          title={`Exact window: ${first.start_utc} → ${first.end_utc}`}
        >
          Dates {formatPeriodUtc(first.start_utc, first.end_utc)} · one reading every {first.step_s / 3600} h
          · viewpoint {first.observer_height_m} m above ground · footprint radius {first.footprint_radius_m} m
          · {first.sample_count.toLocaleString("en-US")} readings
        </p>
      )}
      <ComparisonSummaryPanel
        state={summaryState}
        columns={columns}
        mission={mission}
        onMission={setMission}
      />
      <HorizontalScroll label="Comparison table (scrolls sideways)" testId="compare-scroll">
        <table className="w-max min-w-full border-collapse text-left" data-testid="compare-table">
          <thead>
            <tr className="border-b border-hairline bg-panel-sunken/60">
              <th scope="col" className="sticky left-0 z-10 bg-panel px-2 py-1.5 align-bottom label-caps">
                Site
              </th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  title={`${metricTitle(c.key, c.label, c.description)}${c.better_rationale ? ` Ranking: ${c.better_rationale}` : ""}`}
                  data-better={c.better ?? "none"}
                  className="px-2 py-1.5 align-bottom text-3xs font-medium text-muted-foreground"
                >
                  <span className="block max-w-28 whitespace-normal">
                    {metricCopy(c.key, c.label, c.description).label}
                  </span>
                  <span className="text-dim">({UNIT_LABEL[c.unit] ?? c.unit})</span>
                  {first && (
                    <span className="block font-normal text-dim" data-testid={`col-direction-${c.key}`}>
                      {directionNote(c)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(({ site, query }, i) => {
              const row = rows[i];
              if (statuses[i] === "ready" && row)
                return <ReadyRow key={site.id} row={row} columns={columns} leaders={leaders} />;
              if (statuses[i] === "error") {
                const error = query.error ?? new Error("The server answered without a row for this site.");
                return (
                  <ErrorRow
                    key={site.id}
                    site={site}
                    columns={columns}
                    error={error}
                    onRetry={() => void query.refetch()}
                  />
                );
              }
              return <PendingRow key={site.id} site={site} columns={columns} />;
            })}
          </tbody>
        </table>
      </HorizontalScroll>
      {first && first.assumptions.length > 0 && (
        <ul className="space-y-0.5 text-3xs text-dim">
          {first.assumptions.map((a) => (
            <li key={a}>Assumption: {a}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
