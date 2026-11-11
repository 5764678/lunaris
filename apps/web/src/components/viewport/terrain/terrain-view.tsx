"use client";

import { Grid3x3, MapPin, RotateCcw, Tag, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { describeError } from "@/lib/api/client";
import { useTerrainScene } from "@/lib/api/queries";
import { useMissionStore, type LayerVisibility } from "@/store/mission-store";

import { LabelLayer, type LabelSpec } from "../label-layer";
import type { LabelRegistry } from "../label-registry";
import { SceneSwitch } from "../scene-switch";
import { TerrainDisclosures } from "./terrain-overlay";
import { useTerrainSitePlacements } from "./terrain-placements";
import { useTerrainSun } from "./use-terrain-sun";

export const TERRAIN_SCENE_ID = "south-pole";

const TerrainCanvas = dynamic(() => import("./terrain-canvas"), { ssr: false });

const SITE_CLASS =
  "rounded-[3px] border border-white/15 bg-black/60 px-1.5 py-px font-mono text-[12px] text-[#e6eaef] backdrop-blur-sm";
const SITE_SELECTED_CLASS =
  "rounded-[3px] border border-primary/60 bg-[#071425]/90 px-1.5 py-px font-mono text-[12px] text-primary";

/**
 * Vertex grid requested from C3: 1024² (≈245 m spacing, close to the DEM's 240 m) on
 * wide screens; 512² (≈490 m, 4 MiB instead of 16) on phone-width screens. `null`
 * until mounted, so prerendered HTML never depends on the window.
 */
const NARROW_QUERY = "(max-width: 640px)";

/** `?terrain_grid=N` (64–1024) overrides the grid, for benchmarks and tests. */
export function gridOverride(search: string): number | null {
  const raw = new URLSearchParams(search).get("terrain_grid");
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 64 && n <= 1024 ? n : null;
}

function subscribeNarrow(onChange: () => void) {
  const media = window.matchMedia(NARROW_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useTerrainGridSize(): number | null {
  return useSyncExternalStore(
    subscribeNarrow,
    () => gridOverride(window.location.search) ?? (window.matchMedia(NARROW_QUERY).matches ? 512 : 1024),
    () => null,
  );
}

function Message({ title, detail, children }: { title: string; detail: string; children?: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
        <p className="mt-1 text-3xs text-dim">{detail}</p>
        {children}
      </div>
    </div>
  );
}

export function TerrainView({ labelRegistry }: { labelRegistry: LabelRegistry }) {
  const gridSize = useTerrainGridSize();
  const query = useTerrainScene(TERRAIN_SCENE_ID, gridSize ?? 0, gridSize !== null);
  const placements = useTerrainSitePlacements(query.data);
  const layers = useMissionStore((s) => s.layers);
  const sun = useTerrainSun();
  const toggleLayer = useMissionStore((s) => s.toggleLayer);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const exitTerrain = useMissionStore((s) => s.exitTerrain);
  const [settled, setSettled] = useState(false);
  const [viewKey, setViewKey] = useState(0);

  const labels = useMemo<LabelSpec[]>(() => {
    if (!layers.labels || !layers.sites) return [];
    return placements.map((p) => ({
      id: `terrain-site-${p.siteId}`,
      text: p.name,
      // Label sits above the pin head (pins are ~2 km tall at the hero distance).
      position: [
        p.position[0] + p.normal[0] * 3,
        p.position[1] + p.normal[1] * 3,
        p.position[2] + p.normal[2] * 3,
      ],
      normal: p.normal,
      offset: "above" as const,
      className: p.siteId === selectedSiteId ? SITE_SELECTED_CLASS : SITE_CLASS,
    }));
  }, [placements, layers.labels, layers.sites, selectedSiteId]);

  const activeLayers = (["sites", "labels"] as (keyof LayerVisibility)[]).filter((k) => layers[k]);
  const state = query.isError ? "error" : query.data ? "ready" : "loading";

  return (
    <div
      className="absolute inset-0"
      data-testid="terrain-view"
      data-terrain-state={state}
      data-settled={settled ? "true" : "false"}
      data-grid-size={gridSize ?? undefined}
      data-lighting={sun.kind}
      data-valid-vertices={query.data?.terrain.validVertexCount}
      data-skipped-vertices={query.data?.terrain.invalidVertexCount}
      data-triangles={query.data?.terrain.triangleCount}
    >
      {query.data ? (
        <TerrainCanvas
          key={viewKey}
          scene={query.data}
          placements={placements}
          labelRegistry={labelRegistry}
          onSettled={() => setSettled(true)}
          sunDirection={sun.kind === "spice" ? sun.direction : null}
        />
      ) : query.isError ? (
        <Message title="Terrain unavailable" detail={describeError(query.error)}>
          <TriangleAlert className="mx-auto mt-2 size-4 text-warn" aria-hidden="true" />
          <Button size="sm" variant="outline" className="mt-3" onClick={exitTerrain}>
            Back to globe
          </Button>
        </Message>
      ) : (
        <Message
          title="Loading LOLA terrain"
          detail={`South pole ±125 km, ${gridSize ?? "…"}² vertices (${gridSize ? (gridSize * gridSize * 16) / 2 ** 20 : "…"} MiB)…`}
        />
      )}
      <LabelLayer registry={labelRegistry} labels={labels} />

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute top-4 left-4 flex flex-col gap-2 sm:top-5 sm:left-6">
          <div className="w-fit rounded-md border border-hairline bg-[#05070a]/75 px-2.5 py-1.5 backdrop-blur-sm">
            <p className="font-mono text-2xs font-medium uppercase tracking-[0.2em] text-foreground">
              South-pole terrain
            </p>
            <p className="hidden font-mono text-3xs text-dim sm:block">
              MOON_ME, origin at the pole · camera up = local radial · true vertical scale
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SceneSwitch />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSettled(false);
                setViewKey((k) => k + 1);
              }}
              disabled={!query.data}
              aria-label="Reset terrain view"
            >
              <RotateCcw /> <span className="hidden md:inline">Reset view</span>
            </Button>
          </div>
        </div>

        <div className="pointer-events-auto absolute top-4 right-4 sm:top-5 sm:right-6">
          <ToggleGroup type="multiple" value={activeLayers} aria-label="Layers">
            <ToggleGroupItem value="sites" onClick={() => toggleLayer("sites")} aria-label="Sites">
              <MapPin /> <span className="hidden md:inline">Sites</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="labels" onClick={() => toggleLayer("labels")} aria-label="Labels">
              <Tag /> <span className="hidden md:inline">Labels</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="graticule" disabled aria-label="Graticule (globe only)">
              <Grid3x3 />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {query.data && (
          <div className="pointer-events-auto absolute right-3 bottom-3 left-3 flex flex-col gap-1.5 rounded-md border border-hairline bg-[#05070a]/80 p-2 backdrop-blur-sm sm:right-auto sm:bottom-5 sm:left-6 sm:max-w-[min(36rem,calc(100%-3rem))]">
            <TerrainDisclosures scene={query.data} sun={sun} />
            <p className="font-mono text-3xs text-dim" data-testid="terrain-site-count">
              {placements.length === 0
                ? "No registered site lies inside this scene."
                : `${placements.length} site${placements.length === 1 ? "" : "s"} on the terrain (marker placement is display-only).`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
