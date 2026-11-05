"use client";

import { useMemo } from "react";

import type { TerrainScene } from "@/lib/api/queries";
import { useSitesQuery } from "@/lib/api/queries";
import { placeOnTerrain, type Vec3 } from "@/lib/terrain/scene-data";

/** Scene unit of the terrain canvas: kilometres (vertex buffer is metres, scaled by 1e-3). */
export const TERRAIN_UNIT_M = 1000;

export interface TerrainSitePlacement {
  siteId: string;
  name: string;
  /** Marker position in scene units (km) relative to the scene origin. */
  position: Vec3;
  /** Local radial "up" (unit vector, MOON_ME axes). */
  normal: Vec3;
}

/**
 * Display placement of the registered sites on the terrain mesh (nearest valid vertex
 * along the site's radial line). Sites outside the scene are omitted. These positions
 * are for drawing only; no height is reported from them.
 */
export function useTerrainSitePlacements(scene: TerrainScene | undefined): TerrainSitePlacement[] {
  const sites = useSitesQuery().data?.sites;
  return useMemo(() => {
    if (!scene || !sites) return [];
    const { metadata, terrain } = scene;
    const origin = metadata.origin_moon_me_m as unknown as Vec3;
    // Two vertex spacings of angular tolerance: farther than that, the site is off-scene.
    const maxAngle = (2 * metadata.vertex_spacing_m) / metadata.height_reference_radius_m;
    const out: TerrainSitePlacement[] = [];
    for (const site of sites) {
      const b = site.body_fixed_position;
      const placed = placeOnTerrain(terrain, origin, [b.x_m, b.y_m, b.z_m], maxAngle);
      if (!placed) continue;
      const [px, py, pz] = placed.position;
      const ax = origin[0] + px;
      const ay = origin[1] + py;
      const az = origin[2] + pz;
      const r = Math.hypot(ax, ay, az);
      out.push({
        siteId: site.id,
        name: site.name,
        position: [px / TERRAIN_UNIT_M, py / TERRAIN_UNIT_M, pz / TERRAIN_UNIT_M],
        normal: [ax / r, ay / r, az / r],
      });
    }
    return out;
  }, [scene, sites]);
}
