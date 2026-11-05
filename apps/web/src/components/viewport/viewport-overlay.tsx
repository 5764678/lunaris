"use client";

import { Grid3x3, MapPin, Tag } from "lucide-react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatLatitude, formatLongitude } from "@/lib/geo/selenographic";
import { useMissionStore, type LayerVisibility, type ViewPreset } from "@/store/mission-store";

import { VIEW_PRESETS } from "./camera-rig";
import type { SurfaceSource, TextureLoadState } from "./surface-source";
import { SceneSwitch } from "./scene-switch";
import { TextureProvenance } from "./texture-provenance";
import { useViewTelemetry } from "./view-telemetry";

function Corner({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute size-4 border-primary/35 ${className}`}
    />
  );
}

export function ViewportOverlay({
  surface,
  textureState,
}: {
  surface: SurfaceSource;
  textureState: TextureLoadState;
}) {
  const view = useMissionStore((s) => s.view);
  const requestView = useMissionStore((s) => s.requestView);
  const layers = useMissionStore((s) => s.layers);
  const toggleLayer = useMissionStore((s) => s.toggleLayer);
  const telemetry = useViewTelemetry();

  const activeLayers = (Object.keys(layers) as (keyof LayerVisibility)[]).filter((k) => layers[k]);

  return (
    <div className="pointer-events-none absolute inset-0">
      <Corner className="top-3 left-3 border-t border-l" />
      <Corner className="top-3 right-3 border-t border-r" />
      <Corner className="bottom-3 left-3 border-b border-l" />
      <Corner className="right-3 bottom-3 border-r border-b" />

      {/* Title + view presets */}
      <div className="pointer-events-auto absolute top-4 left-4 flex flex-col gap-2 sm:top-5 sm:left-6">
        <div className="w-fit rounded-md border border-hairline bg-[#05070a]/75 px-2.5 py-1.5 backdrop-blur-sm">
          <p className="font-mono text-2xs font-medium uppercase tracking-[0.2em] text-foreground">
            Lunar globe
          </p>
          <p className="hidden font-mono text-3xs text-dim sm:block">
            Body-fixed MOON_ME · reference sphere R = 1737.4 km
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={view.preset}
          onValueChange={(value) => value && requestView(value as ViewPreset)}
          aria-label="Camera view"
        >
          {(Object.keys(VIEW_PRESETS) as ViewPreset[]).map((preset) => (
            <ToggleGroupItem key={preset} value={preset} onClick={() => requestView(preset)}>
              {VIEW_PRESETS[preset].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <SceneSwitch />
      </div>

      {/* Layers */}
      <div className="pointer-events-auto absolute top-4 right-4 sm:top-5 sm:right-6">
        <ToggleGroup type="multiple" value={activeLayers} aria-label="Layers">
          <ToggleGroupItem value="graticule" onClick={() => toggleLayer("graticule")} aria-label="Graticule">
            <Grid3x3 /> <span className="hidden md:inline">Grid</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="sites" onClick={() => toggleLayer("sites")} aria-label="Sites">
            <MapPin /> <span className="hidden md:inline">Sites</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="labels" onClick={() => toggleLayer("labels")} aria-label="Labels">
            <Tag /> <span className="hidden md:inline">Labels</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Disclosures */}
      <div className="pointer-events-auto absolute right-3 bottom-3 left-3 flex flex-col gap-1.5 rounded-md border border-hairline bg-[#05070a]/80 p-2 backdrop-blur-sm sm:right-auto sm:bottom-5 sm:left-6 sm:max-w-[min(34rem,calc(100%-16rem))]">
        <SurfaceDisclosure surface={surface} textureState={textureState} />
        <div className="flex items-center gap-2" data-testid="lighting-disclosure">
          <EvidenceBadge
            kind="placeholder"
            label="Display light"
            detail="Lighting follows the camera for legibility. It is not the computed solar direction; ephemeris-driven illumination arrives in Milestones 03–04."
          />
          <span className="font-mono text-3xs text-muted-foreground">
            View-relative lighting — not the computed Sun direction
          </span>
        </div>
      </div>

      {/* Telemetry */}
      <dl className="absolute right-6 bottom-5 hidden grid-cols-[auto_auto] gap-x-3 gap-y-0.5 rounded-md border border-hairline bg-[#05070a]/80 px-3 py-2 font-mono text-3xs backdrop-blur-sm sm:grid">
        <dt className="text-dim">VIEW CENTER</dt>
        <dd className="numeric text-right text-foreground" data-testid="view-center">
          {telemetry.subLatitudeDeg === null || telemetry.subLongitudeDeg === null
            ? "—"
            : `${formatLatitude(telemetry.subLatitudeDeg, 2)} ${formatLongitude(telemetry.subLongitudeDeg, 2)}`}
        </dd>
        <dt className="text-dim">RANGE (ALT)</dt>
        <dd className="numeric text-right text-foreground">
          {telemetry.altitudeKm === null
            ? "—"
            : `${Math.round(telemetry.altitudeKm).toLocaleString("en-US")} km`}
        </dd>
      </dl>
    </div>
  );
}

function SurfaceDisclosure({
  surface,
  textureState,
}: {
  surface: SurfaceSource;
  textureState: TextureLoadState;
}) {
  if (surface.kind === "texture")
    return <TextureProvenance manifest={surface.manifest} state={textureState} />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          className="flex w-fit items-center gap-2 rounded-[4px] border border-dashed border-ev-placeholder/60 bg-ev-placeholder/10 px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          data-testid="surface-disclosure"
          data-surface={surface.kind}
        >
          <span className="shrink-0 whitespace-nowrap font-mono text-3xs font-medium uppercase tracking-[0.12em] text-ev-placeholder">
            Visual placeholder
          </span>
          <span className="font-mono text-3xs text-muted-foreground">
            Procedural surface — not lunar data, no real features depicted
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-96">
        <p className="font-medium text-foreground">Procedural placeholder surface</p>
        <p className="text-muted-foreground">
          Generated from noise and a synthetic crater field. Run{" "}
          <code className="text-foreground">npm run setup:texture -w @lunaris/web</code> (it acquires{" "}
          <code className="text-foreground">nasa-svs-cgi-moon-kit</code> and runs{" "}
          <code className="text-foreground">build-web-texture</code>) to display the NASA SVS CGI Moon Kit
          color map instead.
        </p>
        {surface.kind === "procedural" && <p className="mt-1 text-dim">{surface.reason}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
