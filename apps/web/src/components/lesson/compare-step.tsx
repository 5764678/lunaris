"use client";

import { useCallback, useState } from "react";

import { useLanguage } from "@/lib/i18n";
import { formatUtcDate, points, secondsToDays } from "@/lib/lesson/format";
import { loadComparison, loadPackIndex } from "@/lib/lesson/pack";
import {
  COMPARE_VARIANTS,
  type CompareVariant,
  type Evidence,
  type PackIndex,
  type Recommendation,
  type SiteComparison,
} from "@/lib/lesson/types";
import { cn } from "@/lib/utils";

import { PackGate } from "./pack-gate";
import { KIND_COLOUR, PackBanner } from "./pack-provenance";
import { usePackResource } from "./use-pack-resource";

/** The seven values the period 5 worksheet collects, by role (worksheet 3, part 1). */
const TABLE_KEYS = [
  "slope_at_site_deg",
  "roughness_rms_m",
  "sun_illuminated_fraction",
  "sun_longest_hidden_s",
  "sun_longest_visible_s",
  "earth_visible_fraction",
  "earth_longest_outage_s",
] as const;

interface CompareData {
  index: PackIndex;
  comparisons: Record<CompareVariant, SiteComparison>;
}

/** Period 5: three sites compared, the mission's needs chosen, the recommendation examined as a claim. */
export function CompareStep() {
  const load = useCallback(async (): Promise<CompareData> => {
    const index = await loadPackIndex();
    const loaded = await Promise.all(COMPARE_VARIANTS.map((v) => loadComparison(index, v)));
    const comparisons = Object.fromEntries(COMPARE_VARIANTS.map((v, i) => [v, loaded[i]])) as Record<
      CompareVariant,
      SiteComparison
    >;
    return { index, comparisons };
  }, []);
  const { state, reload } = usePackResource(load);
  return (
    <PackGate state={state} reload={reload}>
      {(data) => <CompareLesson data={data} />}
    </PackGate>
  );
}

type Cell = SiteComparison["rows"][number]["slope_at_site_deg"];

function formatCell(
  cell: Cell,
  unit: string,
  t: ReturnType<typeof useLanguage>["t"]["learn"]["compare"],
): string {
  const v = cell.value;
  if (v === null || v === undefined) return "–";
  if (unit === "fraction") return `${(v * 100).toFixed(1)} %`;
  if (unit === "s") return `${secondsToDays(v).toFixed(1)} ${t.units.days}`;
  if (unit === "deg") return `${v.toFixed(1)}${t.units.deg}`;
  if (unit === "m") return `${v.toFixed(2)} ${t.units.m}`;
  return String(v);
}

function KindLabel({ kind }: { kind: Evidence["kind"] }) {
  const t = useLanguage().t.learn.compare;
  return (
    <span data-kind={kind} className={cn("text-sm", KIND_COLOUR[kind])}>
      {t.evidenceKinds[kind] ?? kind}
    </span>
  );
}

function CompareLesson({ data }: { data: CompareData }) {
  const { lang, t: messages } = useLanguage();
  const t = messages.learn.compare;
  const names = messages.learn.siteNames;
  const [variant, setVariant] = useState<CompareVariant>("default");
  const [selected, setSelected] = useState<{ siteId: string; key: string } | null>(null);
  const comparison = data.comparisons[variant];
  const base = data.comparisons.default;
  const rec = comparison.summary.recommendation;

  return (
    <div className="space-y-6" data-testid="compare-step">
      <PackBanner provenance={data.index.provenance} />

      <section className="space-y-3" aria-labelledby="mission-heading">
        <h2 id="mission-heading" className="text-lg font-semibold text-foreground">
          {t.missionHeading}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t.missionIntro}</p>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">{t.variantLabel}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {COMPARE_VARIANTS.map((v) => (
              <label
                key={v}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 text-sm focus-within:ring-2 focus-within:ring-ring/60",
                  v === variant
                    ? "border-primary bg-accent text-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                <input
                  type="radio"
                  name="mission-variant"
                  value={v}
                  checked={v === variant}
                  onChange={() => setVariant(v)}
                  data-testid={`variant-${v}`}
                  className="size-4 accent-primary"
                />
                {t.variants[v]}
              </label>
            ))}
          </div>
        </fieldset>
        <ul className="space-y-1 text-sm" data-testid="mission-answers">
          {rec.needs.map((n) => (
            <li key={n.need} className="flex flex-wrap gap-x-2">
              <span className="text-muted-foreground">
                {t.needs[n.need as keyof typeof t.needs] ?? n.label}:
              </span>
              <span className="font-medium text-foreground" data-testid={`answer-${n.need}`}>
                {t.priorities[rec.mission[n.need as "power" | "comms" | "landing"]]}
              </span>
            </li>
          ))}
        </ul>
        {variant === "default" && (
          <p className="text-sm text-muted-foreground" data-testid="default-note">
            {t.defaultNote}
          </p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="evidence-table-heading">
        <h2 id="evidence-table-heading" className="text-lg font-semibold text-foreground">
          {t.evidenceHeading}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground" data-testid="compare-window">
          {t.windowNote(formatUtcDate(base.start_utc, lang), formatUtcDate(base.end_utc, lang))}
        </p>
        <p className="text-sm text-muted-foreground">{t.tableHint}</p>
        <table className="w-full table-fixed border-collapse text-sm" data-testid="compare-table">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="w-[28%] py-2 pr-2 font-medium">
                {t.colMeasure}
              </th>
              {base.rows.map((r) => (
                <th key={r.site_id} scope="col" className="py-2 pr-2 font-medium">
                  {names[r.name] ?? r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TABLE_KEYS.map((key) => {
              const column = base.columns.find((c) => c.key === key);
              if (!column) return null;
              return (
                <tr key={key} className="border-t border-border align-top" data-measure={key}>
                  <th scope="row" className="py-2 pr-2 text-left font-normal text-foreground">
                    {t.measures[key] ?? column.label}
                    {column.better && (
                      <span className="block text-muted-foreground">{t.better[column.better]}</span>
                    )}
                  </th>
                  {base.rows.map((row) => {
                    const cell = row[key] as Cell;
                    const isSelected = selected?.siteId === row.site_id && selected.key === key;
                    return (
                      <td key={row.site_id} className="py-2 pr-2">
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelected({ siteId: row.site_id, key })}
                          data-testid={`cell-${row.site_id}-${key}`}
                          className={cn(
                            "numeric min-h-11 rounded-md border px-1.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                            isSelected
                              ? "border-primary bg-accent"
                              : "border-border hover:border-border-strong",
                          )}
                        >
                          {formatCell(cell, column.unit, t)}
                        </button>
                        {cell.evidence ? (
                          <span className="block" data-testid={`kind-${row.site_id}-${key}`}>
                            <KindLabel kind={cell.evidence.kind} />
                          </span>
                        ) : (
                          <span className="block text-muted-foreground">{cell.reason}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <EvidencePanel comparison={base} selected={selected} />
      </section>

      <ClaimCard comparison={comparison} rec={rec} />
    </div>
  );
}

function EvidencePanel({
  comparison,
  selected,
}: {
  comparison: SiteComparison;
  selected: { siteId: string; key: string } | null;
}) {
  const { t: messages } = useLanguage();
  const t = messages.learn.compare;
  const kindHeading = messages.learn.earth.evidenceKind;
  const row = selected ? comparison.rows.find((r) => r.site_id === selected.siteId) : undefined;
  const cell = row && selected ? (row[selected.key as keyof typeof row] as Cell) : undefined;
  return (
    <div
      className="space-y-2 rounded-md border border-border bg-panel p-3 text-sm leading-relaxed"
      data-testid="evidence-panel"
      aria-live="polite"
    >
      <h3 className="font-semibold text-foreground">{t.evidencePanelHeading}</h3>
      {!row || !selected || !cell ? (
        <p className="text-muted-foreground">{t.evidencePanelEmpty}</p>
      ) : !cell.evidence ? (
        <p className="text-muted-foreground">{cell.reason}</p>
      ) : (
        <>
          <p className="text-foreground">
            {t.evidenceSelected(
              messages.learn.siteNames[row.name] ?? row.name,
              t.measures[selected.key] ?? selected.key,
            )}
          </p>
          <p>
            <span className="text-muted-foreground">{kindHeading}: </span>
            <span data-testid="panel-kind">
              <KindLabel kind={cell.evidence.kind} />
            </span>
          </p>
          <p className="text-dim">{t.englishNote}</p>
          <p lang="en" className="text-muted-foreground" data-testid="panel-statement">
            {cell.evidence.statement}
          </p>
          {cell.evidence.method && (
            <p lang="en" className="text-muted-foreground">
              {cell.evidence.method}
            </p>
          )}
          {cell.evidence.sources.length > 0 && (
            <div>
              <p className="font-medium text-foreground">{t.sources}</p>
              <ul
                lang="en"
                className="list-disc space-y-0.5 pl-5 text-muted-foreground"
                data-testid="panel-sources"
              >
                {cell.evidence.sources.map((s) => (
                  <li key={s.source_id}>{s.title}</li>
                ))}
              </ul>
            </div>
          )}
          {cell.limitations.length > 0 && (
            <ul
              lang="en"
              className="list-disc space-y-0.5 pl-5 text-muted-foreground"
              data-testid="panel-limitations"
            >
              {cell.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ClaimCard({ comparison, rec }: { comparison: SiteComparison; rec: Recommendation }) {
  const messages = useLanguage().t.learn;
  const t = messages.compare;
  const names = messages.siteNames;
  const top = rec.ranking.find((e) => e.site_id === rec.site_id);
  const standing = comparison.summary.sites.find((s) => s.site_id === rec.site_id);
  return (
    <section
      className="space-y-4 rounded-md border border-primary p-4 text-sm leading-relaxed"
      aria-labelledby="claim-heading"
      data-testid="claim"
      data-confidence={rec.confidence}
      data-site-id={rec.site_id ?? ""}
    >
      <header className="space-y-1">
        <h2 id="claim-heading" className="text-lg font-semibold text-foreground">
          {t.claimHeading}
        </h2>
        <p className="text-muted-foreground">{t.claimIntro}</p>
      </header>

      <div className="space-y-1">
        <p className="text-muted-foreground">{t.claimSite}</p>
        <p className="text-base font-semibold text-foreground" data-testid="claim-site">
          {rec.name ? (names[rec.name] ?? rec.name) : t.noPick}
        </p>
        <p className="flex flex-wrap gap-x-3 text-foreground">
          {top && typeof top.score === "number" && (
            <span className="numeric font-mono" data-testid="claim-score">
              {t.claimScore(points(top.score))}
            </span>
          )}
          <span data-testid="claim-confidence">{t.confidence[rec.confidence] ?? rec.confidence}</span>
        </p>
        <p lang="en" className="text-muted-foreground" data-testid="claim-headline">
          {rec.headline}
        </p>
      </div>

      <div className="space-y-1.5" data-testid="claim-weights">
        <h3 className="font-semibold text-foreground">
          {t.weightsHeading} <KindLabel kind={rec.evidence.kind} />
        </h3>
        <p className="text-muted-foreground">{t.weightsNote}</p>
        <ul className="space-y-0.5">
          {rec.needs.map((n) => (
            <li key={n.need} className="flex flex-wrap gap-x-2">
              <span className="text-foreground">{t.needs[n.need as keyof typeof t.needs] ?? n.label}</span>
              <span className="text-muted-foreground">
                {t.priorities[n.priority]} ·{" "}
                {n.weight === 0 ? t.weightNotCounted : t.weightShare((n.weight * 100).toFixed(0))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5" data-testid="claim-gives-up">
        <h3 className="font-semibold text-foreground">{t.givesUpHeading}</h3>
        <p className="text-muted-foreground">{t.givesUpTrails}</p>
        {standing && standing.trails.length > 0 ? (
          <ul className="list-disc pl-5 text-foreground" data-testid="claim-trails">
            {standing.trails.map((k) => (
              <li key={k}>{t.measures[k] ?? k}</li>
            ))}
          </ul>
        ) : (
          <p className="text-foreground" data-testid="claim-trails">
            {t.givesUpNone}
          </p>
        )}
        <p className="pt-1 text-muted-foreground">{t.givesUpTradeoffs}</p>
        {rec.tradeoffs.length > 0 ? (
          <ul lang="en" className="list-disc space-y-0.5 pl-5 text-foreground" data-testid="claim-tradeoffs">
            {rec.tradeoffs.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-foreground" data-testid="claim-tradeoffs">
            {t.givesUpTradeoffsNone}
          </p>
        )}
        {standing && (
          <p lang="en" className="text-muted-foreground">
            {standing.dominance}
          </p>
        )}
      </div>

      {rec.robustness && (
        <div
          className="space-y-1"
          data-testid="claim-robustness"
          data-stable={rec.robustness.flips.length === 0}
        >
          <h3 className="font-semibold text-foreground">{t.robustnessHeading}</h3>
          <p lang="en" className="text-muted-foreground">
            {rec.robustness.statement}
          </p>
        </div>
      )}

      {rec.reasons.length > 0 && (
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">{t.reasonsHeading}</h3>
          <p className="text-dim">{t.englishNote}</p>
          <ul lang="en" className="list-disc space-y-1 pl-5 text-muted-foreground">
            {rec.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1.5">
        <h3 className="font-semibold text-foreground">{t.rankingHeading}</h3>
        <ol className="space-y-2" data-testid="claim-ranking">
          {rec.ranking.map((e) => (
            <li key={e.site_id} className="rounded-md border border-border p-2" data-status={e.status}>
              <p className="text-foreground">
                <span className="numeric font-mono text-muted-foreground">{e.rank ?? "–"}</span>{" "}
                {names[e.name] ?? e.name}
                {": "}
                {typeof e.score === "number" ? (
                  <span className="numeric font-mono">{points(e.score)}</span>
                ) : (
                  <span className="text-muted-foreground">
                    {e.status === "excluded" ? t.excluded : "–"} {e.reasons.join("; ")}
                  </span>
                )}
              </p>
              <p className="text-muted-foreground">
                {rec.needs
                  .map((n) =>
                    n.weight === 0
                      ? `${t.needs[n.need as keyof typeof t.needs] ?? n.label}: ${t.weightNotCounted}`
                      : `${t.needs[n.need as keyof typeof t.needs] ?? n.label}: ${points(e.need_scores[n.need] ?? 0)}`,
                  )
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <details className="rounded-md border border-border bg-panel p-3" data-testid="claim-assumptions">
        <summary className="cursor-pointer font-medium text-foreground">{t.assumptionsFold}</summary>
        <p className="mt-2 text-dim">{t.englishNote}</p>
        <p lang="en" className="mt-1 text-muted-foreground">
          {rec.evidence.statement}
        </p>
        <ul lang="en" className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
          {rec.evidence.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p lang="en" className="mt-1 text-muted-foreground">
          {rec.method}
        </p>
      </details>

      <div className="rounded-md border border-border bg-panel p-3" data-testid="claim-checks">
        <h3 className="font-semibold text-foreground">{t.checkHeading}</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
          {t.checkQuestions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
