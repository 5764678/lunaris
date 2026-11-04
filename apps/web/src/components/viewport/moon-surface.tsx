"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import {
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector3,
} from "three";

import { MODE_PROCEDURAL, MODE_TEXTURE, moonFragmentShader, moonVertexShader } from "./moon-shader";

const up = new Vector3();
const right = new Vector3();
const toCamera = new Vector3();

/** Display light: from the upper-left of the current view. NOT the computed Sun. */
function useDisplayLight(material: ShaderMaterial) {
  useFrame(({ camera }) => {
    toCamera.copy(camera.position).normalize();
    up.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    right.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    const light = material.uniforms.uLightDir!.value as Vector3;
    light.copy(toCamera).addScaledVector(up, 1.05).addScaledVector(right, -0.85).normalize();
  });
}

function makeMaterial(texture: Texture | null) {
  return new ShaderMaterial({
    vertexShader: moonVertexShader,
    fragmentShader: moonFragmentShader,
    uniforms: {
      uLightDir: { value: new Vector3(0.5, 0.5, 0.7).normalize() },
      uMode: { value: texture ? MODE_TEXTURE : MODE_PROCEDURAL },
      uColorMap: { value: texture },
      uExposure: { value: texture ? 1.1 : 1.0 },
    },
  });
}

function SurfaceMesh({ material }: { material: ShaderMaterial }) {
  useDisplayLight(material);
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
