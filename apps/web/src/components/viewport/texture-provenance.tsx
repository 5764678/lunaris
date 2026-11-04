"use client";

import { ExternalLink, Info } from "lucide-react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { isHttpsUrl, type TextureLoadState, type TextureManifest } from "./surface-source";

function Row({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-2 py-0.5">
      <dt className="font-mono text-3xs uppercase tracking-[0.1em] text-dim">{label}</dt>
      <dd className="min-w-0 break-words text-foreground/90" data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

/**
 * HUD disclosure for the acquired NASA SVS color map. The line names the source file;
 * clicking it opens the full provenance recorded by `build-web-texture` (dataset, URL,
 * SHA-256, retrieval and build times, credit, assumptions).
 */
export function TextureProvenance({
  manifest,
  state,
}: {
  manifest: TextureManifest;
  state: TextureLoadState;
}) {
  const m = manifest;
  return (
    <div
      className="flex min-w-0 items-center gap-2"
      data-testid="surface-disclosure"
      data-surface="texture"
      data-state={state}
    >
      <EvidenceBadge
        kind="derived_product"
        label="NASA SVS"
        detail={`${m.source.dataset_title}. Visualization only, not an analysis input.`}
      />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 items-center gap-1 rounded-[3px] text-left font-mono text-3xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Globe texture source"
            data-testid="surface-provenance-trigger"
          >
            <span className="truncate">
              {state === "loading" ? "Loading surface: " : "Surface: "}
              {m.source.file} · visualization only, not an analysis input
            </span>
            <Info className="size-3 shrink-0" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          data-testid="surface-provenance"
          aria-label="Globe texture provenance"
          tabIndex={-1}
          // Focus the panel, not its first badge: a focused badge opens its tooltip over the panel.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
        >
          <p className="mb-1.5 flex items-center gap-2 font-medium text-foreground">
            <EvidenceBadge kind="derived_product" />
            Globe colour map
          </p>
          <dl>
            <Row label="Dataset">
              {m.source.dataset_title} <span className="font-mono text-dim">({m.source.dataset_id})</span>
            </Row>
            <Row label="Source file">
              {isHttpsUrl(m.source.source_url) ? (
                <a
                  href={m.source.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 font-mono underline decoration-dotted underline-offset-2 hover:text-primary"
                >
                  {m.source.file}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : (
                <span className="font-mono">{m.source.file}</span>
              )}
            </Row>
            <Row label="SHA-256" testId="surface-provenance-sha256">
              <span className="font-mono text-3xs break-all">{m.source.sha256}</span>
            </Row>
            <Row label="Retrieved">
              <span className="font-mono">{m.source.retrieved_at_utc}</span>
            </Row>
            <Row label="Web texture">
              <span className="font-mono">
                {m.file} · {m.width}×{m.height} px · {m.generator} · {m.generated_at_utc}
              </span>
            </Row>
            <Row label="Credit">{m.credit}</Row>
            <Row label="Use">{m.usage}</Row>
          </dl>
          {m.assumptions.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 border-t border-hairline pt-2">
              {m.assumptions.map((assumption) => (
                <li key={assumption} className="flex items-start gap-2">
                  <EvidenceBadge kind="assumption" className="mt-px" />
                  <span className="text-muted-foreground">{assumption}</span>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
