"use client";

import { LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ComparisonSummary, MissionProfile } from "@/lib/api/client";
import { describeRowError, type CompareColumn } from "@/lib/comparison/progress";
import { leaderLabel, PROFILES, profileName, weightLines } from "@/lib/comparison/summary";

export type SummaryState =
  | { kind: "too-few" }
  | { kind: "waiting" }
  | { kind: "incomplete" }
  | { kind: "loading" }
  | { kind: "error"; error: unknown; retry: () => void }
  | { kind: "ready"; summary: ComparisonSummary; scoring: boolean };

/**
 * T-18 summary above the table: the verdict (from leads, trails and dominance only), each
 * site's standing, and, only when the visitor picks a mission profile, a weighted ordering whose
 * weights are shown as assumptions. There is no default score.
 */
export function ComparisonSummaryPanel({
  state,
  columns,
  profile,
  onProfile,
}: {
  state: SummaryState;
  columns: readonly CompareColumn[];
  profile: MissionProfile | null;
  onProfile: (profile: MissionProfile | null) => void;
}) {
  return (
    <section
      aria-label="Comparison summary"
      className="space-y-2 rounded-md border border-hairline bg-panel-sunken/40 p-2.5"
      data-testid="compare-summary"
      data-state={state.kind}
    >
      <p className="label-caps">Summary</p>
      <SummaryBody state={state} columns={columns} />
      {state.kind === "ready" && (
        <ProfileSection
          summary={state.summary}
          scoring={state.scoring}
          columns={columns}
          profile={profile}
          onProfile={onProfile}
        />
      )}
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

function ProfileSection({
  summary,
  scoring,
  columns,
  profile,
  onProfile,
}: {
  summary: ComparisonSummary;
  scoring: boolean;
  columns: readonly CompareColumn[];
  profile: MissionProfile | null;
  onProfile: (profile: MissionProfile | null) => void;
}) {
  const score = summary.score && summary.score.profile === profile ? summary.score : null;
  return (
    <div className="space-y-1.5 border-t border-hairline pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-caps" id="compare-profile-label">
          Mission profile (optional)
        </span>
        <ToggleGroup
          type="single"
          aria-labelledby="compare-profile-label"
          value={profile ?? "none"}
          onValueChange={(v) => {
            if (!v) return; // clicking the active item keeps it
            onProfile(v === "none" ? null : (v as MissionProfile));
          }}
          data-testid="compare-profile"
        >
          <ToggleGroupItem value="none" data-testid="compare-profile-none">
            None
          </ToggleGroupItem>
          {PROFILES.map((p) => (
            <ToggleGroupItem key={p} value={p} data-testid={`compare-profile-${p}`}>
              {profileName(p)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {profile === null ? (
        <p className="text-3xs text-dim" data-testid="compare-no-score">
          No score is shown without a profile. A profile ranks the sites with fixed weights, which are
          assumptions, not mission requirements.
        </p>
      ) : !score ? (
        <p className="inline-flex items-center gap-1.5 text-3xs text-dim" role="status">
          <LoaderCircle aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" />
          {scoring ? `Scoring for ${profileName(profile).toLowerCase()}…` : "No score in the answer."}
        </p>
      ) : (
        <div className="space-y-1.5" data-testid="compare-score" data-profile={score.profile}>
          <p className="flex items-start gap-2 text-3xs text-muted-foreground">
            <EvidenceBadge kind={score.evidence.kind} className="mt-px" />
            <span>{score.evidence.statement}</span>
          </p>
          <div>
            <p className="label-caps">Weights (assumed)</p>
            <ul className="flex flex-wrap gap-x-3 text-3xs text-muted-foreground">
              {weightLines(score.weights, columns).map((w) => (
                <li key={w.key} data-testid="compare-weight">
                  {w.label} × {w.weight}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-3xs text-dim" data-testid="compare-normalisation">
            {score.normalisation}
          </p>
          <ol className="space-y-0.5">
            {score.scores.map((e, i) => (
              <li
                key={e.site_id}
                className="flex flex-wrap items-baseline gap-x-2 text-2xs"
                data-testid="compare-score-entry"
                data-null={e.score === null ? "true" : "false"}
              >
                <span className="w-4 font-mono text-3xs text-dim">{e.score === null ? "–" : i + 1}</span>
                <span className="text-foreground">{e.name}</span>
                {e.score === null ? (
                  <span className="font-mono text-3xs text-dim italic">
                    no score · {e.reason ?? "not given"}
                  </span>
                ) : (
                  <span className="numeric font-mono text-3xs text-foreground">{e.score.toFixed(2)}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
