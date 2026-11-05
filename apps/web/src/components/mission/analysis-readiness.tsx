"use client";

import { DATASET_STATUS } from "@/components/data/dataset-status";
import { useDatasetsQuery } from "@/lib/api/queries";
import { MISSION_MODULES } from "@/lib/modules";
import { cn } from "@/lib/utils";

import { PanelSection } from "./panel-section";

const ANALYSIS_MODULE_IDS = ["terrain", "geometry", "illumination", "visibility", "analysis"];
const DATA_DEPENDENCY_ALIASES: Record<string, string[]> = {
  analysis: ["terrain", "geometry", "illumination", "visibility"],
};

/**
 * For each analysis module: implementation status and whether its input datasets are in
 * the local store. Only modules whose output is actually served and shown are "available".
 */
export function AnalysisReadiness() {
  const datasets = useDatasetsQuery();
  const modules = MISSION_MODULES.filter((m) => ANALYSIS_MODULE_IDS.includes(m.id));

  return (
    <PanelSection id="analysis" title="Analysis readiness">
      <ul className="space-y-1.5">
        {modules.map((module) => {
          const keys = DATA_DEPENDENCY_ALIASES[module.id] ?? [module.id];
          const inputs =
            datasets.data?.datasets.filter((d) => d.required_by.some((r) => keys.includes(r))) ?? [];
          const Icon = module.icon;
          return (
            <li key={module.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <Icon className="size-3.5 text-dim" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-2xs text-muted-foreground">{module.title}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {inputs.map((d) => (
                    <span
                      key={d.id}
                      title={`${d.title} — ${DATASET_STATUS[d.local.status].label}`}
                      className="inline-flex items-center gap-1 font-mono text-3xs text-dim"
                    >
                      <span className={cn("size-1 rounded-full", DATASET_STATUS[d.local.status].dot)} />
                      {d.category}
                    </span>
                  ))}
                  {datasets.isError && <span className="font-mono text-3xs text-dim">inputs unknown</span>}
                </p>
              </div>
              {module.status === "available" ? (
                <span
                  className="rounded-sm border border-ev-model/40 bg-ev-model/10 px-1.5 py-px font-mono text-3xs uppercase tracking-wider text-ev-model"
                  title={module.availableIn}
                  data-testid={`readiness-${module.id}`}
                >
                  {module.milestone} · available
                </span>
              ) : (
                <span
                  className="hatch rounded-sm border border-hairline px-1.5 py-px font-mono text-3xs uppercase tracking-wider text-dim"
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
