"use client";

import type { DatasetSummary } from "@lunaris/shared-types";
import { ExternalLink, RotateCcw } from "lucide-react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { describeError } from "@/lib/api/client";
import { useDatasetsQuery, useRuntimeQuery } from "@/lib/api/queries";
import { datasetAvailability } from "@/lib/datasets/availability";

import { CopyCommand, DatasetAvailabilityPill } from "./dataset-status";
import { useShippedTextures } from "./use-shipped-textures";

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${units[unit]}`;
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-0.5">
      <dt className="text-2xs text-dim">{label}</dt>
      <dd className="text-2xs leading-relaxed text-muted-foreground">{value}</dd>
    </div>
  );
}

function DatasetCard({
  dataset,
  shippedTextureIds,
}: {
  dataset: DatasetSummary;
  shippedTextureIds: ReadonlySet<string>;
}) {
  const spatial = dataset.spatial;
  const webTexture = datasetAvailability(dataset, shippedTextureIds).kind === "web-texture";
  return (
    <article
      className="rounded-lg border border-border bg-panel"
      aria-labelledby={`dataset-${dataset.id}`}
      data-testid="dataset-card"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{dataset.category}</Badge>
            <EvidenceBadge kind={dataset.evidence_kind} />
            {dataset.url_verification.status === "verified" ? (
              <Badge variant="ok" title={dataset.url_verification.note}>
                URLs verified {dataset.url_verification.checked_on}
              </Badge>
            ) : (
              <Badge variant="warn" title={dataset.url_verification.note}>
                URLs unverified
              </Badge>
            )}
          </div>
          <h2 id={`dataset-${dataset.id}`} className="text-sm font-medium text-foreground">
            {dataset.title}
          </h2>
          <p className="mt-0.5 font-mono text-3xs text-dim">{dataset.id}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <DatasetAvailabilityPill
            dataset={dataset}
            shippedTextureIds={shippedTextureIds}
            className="text-2xs"
          />
          <span className="numeric font-mono text-3xs text-dim">
            {webTexture
              ? "original file not stored on the server"
              : `${dataset.local.files_present}/${dataset.local.files_expected} files · ${formatBytes(dataset.local.bytes_on_disk)}`}
          </span>
          {dataset.local.manifest_changed && <Badge variant="warn">Manifest changed since acquisition</Badge>}
        </div>
      </header>

      <div className="grid gap-x-8 gap-y-4 px-5 py-4 xl:grid-cols-2">
        <div>
          <p className="mb-3 text-2xs leading-relaxed text-muted-foreground">{dataset.summary}</p>
          <dl>
            <MetaRow label="Provider" value={dataset.provider} />
            <MetaRow label="Mission" value={dataset.mission} />
            <MetaRow label="Instrument" value={dataset.instrument} />
            <MetaRow label="Product family" value={dataset.product_family} />
            <MetaRow label="Frame" value={spatial?.frame} />
            <MetaRow label="Projection" value={spatial?.projection} />
            <MetaRow
              label="Resolution"
              value={
                spatial?.nominal_resolution_m ? `${spatial.nominal_resolution_m} m/pixel (nominal)` : null
              }
            />
            <MetaRow label="Coverage" value={spatial?.coverage} />
            <MetaRow label="Vertical reference" value={spatial?.vertical_reference} />
            <MetaRow label="Units" value={dataset.units} />
            <MetaRow label="Used by" value={dataset.required_by.join(", ")} />
          </dl>
        </div>
        <div className="space-y-3">
          <div>
            <p className="label-caps mb-1">Citation</p>
            <p className="text-2xs leading-relaxed text-muted-foreground">{dataset.citation}</p>
          </div>
          <div>
            <p className="label-caps mb-1">Usage</p>
            <p className="text-2xs leading-relaxed text-muted-foreground">{dataset.usage}</p>
          </div>
          <div>
            <p className="label-caps mb-1">URL verification</p>
            <p className="text-2xs leading-relaxed text-muted-foreground">{dataset.url_verification.note}</p>
          </div>
          {dataset.acquire_command ? (
            <div>
              <p className="label-caps mb-1">Acquire</p>
              <CopyCommand command={dataset.acquire_command} />
            </div>
          ) : null}
          <a
            href={dataset.source_page}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-2xs text-primary hover:underline"
          >
            Source page <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-hairline">
        <table className="w-full min-w-[40rem] text-left">
          <thead>
            <tr className="label-caps">
              <th className="px-5 py-2 font-normal">File</th>
              <th className="px-2 py-2 font-normal">Role</th>
              <th className="px-2 py-2 font-normal">Local</th>
              <th className="px-2 py-2 text-right font-normal">Size</th>
              <th className="px-5 py-2 font-normal">SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {dataset.files.map((file) => (
              <tr key={file.name} className="border-t border-hairline font-mono text-3xs">
                <td className="px-5 py-1.5">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground hover:text-primary"
                  >
                    {file.name}
                  </a>
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">{file.role}</td>
                <td className={`px-2 py-1.5 ${file.present ? "text-ok" : "text-dim"}`}>
                  {file.present ? "present" : "absent"}
                </td>
                <td className="numeric px-2 py-1.5 text-right text-muted-foreground">
                  {formatBytes(file.size_bytes)}
                </td>
                <td className="px-5 py-1.5 text-dim" title={file.sha256 ?? undefined}>
                  {file.sha256 ? `${file.sha256.slice(0, 16)}…` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dataset.notes.length > 0 && (
        <ul className="space-y-1 border-t border-hairline px-5 py-3">
          {dataset.notes.map((note) => (
            <li key={note} className="text-3xs leading-relaxed text-dim">
              — {note}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function DatasetRegistry() {
  const datasets = useDatasetsQuery();
  const textures = useShippedTextures();
  if (datasets.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (datasets.isError) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-lg border border-critical/30 bg-critical/5 p-4"
      >
        <p className="text-xs text-critical/90">{describeError(datasets.error)}</p>
        <Button size="sm" variant="outline" onClick={() => void datasets.refetch()}>
          <RotateCcw /> Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {datasets.data.datasets.map((dataset) => (
        <DatasetCard key={dataset.id} dataset={dataset} shippedTextureIds={textures.ids} />
      ))}
    </div>
  );
}

export function RuntimeTable() {
  const runtime = useRuntimeQuery();
  return (
    <section aria-labelledby="runtime-heading" className="rounded-lg border border-border bg-panel">
      <header className="border-b border-hairline px-5 py-3">
        <h2 id="runtime-heading" className="label-caps text-muted-foreground">
          Scientific toolchain (served by the API)
        </h2>
      </header>
      {runtime.isPending ? (
        <div className="p-5">
          <Skeleton className="h-24" />
        </div>
      ) : runtime.isError ? (
        <p role="alert" className="p-5 text-2xs text-critical/90">
          {describeError(runtime.error)}
        </p>
      ) : (
        <table className="w-full text-left" data-testid="runtime-table">
          <tbody>
            {runtime.data.components.map((c) => (
              <tr key={c.name} className="border-t border-hairline first:border-t-0">
                <td className="px-5 py-1.5 font-mono text-2xs text-foreground">{c.name}</td>
                <td
                  className={`numeric px-2 py-1.5 font-mono text-2xs ${c.available ? "text-ok" : "text-critical"}`}
                >
                  {c.version ?? "missing"}
                </td>
                <td className="px-5 py-1.5 text-2xs text-dim">{c.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
