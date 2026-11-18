"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";

import { GlobeSunContext, ProceduralSurface, TexturedSurface } from "@/components/viewport/moon-surface";
import type { SurfaceSource } from "@/components/viewport/surface-source";
import { earthViewPose } from "@/lib/lesson/earth-view";
import type { Vec3 } from "@/lib/geo/selenographic";
import { bodyFixedToScene } from "@/lib/geo/selenographic";

/** Camera distance in lunar radii: the whole disk fills most of the frame. */
const DISTANCE = 4.6;

/**
 * Puts the camera on the Earth side of the Moon, lunar north up (D12). Nothing else moves:
 * the Moon is fixed in its own frame, and stepping through time changes the camera direction
 * (a tiny libration) and the Sun direction (the phase).
 */
function EarthCamera({ earthDirectionMoonMe }: { earthDirectionMoonMe: readonly number[] }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const pose = earthViewPose(earthDirectionMoonMe);
    camera.position.set(
      pose.direction[0] * DISTANCE,
      pose.direction[1] * DISTANCE,
      pose.direction[2] * DISTANCE,
    );
    camera.up.set(pose.up[0], pose.up[1], pose.up[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, earthDirectionMoonMe]);
  return null;
}

/**
 * The lesson's own small WebGL scene. It reuses the globe's surface and shader but not the
 * Explorer's camera rig, site markers or Sun hook, which read the API (contract L3).
 */
export default function EarthViewCanvas({
  surface,
  sunDirectionMoonMe,
  earthDirectionMoonMe,
  onSurfaceError,
  onSurfaceLoaded,
  label,
}: {
  surface: SurfaceSource;
  sunDirectionMoonMe: readonly number[];
  earthDirectionMoonMe: readonly number[];
  onSurfaceError: (reason: string) => void;
  onSurfaceLoaded: () => void;
  label: string;
}) {
  const sun: Vec3 = bodyFixedToScene([
    sunDirectionMoonMe[0]!,
    sunDirectionMoonMe[1]!,
    sunDirectionMoonMe[2]!,
  ]);
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 30, near: 0.05, far: 100, position: [DISTANCE, 0, 0] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      aria-label={label}
      data-testid="earth-view-canvas"
    >
      <GlobeSunContext.Provider value={sun}>
        {surface.kind === "texture" ? (
          <TexturedSurface url={surface.url} onError={onSurfaceError} onLoaded={onSurfaceLoaded} />
        ) : (
          <ProceduralSurface />
        )}
      </GlobeSunContext.Provider>
      <EarthCamera earthDirectionMoonMe={earthDirectionMoonMe} />
    </Canvas>
  );
}
