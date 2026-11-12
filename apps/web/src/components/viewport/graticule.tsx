"use client";

import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";

import { selenographicToScene } from "@/lib/geo/selenographic";
import { readToken } from "@/lib/theme/tokens";

const RADIUS = 1.0015;

function circleOfLatitude(latDeg: number, steps = 180): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    const a = selenographicToScene(latDeg, (i / steps) * 360, RADIUS);
    const b = selenographicToScene(latDeg, ((i + 1) / steps) * 360, RADIUS);
    out.push(...a, ...b);
  }
  return out;
}

function meridian(lonDeg: number, fromLat: number, toLat: number, steps = 90): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    const latA = fromLat + ((toLat - fromLat) * i) / steps;
    const latB = fromLat + ((toLat - fromLat) * (i + 1)) / steps;
    out.push(...selenographicToScene(latA, lonDeg, RADIUS), ...selenographicToScene(latB, lonDeg, RADIUS));
  }
  return out;
}

function useLineGeometry(build: () => number[]) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(build(), 3));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- static geometry
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Planetocentric graticule (definitional geometry): 10° parallels, 30° meridians,
 *  south-polar circles at 85°S and 88°S, prime meridian emphasized. */
export function Graticule() {
  const minor = useLineGeometry(() => {
    const lines: number[] = [];
    for (let lat = -80; lat <= 80; lat += 10) if (lat !== 0) lines.push(...circleOfLatitude(lat));
    lines.push(...circleOfLatitude(-85), ...circleOfLatitude(-88, 120));
    for (let lon = 30; lon < 360; lon += 30) lines.push(...meridian(lon, -90, 90));
    return lines;
  });
  const major = useLineGeometry(() => [...circleOfLatitude(0), ...meridian(0, -90, 90)]);

  return (
    <group name="graticule">
      <lineSegments geometry={minor}>
        <lineBasicMaterial
          color={readToken("chart-graticule")}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments geometry={major}>
        <lineBasicMaterial
          color={readToken("chart-graticule")}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}
