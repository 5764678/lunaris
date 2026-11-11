"use client";

import { X } from "lucide-react";

import { EVIDENCE_TAGS, EvidenceBadge } from "@/components/evidence/evidence-badge";
import { SourceFiles, SourceList } from "@/components/evidence/references";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CompareCell } from "@/lib/api/client";
import { formatBaseline, formatCellValue } from "@/lib/comparison/format";
import { isTechnicalNote } from "@/lib/references";
import { cn } from "@/lib/utils";

/**
 * One computed value as a button; clicking opens its own evidence. The popup reads top to bottom
 * as: the value and what it means in plain words, what kind of knowledge it is, the limits that
 * matter, and then, folded away, the method, the sources (each dataset and reference once) and
 * the technical details. A null value shows its reason, never 0, never blank.
 */
export function CellEvidence({
  cell,
  label,
  testId,
  align = "start",
  className,
  meaning,
  mapNote,
}: {
  cell: CompareCell;
  label: string;
  testId?: string;
  align?: "start" | "end";
  className?: string;
  /** Plain-language explanation of what the number means, shown first in the popover. */
  meaning?: string;
  /** Which elevation map the value was read from, shown under it ("240 m map"). */
  mapNote?: string;
}) {
  const value = formatCellValue(cell);
  const baseline = formatBaseline(cell);
  const ev = cell.evidence;
  const tag = ev ? EVIDENCE_TAGS[ev.kind] : EVIDENCE_TAGS.not_computed;
  const limits = cell.limitations.filter((l) => !isTechnicalNote(l));
  const technical = cell.limitations.filter(isTechnicalNote);
  const hasDetails = Boolean(
    ev && (ev.method || ev.sources.length > 0 || ev.assumptions.length > 0 || technical.length > 0),
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          data-null={value === null ? "true" : "false"}
          aria-label={`${label}: ${value ?? `not computed (${cell.reason ?? "no reason given"})`}. Show evidence.`}
          className={cn(
            "group inline-flex max-w-full flex-col rounded-[3px] px-1 py-0.5 text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50",
            align === "end" && "items-end text-right",
            className,
          )}
        >
          {value === null ? (
            <span className="font-mono text-3xs [overflow-wrap:anywhere] text-dim italic">
              N/C · <span className="not-italic">{cell.reason ?? "not computed"}</span>
            </span>
          ) : (
            <span className="numeric font-mono text-2xs text-foreground underline decoration-dotted decoration-dim underline-offset-2 group-hover:decoration-foreground">
              {value}
            </span>
          )}
          {baseline && <span className="font-mono text-3xs text-dim">{baseline}</span>}
          {mapNote && value !== null && <span className="text-3xs text-dim">{mapNote}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align={align}
        className="max-h-[min(34rem,calc(100dvh-2rem))] overflow-y-auto"
        data-testid="cell-evidence"
        aria-label={`Evidence for ${label}`}
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
            <EvidenceBadge kind={ev ? ev.kind : "not_computed"} />
            <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
          </p>
          <PopoverClose
            aria-label="Close evidence"
            data-testid="cell-evidence-close"
            className="-mt-1 -mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-dim outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden="true" />
          </PopoverClose>
        </div>
        <p className="numeric font-mono text-base text-foreground" data-testid="cell-evidence-value">
          {value ?? "Not computed"}
          {baseline && <span className="text-xs text-dim"> · baseline {baseline.slice(2)}</span>}
          {mapNote && value !== null && <span className="text-xs text-dim"> · {mapNote}</span>}
        </p>
        {meaning && (
          <p className="mt-1 text-foreground/90" data-testid="cell-evidence-meaning">
            {meaning}
          </p>
        )}
        {value === null && (
          <p className="mt-1 text-muted-foreground" data-testid="cell-evidence-reason">
            Reason: {cell.reason ?? "not given"}
          </p>
        )}
        {ev && (
          <p className="mt-2 text-muted-foreground">
            <span className="label-caps mr-1.5">{tag.title}</span>
            {ev.statement}
          </p>
        )}
        {limits.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-hairline pt-2">
            {limits.map((l) => (
              <li key={`l-${l}`} className="flex items-start gap-2 text-muted-foreground">
                <span className="mt-px shrink-0 text-3xs font-medium uppercase text-warn">Limit</span>
                {l}
              </li>
            ))}
          </ul>
        )}
        {ev && hasDetails && (
          <details className="mt-2 border-t border-hairline pt-2" data-testid="cell-evidence-details">
            <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
              Method, sources and technical details
            </summary>
            <dl className="mt-2 space-y-2">
              {ev.method && (
                <div>
                  <dt className="label-caps">Method</dt>
                  <dd className="text-muted-foreground">{ev.method}</dd>
                </div>
              )}
              {ev.sources.length > 0 && (
                <div>
                  <dt className="label-caps">Sources</dt>
                  <dd>
                    <SourceList sources={ev.sources} />
                  </dd>
                </div>
              )}
              {ev.assumptions.length > 0 && (
                <div>
                  <dt className="label-caps">Assumptions</dt>
                  <dd>
                    <ul className="space-y-1">
                      {ev.assumptions.map((a) => (
                        <li key={`a-${a}`} className="text-muted-foreground">
                          {a}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {(ev.sources.length > 0 || technical.length > 0) && (
                <div>
                  <dt className="label-caps">Files and checksums</dt>
                  <dd className="space-y-1.5">
                    <SourceFiles sources={ev.sources} />
                    {technical.map((t) => (
                      <p key={t} className="font-mono text-3xs break-all text-dim">
                        {t}
                      </p>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </details>
        )}
      </PopoverContent>
    </Popover>
  );
}
