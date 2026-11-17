"use client";

import { LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ComparisonSummary, MissionAnswers, Recommendation } from "@/lib/api/client";
import {
  clampLimit,
  DEFAULT_MISSION,
  isDefaultMission,
  LIMIT_QUESTIONS,
  NEED_QUESTIONS,
  parseLimit,
  points,
  PRIORITY_OPTIONS,
  type LimitId,
} from "@/lib/comparison/mission";
import { describeRowError, type CompareColumn } from "@/lib/comparison/progress";
import { leaderLabel } from "@/lib/comparison/summary";

export type SummaryState =
  | { kind: "too-few" }
  | { kind: "waiting" }
  | { kind: "incomplete" }
  | { kind: "loading" }
  | { kind: "error"; error: unknown; retry: () => void }
  | { kind: "ready"; summary: ComparisonSummary; scoring: boolean };

/**
 * T-18 summary above the table: the mission questions, the recommended site for the answers
 * (every weight, scale and limit shown as an assumption), the verdict (from leads, trails and
 * dominance only, never from weights) and each site's standing.
 */
export function ComparisonSummaryPanel({
  state,
  columns,
  mission,
  onMission,
}: {
  state: SummaryState;
  columns: readonly CompareColumn[];
  mission: MissionAnswers;
  onMission: (mission: MissionAnswers) => void;
}) {
  return (
    <section
      aria-label="Comparison summary"
      className="space-y-2 rounded-md border border-hairline bg-panel-sunken/40 p-2.5"
      data-testid="compare-summary"
      data-state={state.kind}
    >
      <p className="label-caps">Summary</p>
      {state.kind !== "too-few" && <MissionQuestions mission={mission} onMission={onMission} />}
      {state.kind === "ready" && (
        <RecommendationCard recommendation={state.summary.recommendation} scoring={state.scoring} />
      )}
      <SummaryBody state={state} columns={columns} />
    </section>
  );
}

function SummaryBody({ state, columns }: { state: SummaryState; columns: readonly CompareColumn[] }) {
  switch (state.kind) {
    case "too-few":
      return <p className="text-2xs text-dim">Select at least two sites to see which leads on what.</p>;
    case "waiting":
      return (
        <p className="text-2xs text-dim">
          Summary: computing… It appears once every site has been worked out.
        </p>
      );
    case "incomplete":
      return (
        <p className="text-2xs text-dim">
          The summary needs every selected site. Retry the sites that failed, or leave them out.
        </p>
      );
    case "loading":
      return (
        <p className="inline-flex items-center gap-1.5 text-2xs text-dim" role="status">
          <LoaderCircle aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" />
          Summary: computing…
        </p>
      );
    case "error": {
      const { message, detail } = describeRowError(state.error);
      return (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-2xs text-critical/90">
          <span className="inline-flex items-start gap-1.5" title={detail}>
            <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            <span>Could not summarise the sites. {message}</span>
          </span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={state.retry}
            data-testid="compare-summary-retry"
          >
            <RotateCcw /> Retry
          </Button>
        </div>
      );
    }
    case "ready": {
      const { summary } = state;
      return (
        <>
          <p className="text-xs text-foreground" data-testid="compare-verdict">
            {summary.verdict}
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {summary.sites.map((s) => (
              <li
                key={s.site_id}
                className="min-w-0 rounded-[4px] border border-hairline px-2 py-1.5"
                data-testid="compare-standing"
                data-site-id={s.site_id}
                data-dominated={s.dominated_by.length > 0 ? "true" : "false"}
              >
                <p className="text-2xs font-medium text-foreground">{s.name}</p>
                <p className="text-3xs text-muted-foreground" data-testid="compare-standing-leads">
                  Leads:{" "}
                  {s.leads.length > 0 ? s.leads.map((k) => leaderLabel(k, columns)).join(", ") : "none"}
                </p>
                <p className="text-3xs text-muted-foreground" data-testid="compare-standing-trails">
                  Trails:{" "}
                  {s.trails.length > 0 ? s.trails.map((k) => leaderLabel(k, columns)).join(", ") : "none"}
                </p>
                <p className="mt-0.5 text-3xs [overflow-wrap:anywhere] text-dim">{s.dominance}</p>
              </li>
            ))}
          </ul>
          <details className="text-3xs text-dim">
            <summary className="cursor-pointer select-none hover:text-foreground">
              How this is worked out
            </summary>
            <p className="mt-1" data-testid="compare-summary-method">
              {summary.method}
            </p>
          </details>
        </>
      );
    }
  }
}

function MissionQuestions({
  mission,
  onMission,
}: {
  mission: MissionAnswers;
  onMission: (mission: MissionAnswers) => void;
}) {
  return (
    <div className="space-y-2 border-b border-hairline pb-2" data-testid="compare-mission">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-caps">What does this mission need?</p>
        {isDefaultMission(mission) ? (
          <span className="text-3xs text-dim" data-testid="compare-mission-default">
            Unanswered: every need counts as important, no limits
          </span>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => onMission(DEFAULT_MISSION)}
            data-testid="compare-mission-reset"
          >
            <RotateCcw /> Reset answers
          </Button>
        )}
      </div>
      <div className="grid gap-2 lg:grid-cols-3">
        {NEED_QUESTIONS.map((q) => (
          <div key={q.id} className="space-y-1" data-testid={`compare-need-${q.id}`}>
            <p id={`compare-need-label-${q.id}`} className="text-2xs text-foreground">
              {q.question}
            </p>
            <p className="text-3xs text-dim">{q.hint}</p>
            <ToggleGroup
              type="single"
              aria-labelledby={`compare-need-label-${q.id}`}
              value={mission[q.id]}
              onValueChange={(v) => {
                if (v) onMission({ ...mission, [q.id]: v as MissionAnswers["power"] });
              }}
              className="flex-wrap"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <ToggleGroupItem key={o.id} value={o.id} data-testid={`compare-need-${q.id}-${o.id}`}>
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
      <details open={LIMIT_QUESTIONS.some((l) => mission[l.id] !== null)}>
        <summary className="cursor-pointer select-none text-3xs text-dim hover:text-foreground">
          Hard limits (optional): a site that breaks one is excluded, never just scored lower
        </summary>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LIMIT_QUESTIONS.map((limit) => (
            <LimitInput
              key={limit.id}
              id={limit.id}
              label={limit.question}
              unit={limit.unit}
              placeholder={limit.placeholder}
              value={mission[limit.id]}
              onCommit={(value) => onMission({ ...mission, [limit.id]: value })}
            />
          ))}
        </div>
      </details>
    </div>
  );
}

/** A limit is committed on blur or Enter, so a half-typed number does not refetch. */
function LimitInput({
  id,
  label,
  unit,
  placeholder,
  value,
  onCommit,
}: {
  id: LimitId;
  label: string;
  unit: string;
  placeholder: string;
  value: number | null;
  onCommit: (value: number | null) => void;
}) {
  const text = value === null ? "" : String(value);
  const [draft, setDraft] = useState(text);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(text);
  }
  const commit = () => {
    const parsed = clampLimit(id, parseLimit(draft));
    if (parsed === value) setDraft(text);
    else onCommit(parsed);
  };
  return (
    <label className="block space-y-1">
      <span className="block text-3xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <Input
          inputMode="decimal"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === "Enter" && commit()}
          data-testid={`compare-limit-${id}`}
        />
        <span className="text-3xs text-dim">{unit}</span>
      </span>
    </label>
  );
}

const CONFIDENCE: Record<Recommendation["confidence"], string> = {
  clear: "Clear lead",
  moderate: "Moderate lead",
  narrow: "Narrow lead",
  tie: "Tie",
  only_option: "Only option",
  none: "No pick",
};

function RecommendationCard({
  recommendation: rec,
  scoring,
}: {
  recommendation: Recommendation;
  scoring: boolean;
}) {
  const top = rec.ranking.find((e) => e.site_id === rec.site_id);
  return (
    <div
      className="space-y-2 rounded-md border border-primary-strong/40 bg-accent/20 p-2.5"
      data-testid="compare-recommendation"
      data-confidence={rec.confidence}
      data-site-id={rec.site_id ?? ""}
      aria-busy={scoring}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-caps">Recommended site for this mission</p>
        <span className="inline-flex items-center gap-1.5 text-3xs text-dim">
          {scoring && (
            <LoaderCircle aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" />
          )}
          weights and scales are assumptions
          <EvidenceBadge kind={rec.evidence.kind} />
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-foreground" data-testid="compare-recommendation-name">
          {rec.name ?? "No site qualifies"}
        </span>
        {top && <span className="numeric font-mono text-xs text-foreground">{points(top.score)} / 100</span>}
        <span className="rounded-[4px] border border-hairline px-1.5 py-px font-mono text-3xs uppercase text-muted-foreground">
          {CONFIDENCE[rec.confidence]}
        </span>
      </div>
      <p className="text-xs text-foreground" data-testid="compare-recommendation-headline">
        {rec.headline}
      </p>
      {rec.reasons.length + rec.tradeoffs.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="label-caps">Why</p>
            <ul className="list-disc space-y-0.5 pl-4 text-3xs text-muted-foreground">
              {rec.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label-caps">What it gives up</p>
            {rec.tradeoffs.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-4 text-3xs text-muted-foreground">
                {rec.tradeoffs.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="text-3xs text-dim">Nothing among the needs this mission weights.</p>
            )}
          </div>
        </div>
      )}
      {rec.robustness && (
        <p
          className="text-3xs text-muted-foreground"
          data-testid="compare-robustness"
          data-stable={rec.robustness.flips.length === 0 ? "true" : "false"}
        >
          {rec.robustness.statement}
        </p>
      )}
      {rec.caveats.map((c) => (
        <p key={c} className="text-3xs text-dim">
          {c}
        </p>
      ))}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-3xs" data-testid="compare-ranking">
          <thead>
            <tr className="border-b border-hairline text-dim">
              <th scope="col" className="px-1.5 py-1 font-medium">
                #
              </th>
              <th scope="col" className="px-1.5 py-1 font-medium">
                Site
              </th>
              <th scope="col" className="px-1.5 py-1 font-medium">
                Mission fit (0–100)
              </th>
              {rec.needs.map((n) => (
                <th
                  key={n.need}
                  scope="col"
                  className={`px-1.5 py-1 font-medium ${n.weight === 0 ? "opacity-50" : ""}`}
                >
                  {n.label}
                  <span className="block font-normal">
                    {n.weight === 0 ? "not counted" : `${(n.weight * 100).toFixed(0)} % of the score`}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rec.ranking.map((e) => (
              <tr
                key={e.site_id}
                className="border-b border-hairline last:border-b-0"
                data-testid="compare-ranking-entry"
                data-status={e.status}
              >
                <td className="px-1.5 py-1 font-mono text-dim">{e.rank ?? "–"}</td>
                <th scope="row" className="px-1.5 py-1 font-normal text-foreground">
                  {e.name}
                </th>
                <td className="px-1.5 py-1">
                  {e.score === null || e.score === undefined ? (
                    <span className="text-dim italic">
                      {e.status === "excluded" ? "Excluded: " : "No score: "}
                      {e.reasons.join("; ")}
                    </span>
                  ) : (
                    <span className="numeric font-mono text-foreground">{points(e.score)}</span>
                  )}
                </td>
                {rec.needs.map((n) => (
                  <td
                    key={n.need}
                    className={`numeric px-1.5 py-1 font-mono ${n.weight === 0 ? "opacity-50" : ""}`}
                  >
                    {points(e.need_scores[n.need])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="text-3xs text-dim">
        <summary className="cursor-pointer select-none hover:text-foreground">
          Every weight, scale and limit used (assumptions)
        </summary>
        <p className="mt-1">{rec.evidence.statement}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4" data-testid="compare-assumptions">
          {rec.evidence.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="mt-1" data-testid="compare-recommendation-method">
          {rec.method}
        </p>
      </details>
    </div>
  );
}
