"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import { useMissionStore } from "@/store/mission-store";

import { CameraRig, INITIAL_CAMERA_POSITION } from "./camera-rig";
import { Graticule } from "./graticule";
import { LabelProjector } from "./label-layer";
import type { LabelRegistry } from "./label-registry";
import { ProceduralSurface, TexturedSurface } from "./moon-surface";
import { SiteMarkers } from "./site-markers";
import type { SurfaceSource } from "./surface-source";

/**
 * The WebGL scene. Rendered on demand (no continuous animation loop): the scene is
 * static, so frames are only drawn on interaction, data changes or camera tweens.
 */
export default function MoonCanvas({
  surface,
  onSurfaceError,
  onSurfaceLoaded,
  labelRegistry,
}: {
  surface: SurfaceSource;
  onSurfaceError: (reason: string) => void;
  onSurfaceLoaded: () => void;
  labelRegistry: LabelRegistry;
}) {
  const layers = useMissionStore((s) => s.layers);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 35, near: 0.005, far: 100, position: [...INITIAL_CAMERA_POSITION] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      aria-label="Interactive 3D lunar globe"
      data-testid="moon-canvas"
    >
      {surface.kind === "texture" ? (
        <TexturedSurface url={surface.url} onError={onSurfaceError} onLoaded={onSurfaceLoaded} />
      ) : (
        <ProceduralSurface />
      )}
      {layers.graticule && <Graticule />}
      {layers.sites && <SiteMarkers />}
      <LabelProjector registry={labelRegistry} />
      <CameraRig />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.09}
        zoomSpeed={0.55}
        minDistance={1.06}
        maxDistance={8}
        minPolarAngle={0.01}
        maxPolarAngle={Math.PI - 0.01}
      />
    </Canvas>
  );
}
