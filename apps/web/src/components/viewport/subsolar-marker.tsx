"use client";

import { useMemo } from "react";
import { DoubleSide, Quaternion, Vector3 } from "three";

import { selenographicToScene } from "@/lib/geo/selenographic";

const Z = new Vector3(0, 0, 1);

/** Marks the sub-solar point (Sun at the zenith) on the globe: a small sun ring. */
export function SubsolarMarker({ latDeg, lonDeg }: { latDeg: number; lonDeg: number }) {
  const position = useMemo(() => selenographicToScene(latDeg, lonDeg, 1.003), [latDeg, lonDeg]);
  const quaternion = useMemo(
    () => new Quaternion().setFromUnitVectors(Z, new Vector3(...position).normalize()),
    [position],
  );
  return (
    <group position={position} quaternion={quaternion} name="subsolar-point">
      <mesh>
        <ringGeometry args={[0.012, 0.016, 40]} />
        <meshBasicMaterial color="#f0b54a" side={DoubleSide} transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.005, 24]} />
        <meshBasicMaterial color="#f0b54a" side={DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
