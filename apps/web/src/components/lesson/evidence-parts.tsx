"use client";

import { X } from "lucide-react";

import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBaseline, formatCellValue } from "@/lib/comparison/format";
import { useT } from "@/lib/i18n";
import type { CompareCell, Evidence } from "@/lib/lesson/types";
import { cn } from "@/lib/utils";

type KindKey = Evidence["kind"] | "notComputed";

const KIND_CLASS: Record<KindKey, string> = {
  observation: "border-ev-observation text-ev-observation",
  derived_product: "border-ev-derived text-ev-derived",
  model: "border-ev-model text-ev-model",
  calculation: "border-ev-calculation text-ev-calculation",
  assumption: "border-ev-assumption text-ev-assumption",
  placeholder: "border-dashed border-ev-placeholder text-ev-placeholder",
  notComputed: "border-ev-not-computed text-ev-not-computed",
};

/** The evidence kind as a word in the current language, in its own colour (never colour alone). */
export function EvidenceChip({ kind, testId }: { kind: KindKey; testId?: string }) {
  const t = useT().learn.evidence;
  return (
    <span
      data-testid={testId}
      data-kind={kind}
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-sm leading-tight",
        KIND_CLASS[kind],
      )}
    >
      {t.kinds[kind]}
    </span>
  );
}

/** What the kind means, then the folded method, sources, assumptions and limitations (English). */
export function EvidenceDetails({
  evidence,
  limitations,
}: {
  evidence: Evidence | null | undefined;
  limitations: readonly string[];
}) {
  const t = useT().learn.evidence;
  if (!evidence) return null;
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      <p className="text-foreground">{t.meanings[evidence.kind]}</p>
      <details>
        <summary className="cursor-pointer text-muted-foreground">{t.method}</summary>
        <div className="mt-1 space-y-2 text-muted-foreground" lang="en">
          <p className="text-dim" lang="th">
            {t.englishNote}
          </p>
          <p>{evidence.statement}</p>
          {evidence.method && <p>{evidence.method}</p>}
          {evidence.assumptions.length > 0 && (
            <div>
              <p className="font-medium text-foreground" lang="th">
                {t.assumptions}
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {evidence.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {evidence.sources.length > 0 && (
            <div>
              <p className="font-medium text-foreground" lang="th">
                {t.sources}
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {evidence.sources.map((s) => (
                  <li key={s.source_id}>{s.title}</li>
                ))}
              </ul>
            </div>
          )}
          {limitations.length > 0 && (
            <div>
              <p className="font-medium text-foreground" lang="th">
                {t.limitations}
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

/** One value of the comparison table: the number, its evidence kind, and its evidence on press. */
export function EvidenceCell({ cell, label, testId }: { cell: CompareCell; label: string; testId?: string }) {
  const t = useT().learn.evidence;
  const value = formatCellValue(cell);
  const baseline = formatBaseline(cell);
  const kind: KindKey = cell.evidence ? cell.evidence.kind : "notComputed";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          aria-label={`${t.valueOf(label, value ?? cell.reason ?? "–")}. ${t.show}`}
          className="flex min-h-11 flex-col items-start gap-1 rounded-md px-2 py-1 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <span className="numeric font-semibold text-foreground underline decoration-dotted underline-offset-2">
            {value ?? "–"}
          </span>
          <EvidenceChip kind={kind} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="max-h-[min(30rem,70dvh)] w-[min(24rem,90vw)] overflow-y-auto"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <PopoverClose
            aria-label={t.close}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-dim outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <X className="size-4" aria-hidden="true" />
          </PopoverClose>
        </div>
        <p className="numeric mb-2 text-lg text-foreground">
          {value ?? "–"}
          {baseline && <span className="text-sm text-dim"> {baseline}</span>}
        </p>
        {value === null && cell.reason && <p className="mb-2 text-sm text-muted-foreground">{cell.reason}</p>}
        <p className="mb-2 text-sm text-muted-foreground">
          {t.kindHeading}: <EvidenceChip kind={kind} />
        </p>
        <EvidenceDetails evidence={cell.evidence} limitations={cell.limitations} />
      </PopoverContent>
    </Popover>
  );
}
