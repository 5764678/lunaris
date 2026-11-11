"use client";

import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";

import { CellEvidence } from "@/components/evidence/cell-evidence";
import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSitesQuery } from "@/lib/api/queries";
import { formatLatitude, formatLongitude } from "@/lib/geo/selenographic";
import { useMissionStore } from "@/store/mission-store";

import {
  DEFAULT_FOOTPRINT_RADIUS_M,
  fetchSiteTerrain,
  parseThreshold,
  terrainCells,
  TerrainRequestError,
  type SiteTerrain,
  type TerrainQuery,
} from "./terrain-api";

const MAX_FOOTPRINT_M = 2000;

function Metric({ label, testId, children }: { label: string; testId: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-hairline bg-panel px-2.5 py-2" data-testid={testId}>
      <p className="label-caps mb-1 truncate">{label}</p>
      {children}
    </div>
  );
}

function HazardPanel({ result }: { result: SiteTerrain }) {
  const hazard = result.hazard;
  if (!hazard) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="hazard-none">
        No hazard evaluation: enter a maximum slope or bumpiness above. LUNARIS ships no default “safe” slope.
      </p>
    );
  }
  const flag = (v: boolean | null) => (v === null ? "not evaluated" : v ? "exceeds" : "within");
  return (
    <div
      className="space-y-1.5 rounded-md border border-hairline bg-panel px-2.5 py-2"
      data-testid="hazard-flags"
    >
      <p className="flex flex-wrap items-center gap-2 text-xs text-foreground">
        <EvidenceBadge kind="assumption" label="User assumption" detail={hazard.evidence.statement} />
        Hazard flags against your thresholds
      </p>
      <ul className="space-y-1 font-mono text-2xs text-muted-foreground">
        {hazard.max_slope_deg !== null && (
          <>
            <li data-testid="hazard-slope">
              steep spots (slope, worst 5 %) vs max {hazard.max_slope_deg}°:{" "}
              <span className="text-foreground">{flag(hazard.slope_p95_exceeds)}</span>
            </li>
            <li data-testid="hazard-slope-fraction">
              footprint cells steeper than {hazard.max_slope_deg}°:{" "}
              <span className="text-foreground">
                {hazard.slope_fraction_above === null
                  ? "n/a"
                  : `${(hazard.slope_fraction_above * 100).toFixed(1)} %`}
              </span>
            </li>
          </>
        )}
        {hazard.max_roughness_m !== null && (
          <li data-testid="hazard-roughness">
            bumpiness vs max {hazard.max_roughness_m} m:{" "}
            <span className="text-foreground">{flag(hazard.roughness_exceeds)}</span>
          </li>
        )}
      </ul>
      <ul className="space-y-0.5 text-3xs text-dim">
        {hazard.evidence.assumptions.map((a) => (
          <li key={a}>Assumption: {a}</li>
        ))}
      </ul>
    </div>
  );
}

function Results({ result }: { result: SiteTerrain }) {
  const c = terrainCells(result);
  const fp = result.footprint;
  return (
    <section className="space-y-3" data-testid="terrain-results" aria-label="Terrain analysis results">
      <p className="text-xs text-muted-foreground">
        {formatLatitude(result.latitude_deg)} {formatLongitude(result.longitude_deg)} · footprint radius{" "}
        {fp.radius_m} m ({fp.cell_count} cells) · {result.dem.title} · scale factor k ={" "}
        {result.scale_factor.toFixed(5)}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Height" testId="metric-height">
          <CellEvidence
            cell={c.height}
            label="Height"
            testId="value-height"
            mapNote="20 m map"
            meaning="Ground height at the site above the Moon's reference sphere (radius 1,737.4 km), read from the 20 m map. The Compare page reads the coarser 240 m map, so its value can differ by a few metres."
          />
        </Metric>
        <Metric label="Slope at site" testId="metric-slope-site">
          <CellEvidence cell={c.slopeAtSite} label="Slope at site" testId="value-slope-site" />
        </Metric>
        <Metric label="Steep spots (slope, worst 5 %)" testId="metric-slope-p95">
          <CellEvidence cell={c.slopeP95} label="Steep spots (slope, worst 5 %)" testId="value-slope-p95" />
        </Metric>
        <Metric label="Bumpiness" testId="metric-roughness">
          <CellEvidence cell={c.roughness} label="Bumpiness" testId="value-roughness" />
        </Metric>
        <Metric label="Average slope" testId="metric-slope-mean">
          <CellEvidence cell={c.slopeMean} label="Average slope" testId="value-slope-mean" />
        </Metric>
        <Metric label="Steepest slope" testId="metric-slope-max">
          <CellEvidence cell={c.slopeMax} label="Steepest slope" testId="value-slope-max" />
        </Metric>
        <Metric label="Map gaps (cells)" testId="metric-missing">
          <CellEvidence cell={c.missingCells} label="Missing DEM cells" testId="value-missing" />
        </Metric>
      </div>
      <HazardPanel result={result} />
      <ul className="space-y-0.5 text-3xs text-dim" data-testid="terrain-limitations">
        {result.limitations.map((l) => (
          <li key={l}>Limitation: {l}</li>
        ))}
      </ul>
    </section>
  );
}

export function TerrainAnalysis() {
  const formId = useId();
  const sites = useSitesQuery();
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const selectSite = useMissionStore((s) => s.selectSite);
  const [chosenSiteId, setSiteId] = useState<string>("");
  const [radius, setRadius] = useState(String(DEFAULT_FOOTPRINT_RADIUS_M));
  const [maxSlope, setMaxSlope] = useState("");
  const [maxRough, setMaxRough] = useState("");
  const [submitted, setSubmitted] = useState<TerrainQuery | null>(null);

  const list = sites.data?.sites ?? [];
  // Default to the globally selected site, else the first registered one; derived, not stored.
  const siteId =
    chosenSiteId !== ""
      ? chosenSiteId
      : list.some((s) => s.id === selectedSiteId)
        ? (selectedSiteId as string)
        : (list[0]?.id ?? "");

  const radiusValue = Number(radius);
  const radiusOk = Number.isFinite(radiusValue) && radiusValue > 0 && radiusValue <= MAX_FOOTPRINT_M;
  const slopeValue = parseThreshold(maxSlope, 90);
  const roughValue = parseThreshold(maxRough);
  const valid = siteId !== "" && radiusOk && slopeValue !== "invalid" && roughValue !== "invalid";

  const query = useQuery({
    queryKey: ["sites", submitted?.siteId, "terrain", submitted],
    queryFn: ({ signal }) => fetchSiteTerrain(submitted as TerrainQuery, signal),
    enabled: submitted !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });

  return (
    <div className="space-y-4">
      <form
        id={formId}
        className="grid grid-cols-1 gap-3 rounded-md border border-border bg-panel p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          selectSite(siteId);
          setSubmitted({
            siteId,
            footprintRadiusM: radiusValue,
            maxSlopeDeg: slopeValue as number | null,
            maxRoughnessM: roughValue as number | null,
          });
        }}
        aria-label="Terrain analysis inputs"
      >
        <div className="min-w-0 space-y-1">
          <Label htmlFor={`${formId}-site`}>Site</Label>
          <select
            id={`${formId}-site`}
            data-testid="terrain-site"
            className="h-8 w-full rounded-md border border-input bg-panel-sunken px-2 text-xs text-foreground"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            disabled={list.length === 0}
          >
            {list.length === 0 && <option value="">No sites registered</option>}
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${formId}-radius`}>Footprint radius (m)</Label>
          <Input
            id={`${formId}-radius`}
            data-testid="terrain-radius"
            inputMode="decimal"
            value={radius}
            aria-invalid={!radiusOk}
            onChange={(e) => setRadius(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${formId}-slope`}>Max slope (°) · assumption</Label>
          <Input
            id={`${formId}-slope`}
            data-testid="terrain-max-slope"
            inputMode="decimal"
            placeholder="optional"
            value={maxSlope}
            aria-invalid={slopeValue === "invalid"}
            onChange={(e) => setMaxSlope(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${formId}-rough`}>Max bumpiness (m) · assumption</Label>
          <Input
            id={`${formId}-rough`}
            data-testid="terrain-max-roughness"
            inputMode="decimal"
            placeholder="optional"
            value={maxRough}
            aria-invalid={roughValue === "invalid"}
            onChange={(e) => setMaxRough(e.target.value)}
          />
        </div>
        <Button type="submit" data-testid="terrain-submit" disabled={!valid || query.isFetching}>
          {query.isFetching ? "Analysing…" : "Analyse"}
        </Button>
      </form>

      {submitted === null && (
        <p className="text-xs text-muted-foreground" data-testid="terrain-idle">
          Choose a site and press Analyse. The first analysis of a site reads a DEM window over the network
          and can take about 15 s; later ones come from the local cache.
        </p>
      )}
      {query.isFetching && (
        <p className="text-xs text-muted-foreground" data-testid="terrain-loading" role="status">
          Reading the DEM window and computing…
        </p>
      )}
      {query.error && !query.isFetching && (
        <p className="text-xs text-critical" data-testid="terrain-error" role="alert">
          {query.error instanceof TerrainRequestError && query.error.code === "out_of_coverage"
            ? `Outside DEM coverage: ${query.error.message}`
            : query.error.message}
        </p>
      )}
      {query.data && !query.isFetching && <Results result={query.data} />}
    </div>
  );
}
