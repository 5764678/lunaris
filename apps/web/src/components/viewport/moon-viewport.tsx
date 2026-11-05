"use client";

import { TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { Component, useCallback, useState, type ErrorInfo, type ReactNode } from "react";

import { LabelLayer } from "./label-layer";
import { LabelRegistry } from "./label-registry";
import { useSurfaceLabels } from "./surface-labels";
import { useSurfaceSource, type SurfaceSource, type TextureLoadState } from "./surface-source";
import { ViewportOverlay } from "./viewport-overlay";

const MoonCanvas = dynamic(() => import("./moon-canvas"), {
  ssr: false,
  loading: () => <ViewportMessage title="Initializing renderer" detail="Loading WebGL scene…" pulse />,
});

function ViewportMessage({ title, detail, pulse }: { title: string; detail: string; pulse?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <p
          className={`font-mono text-2xs uppercase tracking-[0.2em] text-muted-foreground ${pulse ? "animate-pulse" : ""}`}
        >
          {title}
        </p>
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

export function MoonViewport() {
  const resolved = useSurfaceSource();
  const [textureError, setTextureError] = useState<string | null>(null);
  const [textureState, setTextureState] = useState<TextureLoadState>("loading");
  const onSurfaceError = useCallback((reason: string) => setTextureError(reason), []);
  const onSurfaceLoaded = useCallback(() => setTextureState("loaded"), []);
  const [labelRegistry] = useState(() => new LabelRegistry());
  const labels = useSurfaceLabels();
  const surface: SurfaceSource =
    textureError && resolved.kind === "texture" ? { kind: "procedural", reason: textureError } : resolved;
  return (
    <section
      aria-label="Lunar visualization"
      className="hud-grid relative h-full min-h-[22rem] overflow-hidden"
    >
      <RendererBoundary>
        {surface.kind === "resolving" ? (
          <ViewportMessage title="Initializing renderer" detail="Resolving surface source…" pulse />
        ) : (
          <MoonCanvas
            surface={surface}
            onSurfaceError={onSurfaceError}
            onSurfaceLoaded={onSurfaceLoaded}
            labelRegistry={labelRegistry}
          />
        )}
      </RendererBoundary>
      <LabelLayer registry={labelRegistry} labels={labels} />
      <ViewportOverlay surface={surface} textureState={textureState} />
    </section>
  );
}
