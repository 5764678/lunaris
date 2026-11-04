"use client";

import type { EvidenceKind } from "@lunaris/shared-types";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Evidence kinds plus the UI-only state for values that have not been computed. */
export type EvidenceTag = EvidenceKind | "not_computed";

export const EVIDENCE_TAGS: Record<
  EvidenceTag,
  { short: string; title: string; description: string; className: string }
> = {
  observation: {
    short: "OBS",
    title: "Observation",
    description: "Measured data as distributed by the instrument team.",
    className: "border-ev-observation/40 bg-ev-observation/10 text-ev-observation",
  },
  derived_product: {
    short: "DERIVED",
    title: "Derived product",
    description: "Archived product derived from observations by its producing team.",
    className: "border-ev-derived/40 bg-ev-derived/10 text-ev-derived",
  },
  model: {
    short: "MODEL",
    title: "Model output",
    description: "Output of an authoritative physical or ephemeris model.",
    className: "border-ev-model/40 bg-ev-model/10 text-ev-model",
  },
  calculation: {
    short: "CALC",
    title: "Calculation",
    description: "Computed by LUNARIS from other evidence; the method is recorded.",
    className: "border-ev-calculation/40 bg-ev-calculation/10 text-ev-calculation",
  },
  assumption: {
    short: "ASSUMED",
    title: "Assumption",
    description: "Adopted by configuration or convention, without observational support.",
    className: "border-ev-assumption/40 bg-ev-assumption/10 text-ev-assumption",
  },
  placeholder: {
    short: "PLACEHOLDER",
    title: "Placeholder",
    description: "Stand-in content. Never valid evidence for a mission decision.",
    className: "border-dashed border-ev-placeholder/60 bg-ev-placeholder/10 text-ev-placeholder",
  },
  not_computed: {
    short: "N/C",
    title: "Not computed",
    description: "The module that produces this value is not implemented yet.",
    className: "hatch border-ev-not-computed/40 text-ev-not-computed",
  },
};

export function EvidenceBadge({
  kind,
  label,
  className,
  detail,
}: {
  kind: EvidenceTag;
  label?: string;
  className?: string;
  /** Extra tooltip line, e.g. the method or assumption. */
  detail?: string;
}) {
  const tag = EVIDENCE_TAGS[kind];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          data-evidence={kind}
          className={cn(
            "inline-flex h-4 shrink-0 cursor-help items-center rounded-[3px] border px-1 font-mono text-3xs font-medium uppercase tracking-[0.08em] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            tag.className,
            className,
          )}
        >
          {label ?? tag.short}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium text-foreground">{tag.title}</p>
        <p className="text-muted-foreground">{tag.description}</p>
        {detail && <p className="mt-1 text-foreground/80">{detail}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function EvidenceLegend({ className }: { className?: string }) {
  const order: EvidenceTag[] = [
    "observation",
    "derived_product",
    "model",
    "calculation",
    "assumption",
    "placeholder",
    "not_computed",
  ];
  return (
    <div className={cn("flex flex-wrap gap-1", className)} aria-label="Evidence legend">
      {order.map((kind) => (
        <EvidenceBadge key={kind} kind={kind} />
      ))}
    </div>
  );
}
