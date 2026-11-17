"use client";

import type { CandidateSite } from "@lunaris/shared-types";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, Quaternion, Vector3, type Group } from "three";

import { useSitesQuery } from "@/lib/api/queries";
import { selenographicToScene } from "@/lib/geo/selenographic";
import { readToken } from "@/lib/theme/tokens";
import { useMissionStore } from "@/store/mission-store";

const Z_AXIS = new Vector3(0, 0, 1);

export function SiteMarkers() {
  const sites = useSitesQuery().data?.sites ?? [];
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const selectSite = useMissionStore((s) => s.selectSite);
  return (
    <group name="site-markers">
      {sites.map((site) => (
        <SiteMarker
          key={site.id}
          site={site}
          selected={site.id === selectedSiteId}
          onSelect={() => selectSite(site.id === selectedSiteId ? null : site.id)}
        />
      ))}
    </group>
  );
}

function SiteMarker({
  site,
  selected,
  onSelect,
}: {
  site: CandidateSite;
  selected: boolean;
  onSelect: () => void;
}) {
  const group = useRef<Group>(null);
  const { latitude_deg: lat, longitude_deg: lon } = site.coordinate;
  const position = useMemo(() => selenographicToScene(lat, lon, 1.002), [lat, lon]);
  const quaternion = useMemo(
    () => new Quaternion().setFromUnitVectors(Z_AXIS, new Vector3(...position).normalize()),
    [position],
  );

  // Keep a roughly constant on-screen size.
  useFrame(({ camera }) => {
    if (!group.current) return;
    const distance = camera.position.distanceTo(group.current.position);
    group.current.scale.setScalar(Math.min(Math.max(distance * 0.9, 0.05), 3));
  });

  const color = selected ? readToken("primary") : readToken("chart-marker-idle");
  return (
    <group ref={group} position={position} quaternion={quaternion}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <ringGeometry args={[0.0075, 0.0105, 40]} />
        <meshBasicMaterial color={color} side={DoubleSide} transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.0028, 20]} />
        <meshBasicMaterial color={color} side={DoubleSide} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh>
          <ringGeometry args={[0.016, 0.0172, 48]} />
          <meshBasicMaterial
            color={readToken("primary")}
            side={DoubleSide}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
