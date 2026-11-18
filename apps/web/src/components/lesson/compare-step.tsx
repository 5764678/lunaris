"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/lib/i18n";
import {
  cellOf,
  isPriority,
  otherMetrics,
  outOf100,
  ROLES,
  ROLE_METRICS,
  VARIANTS,
  type Variant,
} from "@/lib/lesson/compare";
import { loadComparison } from "@/lib/lesson/pack";
import type { SiteComparison } from "@/lib/lesson/types";
import { cn } from "@/lib/utils";

import { EvidenceChip, EvidenceDetails, EvidenceCell } from "./evidence-parts";
import { usePackResource } from "./use-lesson-pack";

const BTN = "h-11 px-4 text-sm";
const utcDay = (iso: string) => iso.slice(0, 10);

/** Period 5: compare the three demo sites by role, then examine the app's recommendation as a claim. */
export function CompareStep() {
  const t = useT().learn;
  const [variant, setVariant] = useState<Variant>("default");
  const { state, reload } = usePackResource(`compare:${variant}`, () => loadComparison(variant));

  return (
    <div className="space-y-5" data-testid="compare-lesson">
      <p className="text-sm leading-relaxed text-muted-foreground">{t.compare.intro}</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{t.compare.missionHeading}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t.compare.missionHelp}</p>
        <div
          role="radiogroup"
          aria-label={t.compare.missionHeading}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {VARIANTS.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={variant === v}
              data-testid={`variant-${v}`}
              onClick={() => setVariant(v)}
              className={cn(
                "min-h-11 rounded-md border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                variant === v
                  ? "border-primary bg-accent text-foreground"
                  : "border-border bg-panel text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {t.compare.variants[v]}
            </button>
          ))}
        </div>
      </section>

      {state.status === "loading" && (
        <p role="status" className="text-sm text-muted-foreground">
          {t.compare.loading}
        </p>
      )}
      {state.status === "error" && (
        <div role="alert" className="space-y-2 rounded-md border border-critical p-3 text-sm">
          <p className="font-medium text-critical">{t.pack.error}</p>
          <p lang="en" className="text-muted-foreground">
            {state.message}
          </p>
          <Button type="button" variant="outline" className={BTN} onClick={reload}>
            {t.pack.retry}
          </Button>
        </div>
      )}
      {state.status === "ready" && <ComparisonBody comparison={state.data} />}
    </div>
  );
}

function siteName(t: Messages["learn"]["compare"], name: string): string {
  return t.siteNames[name] ?? name;
}

function ComparisonBody({ comparison }: { comparison: SiteComparison }) {
  const t = useT().learn.compare;
  const columnByKey = new Map(comparison.columns.map((c) => [c.key, c]));
  const metricLabel = (key: string) =>
    (t.metrics as Record<string, string>)[key] ?? columnByKey.get(key)?.label ?? key;
  const better = (key: string) => {
    const dir = columnByKey.get(key)?.better;
    return dir === "lower" ? t.better.lower : dir === "higher" ? t.better.higher : t.better.none;
  };
  const rec = comparison.summary.recommendation;

  const table = (keys: readonly string[], testId?: string) => (
    <div className="overflow-x-auto rounded-md border border-border" data-testid={testId}>
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <caption className="sr-only">{t.tableCaption}</caption>
        <thead>
          <tr className="border-b border-border bg-panel text-left text-muted-foreground">
            <th scope="col" className="px-2 py-2 font-medium">
              {t.siteHeader}
            </th>
            {keys.map((k) => (
              <th key={k} scope="col" className="px-2 py-2 align-top font-medium">
                <span className="block text-foreground">{metricLabel(k)}</span>
                <span className="block font-normal">{better(k)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={row.site_id} className="border-b border-hairline last:border-b-0" data-site={row.name}>
              <th scope="row" className="px-2 py-2 text-left align-top font-medium text-foreground">
                {siteName(t, row.name)}
              </th>
              {keys.map((k) => {
                const cell = cellOf(row, k);
                return (
                  <td key={k} className="px-1 py-1 align-top">
                    {cell ? (
                      <EvidenceCell
                        cell={cell}
                        label={`${siteName(t, row.name)} · ${metricLabel(k)}`}
                        testId={`cell-${row.name}-${k}`}
                      />
                    ) : (
                      <span className="px-2 text-dim">–</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t.periodNote(utcDay(comparison.start_utc), utcDay(comparison.end_utc))}
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">{t.tableHeading}</h2>
        <p className="text-sm text-muted-foreground">{t.pressForEvidence}</p>
        {ROLES.map((role) => (
          <div key={role} className="space-y-1.5" data-testid={`role-${role}`}>
            <h3 className="font-semibold text-foreground">{t.roles[role]}</h3>
            {table(ROLE_METRICS[role])}
          </div>
        ))}
        <details className="rounded-md border border-border bg-panel p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">{t.moreHeading}</summary>
          <div className="mt-2">{table(otherMetrics(comparison), "more-metrics")}</div>
        </details>
      </section>

      <section className="space-y-2 rounded-md border border-border bg-panel p-3">
        <h2 className="font-semibold text-foreground">{t.verdictHeading}</h2>
        <p lang="en" data-testid="verdict" className="text-sm leading-relaxed text-foreground">
          {comparison.summary.verdict}
        </p>
        <p className="text-sm text-muted-foreground">{t.verdictNote}</p>
      </section>

      {rec && (
        <section
          data-testid="recommendation"
          className="space-y-3 rounded-md border border-ev-assumption p-3"
        >
          <h2 className="text-lg font-semibold text-foreground">{t.claimHeading}</h2>
          <p data-testid="claim-note" className="text-sm leading-relaxed text-foreground">
            {t.claimNote}
          </p>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t.recommended}</dt>
              <dd data-testid="rec-site" className="text-lg font-semibold text-foreground">
                {siteName(t, rec.name ?? "–")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.runnerUp}</dt>
              <dd data-testid="rec-runner-up" className="text-foreground">
                {siteName(t, rec.ranking.find((r) => r.site_id === rec.runner_up_site_id)?.name ?? "–")}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t.score}</dt>
              <dd className="text-foreground">
                <ul className="space-y-0.5" data-testid="rec-scores">
                  {rec.ranking.map((r) => (
                    <li key={r.site_id} className="numeric">
                      {siteName(t, r.name)}: <strong>{outOf100(r.score ?? 0)}</strong>
                    </li>
                  ))}
                </ul>
                <span className="mt-1 block text-muted-foreground">
                  {t.scoreNote} <EvidenceChip kind="assumption" />
                </span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t.margin}</dt>
              <dd data-testid="rec-confidence" data-confidence={rec.confidence} className="text-foreground">
                <span className="numeric">{rec.margin === null ? "–" : (rec.margin * 100).toFixed(1)}</span> ·{" "}
                {t.confidence[rec.confidence as "clear" | "narrow"] ?? rec.confidence}
              </dd>
            </div>
          </dl>

          <div className="space-y-1.5" data-testid="rec-weights">
            <h3 className="font-semibold text-foreground">
              {t.weightsHeading} <EvidenceChip kind="assumption" testId="weights-evidence" />
            </h3>
            <ul className="space-y-0.5 text-sm text-foreground">
              {rec.needs.map((n) => (
                <li key={n.need} className="numeric">
                  {t.needs[n.need as "power" | "comms" | "landing"] ?? n.label}:{" "}
                  {isPriority(n.priority) ? t.priorities[n.priority] : n.priority} ·{" "}
                  {(n.weight * 100).toFixed(0)} %
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">{t.weightsNote}</p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-foreground">{t.reasonsHeading}</h3>
            <ul
              lang="en"
              data-testid="rec-reasons"
              className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground"
            >
              {rec.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5" data-testid="rec-tradeoffs">
            <h3 className="font-semibold text-foreground">{t.tradeoffsHeading}</h3>
            {rec.tradeoffs.length > 0 ? (
              <ul lang="en" className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                {rec.tradeoffs.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t.noTradeoffs}</p>
            )}
          </div>

          {rec.robustness && (
            <div className="space-y-1.5" data-testid="rec-robustness">
              <h3 className="font-semibold text-foreground">{t.robustnessHeading}</h3>
              <p lang="en" className="text-sm leading-relaxed text-foreground">
                {rec.robustness.statement}
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">{t.generatedEnglish}</p>

          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">{t.evidenceFold}</summary>
            <div className="mt-2">
              <EvidenceDetails evidence={rec.evidence} limitations={[]} />
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
