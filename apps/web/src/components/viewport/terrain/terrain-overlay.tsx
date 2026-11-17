"use client";

import { ExternalLink, Info } from "lucide-react";
import type { ReactNode } from "react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TerrainScene } from "@/lib/api/queries";
import { heightColor } from "@/lib/terrain/scene-data";

import { describeError } from "@/lib/api/client";
import { useSiteTimeline } from "@/lib/api/queries";
import { formatUtcReadable } from "@/lib/time/time";
import { siteIlluminationAt } from "@/lib/timeline/illumination";
import { useMissionStore } from "@/store/mission-store";

import { isHttpsUrl } from "../surface-source";
import type { TerrainSun } from "./use-terrain-sun";

function Row({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-2 py-0.5">
      <dt className="text-3xs text-dim">{label}</dt>
      <dd className="min-w-0 break-words text-foreground/90" data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

const km = (m: number) => `${(m / 1000).toFixed(2)} km`;

/** Height legend: the colour ramp over the scene's height range. */
function HeightLegend({ minM, maxM }: { minM: number; maxM: number }) {
  const stops = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const [r, g, b] = heightColor(f);
      return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}) ${f * 100}%`;
    })
    .join(", ");
  return (
    <div className="flex items-center gap-2 text-3xs text-muted-foreground">
      <span className="numeric">{km(minM)}</span>
      <span
        aria-hidden="true"
        className="h-1.5 w-20 rounded-full border border-hairline"
        style={{ background: `linear-gradient(90deg, ${stops})` }}
      />
      <span className="numeric">{km(maxM)}</span>
      <span className="hidden text-dim sm:inline">height vs 1737.4 km sphere</span>
    </div>
  );
}

/** HUD disclosures for the terrain scene: DEM provenance (click for detail) and lighting. */
export function TerrainDisclosures({ scene, sun }: { scene: TerrainScene; sun: TerrainSun }) {
  const { metadata: m, terrain } = scene;
  return (
    <>
      <div className="flex min-w-0 items-center gap-2" data-testid="terrain-disclosure">
        <EvidenceBadge kind={m.evidence.kind} label="LOLA DEM" detail={m.evidence.statement} />
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 rounded-[3px] text-left text-3xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Terrain source"
              data-testid="terrain-provenance-trigger"
            >
              <span className="truncate">
                Terrain: {m.dem.file_name} · {m.width}×{m.height} vertices · ~{Math.round(m.vertex_spacing_m)}{" "}
                m
              </span>
              <Info className="size-3 shrink-0" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            data-testid="terrain-provenance"
            className="max-h-[min(32rem,calc(100dvh-6rem))] overflow-y-auto"
            aria-label="Terrain provenance"
            tabIndex={-1}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              (event.currentTarget as HTMLElement | null)?.focus();
            }}
          >
            <p className="mb-1.5 flex items-center gap-2 font-medium text-foreground">
              <EvidenceBadge kind={m.evidence.kind} />
              {m.title}
            </p>
            <dl>
              <Row label="DEM">
                {m.dem.title} <span className="font-mono text-dim">({m.dem.dataset_id})</span>
              </Row>
              <Row label="Source file">
                {isHttpsUrl(m.dem.source_url) ? (
                  <a
                    href={m.dem.source_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 font-mono underline decoration-dotted underline-offset-2 hover:text-primary"
                  >
                    {m.dem.file_name}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="font-mono">{m.dem.file_name}</span>
                )}
              </Row>
              <Row label="SHA-256" testId="terrain-provenance-sha256">
                <span className="font-mono text-3xs break-all">{m.dem.sha256}</span>
              </Row>
              <Row label="DEM frame">{m.dem.frame} (treated as MOON_ME)</Row>
              <Row label="Grid">
                <span className="font-mono" data-testid="terrain-provenance-grid">
                  {m.width}×{m.height} vertices · {Math.round(m.vertex_spacing_m)} m map spacing · DEM{" "}
                  {m.dem.resolution_m} m · ±{m.half_extent_m / 1000} km
                </span>
              </Row>
              <Row label="Heights">
                <span className="font-mono">
                  {km(m.height_min_m)} … {km(m.height_max_m)} (rendered at true scale, no exaggeration)
                </span>
              </Row>
              <Row label="Nodata">
                <span data-testid="terrain-provenance-nodata">
                  {m.nodata_vertex_count} of {m.width * m.height} vertices; {terrain.invalidVertexCount}{" "}
                  skipped by the renderer. {m.nodata}
                </span>
              </Row>
              <Row label="Method">{m.method}</Row>
              <Row label="Citation">{m.dem.citation}</Row>
            </dl>
            {m.evidence.assumptions.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 border-t border-hairline pt-2">
                {m.evidence.assumptions.map((assumption) => (
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
      <HeightLegend minM={m.height_min_m} maxM={m.height_max_m} />
      <LightingDisclosure sun={sun} />
    </>
  );
}

const signed = (deg: number) => `${deg >= 0 ? "+" : "−"}${Math.abs(deg).toFixed(2)}°`;

/**
 * How the terrain is lit. With a selected site: the SPICE Sun direction at the epoch
 * (MODEL), with rendered shadows labelled illustrative and the site's computed
 * illumination shown as not computed until the timeline analysis (T-24) is served.
 * Otherwise: the camera-relative display light, labelled as such.
 */
function LightingDisclosure({ sun }: { sun: TerrainSun }) {
  if (sun.kind === "display") {
    return (
      <div
        className="flex flex-col gap-0.5"
        data-testid="terrain-lighting-disclosure"
        data-lighting="display"
      >
        <div className="flex items-center gap-2">
          <EvidenceBadge
            kind="placeholder"
            label="Display light"
            detail="Shading follows the camera for legibility. It is not the computed solar direction and shows no computed shadows; quantitative illumination comes only from the API."
          />
          <span className="text-3xs text-muted-foreground">
            Illustrative shading — not the computed Sun, not illumination data
          </span>
        </div>
        <span className="text-3xs text-dim">{sun.reason}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1" data-testid="terrain-lighting-disclosure" data-lighting="spice">
      <div className="flex min-w-0 items-center gap-2">
        <EvidenceBadge
          kind={sun.evidence.kind}
          label="SPICE Sun"
          detail={`${sun.evidence.statement} Light direction: C2 direction_moon_me (CN+S) for ${sun.siteName}, interpolated between hourly samples.`}
        />
        <span className="truncate text-3xs text-muted-foreground">
          Sun el.{" "}
          <span className="numeric text-foreground" data-testid="terrain-sun-elevation">
            {signed(sun.elevationDeg)}
          </span>{" "}
          (astronomical) · {formatUtcReadable(sun.epochMs)} UTC · {sun.siteName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <EvidenceBadge
          kind="placeholder"
          label="Illustrative"
          detail="Shadows are rendered by the 3D engine from a point-source Sun over the 240 m mesh (shadow map, no penumbra from the 0.53° disk). They are an illustration, not an illumination result."
        />
        <span className="text-3xs text-muted-foreground">Rendered shadows are illustrative</span>
      </div>
      <SiteIllumination siteName={sun.siteName} />
    </div>
  );
}

const pct = (f: number) => `${(f * 100).toFixed(0)} %`;

/**
 * The selected site's computed illumination (C4, D4) at the epoch, in the 3D view: the
 * visible solar-disk fraction above the terrain horizon (or "terrain horizon not
 * available"), the astronomical fraction, and the window summary. Never a rendered value.
 */
function SiteIllumination({ siteName }: { siteName: string }) {
  const siteId = useMissionStore((s) => s.selectedSiteId);
  const epochMs = useMissionStore((s) => s.epochMs);
  const startMs = useMissionStore((s) => s.windowStartMs);
  const endMs = useMissionStore((s) => s.windowEndMs);
  const query = useSiteTimeline(siteId, startMs, endMs);
  const value = query.data && epochMs !== null ? siteIlluminationAt(query.data, epochMs) : null;

  if (!query.data || !value) {
    const reason = query.isError
      ? describeError(query.error)
      : query.isPending
        ? "computing the illumination timeline…"
        : "epoch outside the computed window";
    return (
      <div
        className="flex items-center gap-2"
        data-testid="terrain-site-illumination"
        data-state="not-computed"
      >
        <EvidenceBadge kind="not_computed" label="N/C" detail={reason} />
        <span className="truncate text-3xs text-dim">
          {siteName}: illumination not computed — {reason}
        </span>
      </div>
    );
  }
  const ev = query.data.illumination.evidence;
  const s = value.summary;
  return (
    <div className="flex items-start gap-2" data-testid="terrain-site-illumination" data-state="computed">
      <EvidenceBadge
        kind={ev.kind}
        label="CALC"
        detail={`${ev.statement} ${query.data.illumination.limitations.join(" ")}`.trim()}
        className="mt-px"
      />
      <span className="min-w-0 text-3xs text-muted-foreground">
        <span className="text-foreground">{siteName}</span> · Sun disk visible{" "}
        {value.terrain === null ? (
          <span data-testid="terrain-site-illumination-terrain">terrain horizon not available</span>
        ) : (
          <span className="numeric text-foreground" data-testid="terrain-site-illumination-terrain">
            {value.terrainUpperBound ? "≤ " : ""}
            {pct(value.terrain)} (terrain horizon)
          </span>
        )}{" "}
        · {pct(value.astronomical)} (astronomical) at {formatUtcReadable(value.sampleMs)} UTC
        <br />
        Window ({s.horizon} horizon): mean disk {pct(s.meanVisibleDiskFraction)} · any part lit{" "}
        {pct(s.illuminatedFraction)}
        {s.anyTruncated ? " · some rays truncated (bounds)" : ""}
      </span>
    </div>
  );
}
