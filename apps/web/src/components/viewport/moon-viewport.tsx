"use client";

import { TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from "react";

import { useTerrainScene } from "@/lib/api/queries";
import { useMissionStore } from "@/store/mission-store";

import { LabelLayer } from "./label-layer";
import { LabelRegistry } from "./label-registry";
import { useSurfaceLabels } from "./surface-labels";
import { useSurfaceSource, type SurfaceSource, type TextureLoadState } from "./surface-source";
import { TERRAIN_SCENE_ID, TerrainView, useTerrainGridSize } from "./terrain/terrain-view";
import { useGlobeSun } from "./use-globe-sun";
import { ViewportOverlay } from "./viewport-overlay";

/** Globe camera descent to the pole before the terrain scene takes over (matches the camera tween). */
const DESCENT_HANDOVER_MS = 1150;

const MoonCanvas = dynamic(() => import("./moon-canvas"), {
  ssr: false,
  loading: () => <ViewportMessage title="Initializing renderer" detail="Loading WebGL scene…" pulse />,
});

function ViewportMessage({ title, detail, pulse }: { title: string; detail: string; pulse?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <p className={`text-xs font-medium text-muted-foreground ${pulse ? "animate-pulse" : ""}`}>{title}</p>
        <p className="mt-1 text-3xs text-dim">{detail}</p>
      </div>
    </div>
  );
}

class RendererBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("LUNARIS viewport renderer failed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-6" role="alert">
          <div className="max-w-sm rounded-md border border-warn/30 bg-warn/5 p-4 text-center">
            <TriangleAlert className="mx-auto mb-2 size-5 text-warn" aria-hidden="true" />
            <p className="text-xs text-foreground">3D view unavailable</p>
            <p className="mt-1 text-2xs text-muted-foreground">
              WebGL 2 could not be initialized in this browser. The rest of the workspace remains functional.
            </p>
            <p className="mt-2 font-mono text-3xs text-dim">{this.state.error.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Site labels pile up on a phone-sized globe: default them off below md, once per page load.
let narrowLabelDefaultApplied = false;

export function MoonViewport() {
  const scene = useMissionStore((s) => s.scene);
  const descending = useMissionStore((s) => s.sceneTransition === "descending");
  const completeDescent = useMissionStore((s) => s.completeDescent);
  const [labelRegistry] = useState(() => new LabelRegistry());
  const gridSize = useTerrainGridSize();
  // Start downloading the terrain while the globe flies down, so the handover is quick.
  useTerrainScene(TERRAIN_SCENE_ID, gridSize ?? 0, gridSize !== null && (descending || scene === "terrain"));

  useEffect(() => {
    if (narrowLabelDefaultApplied) return;
    narrowLabelDefaultApplied = true;
    const { layers, toggleLayer } = useMissionStore.getState();
    if (layers.labels && window.matchMedia("(max-width: 767px)").matches) toggleLayer("labels");
  }, []);

  useEffect(() => {
    if (!descending) return;
    const timer = setTimeout(completeDescent, DESCENT_HANDOVER_MS);
    return () => clearTimeout(timer);
  }, [descending, completeDescent]);

  return (
    <section
      aria-label="Lunar visualization"
      className="space hud-grid relative h-full min-h-[22rem] overflow-hidden"
      data-scene={scene}
    >
      <RendererBoundary>
        {scene === "terrain" ? (
          <TerrainView labelRegistry={labelRegistry} />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              opacity: descending ? 0 : 1,
              transition: descending ? "opacity 350ms ease 750ms" : "none",
            }}
          >
            <GlobeView labelRegistry={labelRegistry} />
          </div>
        )}
      </RendererBoundary>
    </section>
  );
}

function GlobeView({ labelRegistry }: { labelRegistry: LabelRegistry }) {
  const resolved = useSurfaceSource();
  const [textureError, setTextureError] = useState<string | null>(null);
  const [textureState, setTextureState] = useState<TextureLoadState>("loading");
  const onSurfaceError = useCallback((reason: string) => setTextureError(reason), []);
  const onSurfaceLoaded = useCallback(() => setTextureState("loaded"), []);
  const labels = useSurfaceLabels();
  const sun = useGlobeSun();
  const surface: SurfaceSource =
    textureError && resolved.kind === "texture" ? { kind: "procedural", reason: textureError } : resolved;
  return (
    <>
      {surface.kind === "resolving" ? (
        <ViewportMessage title="Initializing renderer" detail="Resolving surface source…" pulse />
      ) : (
        <MoonCanvas
          surface={surface}
          onSurfaceError={onSurfaceError}
          sun={sun}
          onSurfaceLoaded={onSurfaceLoaded}
          labelRegistry={labelRegistry}
        />
      )}
      <LabelLayer registry={labelRegistry} labels={labels} />
      <ViewportOverlay surface={surface} textureState={textureState} sun={sun} />
    </>
  );
}
