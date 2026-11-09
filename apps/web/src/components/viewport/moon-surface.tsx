"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector3,
} from "three";

import type { Vec3 } from "@/lib/geo/selenographic";

import { MODE_PROCEDURAL, MODE_TEXTURE, moonFragmentShader, moonVertexShader } from "./moon-shader";

const up = new Vector3();
const right = new Vector3();
const toCamera = new Vector3();

/**
 * The Sun lighting the globe, in scene axes (MOON_ME rotated to three.js Y-up), or null
 * for the camera-relative display light. Provided by MoonCanvas from the SPICE series.
 */
export const GlobeSunContext = createContext<Vec3 | null>(null);

/** Night-side floor: the SPICE-lit globe has no earthshine, so the night side is lifted
 *  slightly (dark, not black) for visibility. Disclosed in the HUD. */
const NIGHT_FLOOR_SPICE = 0.045;
const NIGHT_FLOOR_DISPLAY = 0.018;

/** Uniform writes live outside the hooks: three.js uniforms are mutable by design. */
function setNightFloor(material: ShaderMaterial, value: number) {
  material.uniforms.uNightFloor!.value = value;
}

/** SPICE Sun when provided; otherwise the display light from the upper-left of the view
 *  (labelled in the HUD as not the computed Sun). */
function useSurfaceLight(material: ShaderMaterial) {
  const sun = useContext(GlobeSunContext);
  const invalidate = useThree((s) => s.invalidate);
  // Demand rendering: draw a frame whenever the Sun moves (scrubbing the timeline).
  useEffect(() => invalidate(), [sun, invalidate]);
  useFrame(({ camera }) => {
    const light = material.uniforms.uLightDir!.value as Vector3;
    setNightFloor(material, sun ? NIGHT_FLOOR_SPICE : NIGHT_FLOOR_DISPLAY);
    if (sun) {
      light.set(sun[0], sun[1], sun[2]).normalize();
      return;
    }
    toCamera.copy(camera.position).normalize();
    up.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    right.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    light.copy(toCamera).addScaledVector(up, 1.05).addScaledVector(right, -0.85).normalize();
  });
}

/** One material per texture: the Sun only changes uniforms, never the program. */
function makeMaterial(texture: Texture | null) {
  return new ShaderMaterial({
    vertexShader: moonVertexShader,
    fragmentShader: moonFragmentShader,
    uniforms: {
      uLightDir: { value: new Vector3(0.5, 0.5, 0.7).normalize() },
      uMode: { value: texture ? MODE_TEXTURE : MODE_PROCEDURAL },
      uColorMap: { value: texture },
      uExposure: { value: texture ? 1.1 : 1.0 },
      uNightFloor: { value: NIGHT_FLOOR_DISPLAY },
    },
  });
}

function SurfaceMesh({ material }: { material: ShaderMaterial }) {
  useSurfaceLight(material);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} name="lunar-surface">
      <sphereGeometry args={[1, 192, 128]} />
    </mesh>
  );
}

export function ProceduralSurface() {
  const material = useMemo(() => makeMaterial(null), []);
  return <SurfaceMesh material={material} />;
}

/** Loads the acquired NASA color map. Renders nothing until loaded, so the HUD's
 *  "NASA SVS" disclosure never sits over the placeholder surface. */
export function TexturedSurface({
  url,
  onError,
  onLoaded,
}: {
  url: string;
  onError: (reason: string) => void;
  onLoaded: () => void;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
    new TextureLoader().load(
      url,
      (loaded) => {
        if (cancelled) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = SRGBColorSpace;
        loaded.minFilter = LinearMipmapLinearFilter;
        loaded.anisotropy = Math.min(8, maxAnisotropy);
        loaded.needsUpdate = true;
        setTexture(loaded);
        onLoaded();
        invalidate();
      },
      undefined,
      () => {
        if (!cancelled) onError(`Texture ${url} could not be loaded.`);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, gl, invalidate, onError, onLoaded]);

  useEffect(() => () => texture?.dispose(), [texture]);
  const material = useMemo(() => (texture ? makeMaterial(texture) : null), [texture]);
  return material ? <SurfaceMesh material={material} /> : null;
}
