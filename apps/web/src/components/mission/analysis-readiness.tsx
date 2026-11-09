"use client";

import { DATASET_STATUS } from "@/components/data/dataset-status";
import { useDatasetsQuery } from "@/lib/api/queries";
import { milestoneLabel } from "@/lib/milestones";
import { ANALYSIS_MODULES } from "@/lib/modules";
import { inputTags } from "@/lib/readiness/inputs";
import { cn } from "@/lib/utils";

import { PanelSection } from "./panel-section";

/**
 * For each analysis module: implementation status and whether its input datasets are in
 * the local store. Only modules whose output is actually served and shown are "available".
 */
export function AnalysisReadiness() {
  const datasets = useDatasetsQuery();
  const modules = ANALYSIS_MODULES;

  return (
    <PanelSection id="analysis" title="Analysis readiness">
      <ul className="space-y-1.5">
        {modules.map((module) => {
          const keys = module.inputs;
          const inputs =
            datasets.data?.datasets.filter((d) => d.required_by.some((r) => keys.includes(r))) ?? [];
          const Icon = module.icon;
          return (
            <li key={module.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <Icon className="size-3.5 text-dim" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-2xs text-muted-foreground">{module.title}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {inputTags(inputs).map((tag) => (
                    <span
                      key={tag.category}
                      title={tag.datasets
                        .map((d) => `${d.title} — ${DATASET_STATUS[d.status].label}`)
                        .join("\n")}
                      data-testid="readiness-input"
                      data-status={tag.status}
                      className="inline-flex items-center gap-1 font-mono text-3xs text-dim"
                    >
                      <span className={cn("size-1 rounded-full", DATASET_STATUS[tag.status].dot)} />
                      {tag.category}
                    </span>
                  ))}
                  {datasets.isError && <span className="font-mono text-3xs text-dim">inputs unknown</span>}
                </p>
              </div>
              {module.status === "available" ? (
                <span
                  className="rounded-sm border border-ev-model/40 bg-ev-model/10 px-1.5 py-px font-mono text-3xs uppercase tracking-wider text-ev-model"
                  title={`${milestoneLabel(module.milestone)}\n${module.availableIn ?? ""}`.trim()}
                  data-testid={`readiness-${module.id}`}
                >
                  {module.milestone} · available
                </span>
              ) : (
                <span
                  className="hatch rounded-sm border border-hairline px-1.5 py-px font-mono text-3xs uppercase tracking-wider text-dim"
                  title={milestoneLabel(module.milestone)}
                  data-testid={`readiness-${module.id}`}
                >
                  {module.milestone} · planned
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </PanelSection>
  );
}
