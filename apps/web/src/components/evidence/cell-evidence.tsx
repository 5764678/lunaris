"use client";

import { ExternalLink } from "lucide-react";

import { EVIDENCE_TAGS, EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CompareCell } from "@/lib/api/client";
import { formatBaseline, formatCellValue } from "@/lib/comparison/format";
import { cn } from "@/lib/utils";

function isHttps(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * One computed value as a button; clicking opens its own evidence: what the number means,
 * kind, statement, method, sources (link, SHA-256 or HTTP validators, citation),
 * assumptions, limitations and the measurement baseline. A null value shows its reason —
 * never 0, never blank.
 */
export function CellEvidence({
  cell,
  label,
  testId,
  align = "start",
  className,
  meaning,
}: {
  cell: CompareCell;
  label: string;
  testId?: string;
  align?: "start" | "end";
  className?: string;
  /** Plain-language explanation of what the number means, shown first in the popover. */
  meaning?: string;
}) {
  const value = formatCellValue(cell);
  const baseline = formatBaseline(cell);
  const ev = cell.evidence;
  const tag = ev ? EVIDENCE_TAGS[ev.kind] : EVIDENCE_TAGS.not_computed;
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
            <span className="font-mono text-3xs text-dim italic">
              N/C · <span className="not-italic">{cell.reason ?? "not computed"}</span>
            </span>
          ) : (
            <span className="numeric font-mono text-2xs text-foreground underline decoration-dotted decoration-dim underline-offset-2 group-hover:decoration-foreground">
              {value}
            </span>
          )}
          {baseline && <span className="font-mono text-3xs text-dim">{baseline}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align={align}
        className="max-h-[min(30rem,calc(100dvh-6rem))] overflow-y-auto"
        data-testid="cell-evidence"
        aria-label={`Evidence for ${label}`}
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <p className="mb-1 flex items-center gap-2 font-medium text-foreground">
          <EvidenceBadge kind={ev ? ev.kind : "not_computed"} />
          {label}
        </p>
        <p className="font-mono text-xs text-foreground" data-testid="cell-evidence-value">
          {value ?? "Not computed"}
          {baseline && <span className="text-dim"> · baseline {baseline.slice(2)}</span>}
          <span className="text-dim"> · unit {cell.unit}</span>
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
          <dl className="mt-2 space-y-1.5">
            <div>
              <dt className="label-caps">{tag.title}</dt>
              <dd className="text-foreground/90">{ev.statement}</dd>
            </div>
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
                  <ul className="space-y-1">
                    {ev.sources.map((src) => (
                      <li
                        key={src.source_id}
                        className="text-muted-foreground"
                        data-testid="cell-evidence-source"
                      >
                        {isHttps(src.url) ? (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
                          >
                            {src.title}
                            <ExternalLink className="size-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="text-foreground">{src.title}</span>
                        )}
                        <span className="block font-mono text-3xs break-all text-dim">
                          {src.source_id}
                          {src.sha256 ? ` · SHA-256 ${src.sha256}` : src.version ? ` · ${src.version}` : ""}
                        </span>
                        {src.citation && <span className="block text-3xs">{src.citation}</span>}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        )}
        {(ev?.assumptions.length ?? 0) + cell.limitations.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-hairline pt-2">
            {ev?.assumptions.map((a) => (
              <li key={`a-${a}`} className="flex items-start gap-2">
                <EvidenceBadge kind="assumption" className="mt-px" />
                <span className="text-muted-foreground">{a}</span>
              </li>
            ))}
            {cell.limitations.map((l) => (
              <li key={`l-${l}`} className="flex items-start gap-2 text-muted-foreground">
                <span className="mt-px shrink-0 font-mono text-3xs uppercase text-warn">Limit</span>
                {l}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
