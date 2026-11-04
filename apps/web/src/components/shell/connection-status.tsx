"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeError } from "@/lib/api/client";
import { useConnection, type ConnectionState } from "@/lib/api/queries";
import { config } from "@/lib/config";
import { formatUtc } from "@/lib/time/time";
import { cn } from "@/lib/utils";

const PRESENTATION: Record<ConnectionState["kind"], { label: string; dot: string; text: string }> = {
  connecting: { label: "Connecting", dot: "bg-dim animate-pulse", text: "text-muted-foreground" },
  online: { label: "Online", dot: "bg-ok shadow-[0_0_8px] shadow-ok/60", text: "text-ok" },
  degraded: { label: "Degraded", dot: "bg-warn", text: "text-warn" },
  incompatible: { label: "Version mismatch", dot: "bg-warn", text: "text-warn" },
  offline: { label: "Offline", dot: "bg-critical", text: "text-critical" },
};

/** API link indicator driven by polling `GET /health`. */
export function ConnectionStatus() {
  const state = useConnection();
  const view = PRESENTATION[state.kind];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid="api-status"
          data-state={state.kind}
          className="flex h-7 items-center gap-2 rounded-md border border-border bg-panel px-2.5 outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className={cn("size-1.5 rounded-full", view.dot)} aria-hidden="true" />
          <span className="label-caps text-muted-foreground">API</span>
          <span className={cn("font-mono text-2xs uppercase tracking-wide", view.text)}>{view.label}</span>
          {"health" in state && (
            <span className="numeric hidden font-mono text-2xs text-dim sm:inline">
              v{state.health.version} · {Math.round(state.latencyMs)} ms
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="font-mono">
        <ConnectionDetails state={state} />
      </TooltipContent>
    </Tooltip>
  );
}

function ConnectionDetails({ state }: { state: ConnectionState }) {
  const rows: [string, string][] = [["Endpoint", `${config.apiBaseUrl}/health`]];
  if ("health" in state) {
    rows.push(
      ["Service", `${state.health.service} ${state.health.version}`],
      ["Contract", `${state.health.api_version} (client expects ${config.expectedApiVersion})`],
      ["Environment", state.health.environment],
      ["Round trip", `${state.latencyMs.toFixed(1)} ms`],
      ["Checked", `${formatUtc(state.checkedAt)} UTC`],
      ...state.health.checks.map((c): [string, string] => [
        c.name,
        c.detail ? `${c.status} — ${c.detail}` : c.status,
      ]),
    );
  }
  if (state.kind === "offline") {
    rows.push(["Error", describeError(state.error)], ["Start API", "npm run dev:api"]);
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-dim">{k}</dt>
          <dd className="break-all text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
