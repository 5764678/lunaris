"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";

import { useSitesQuery } from "@/lib/api/queries";
import {
  REFERENCE_RADIUS_KM,
  sceneToSelenographic,
  selenographicToScene,
  type Vec3,
} from "@/lib/geo/selenographic";
import { useMissionStore, type ViewPreset } from "@/store/mission-store";

import { useViewTelemetry } from "./view-telemetry";

/** Camera positions (scene units = lunar radii). South-pole view keeps 0° at the top. */
export const VIEW_PRESETS: Record<ViewPreset, { lat: number; lon: number; distance: number; label: string }> =
  {
    "south-polar": { lat: -50, lon: 20, distance: 4.3, label: "South polar" },
    "south-pole": { lat: -89.5, lon: 0, distance: 3.0, label: "Pole" },
    "near-side": { lat: 0, lon: 0, distance: 4.3, label: "Near side" },
    "far-side": { lat: 0, lon: 180, distance: 4.3, label: "Far side" },
  };

export const INITIAL_CAMERA_POSITION: Vec3 = selenographicToScene(
  VIEW_PRESETS["south-polar"].lat,
  VIEW_PRESETS["south-polar"].lon,
  VIEW_PRESETS["south-polar"].distance,
);

/** The subset of the orbit-controls API the rig needs (drei registers them as default). */
interface OrbitControlsLike {
  enabled: boolean;
  rotateSpeed: number;
  update: () => void;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

interface Tween {
  fromDir: Vector3;
  toDir: Vector3;
  fromDistance: number;
  toDistance: number;
  start: number;
  duration: number;
}

const scratch = new Vector3();

function makeTween(from: Vector3, latDeg: number, lonDeg: number, distance: number): Tween {
  const lat = Math.max(-89.5, Math.min(89.5, latDeg)); // avoid the orbit singularity
  return {
    fromDir: from.clone().normalize(),
    toDir: new Vector3(...selenographicToScene(lat, lonDeg, 1)),
    fromDistance: from.length(),
    toDistance: distance,
    start: performance.now(),
    duration: 1100,
  };
}

export function CameraRig() {
  // `get` reads the live R3F store; scene objects are mutated only inside callbacks
  // (frame loop / effects), never during render.
  const get = useThree((s) => s.get);
  const view = useMissionStore((s) => s.view);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const sites = useSitesQuery().data?.sites;
  const setTelemetry = useViewTelemetry((s) => s.set);
  const tween = useRef<Tween | null>(null);
  const lastTelemetry = useRef({ lat: Number.NaN, lon: Number.NaN, alt: Number.NaN });

  useEffect(() => {
    if (view.requestId === 0) return;
    const preset = VIEW_PRESETS[view.preset];
    tween.current = makeTween(
      get().camera.position,
      preset.lat,
      preset.lon,
      view.distance ?? preset.distance,
    );
    get().invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- respond to explicit requests only
  }, [view.requestId]);

  const site = sites?.find((s) => s.id === selectedSiteId);
  const siteLat = site?.coordinate.latitude_deg;
  const siteLon = site?.coordinate.longitude_deg;
  useEffect(() => {
    if (siteLat === undefined || siteLon === undefined) return;
    tween.current = makeTween(get().camera.position, siteLat, siteLon, 2.1);
    get().invalidate();
  }, [get, selectedSiteId, siteLat, siteLon]);

  useFrame((state) => {
    const { camera, invalidate } = state;
    const controls = state.controls as unknown as OrbitControlsLike | null;
    const active = tween.current;
    if (active) {
      const t = Math.min(1, (performance.now() - active.start) / active.duration);
      const k = ease(t);
      const angle = active.fromDir.angleTo(active.toDir);
      if (angle > 1e-6) {
        // Spherical interpolation of the view direction.
        const axis = scratch.crossVectors(active.fromDir, active.toDir);
        if (axis.lengthSq() < 1e-12) axis.set(0, 1, 0);
        axis.normalize();
        camera.position.copy(active.fromDir).applyAxisAngle(axis, angle * k);
      } else {
        camera.position.copy(active.toDir);
      }
      camera.position.multiplyScalar(active.fromDistance + (active.toDistance - active.fromDistance) * k);
      camera.lookAt(0, 0, 0);
      if (controls) {
        controls.enabled = t >= 1;
        controls.update();
      }
      if (t < 1) invalidate();
      else tween.current = null;
    }

    if (controls) {
      // Slow rotation near the surface so drag speed feels constant over the terrain.
      const altitude = camera.position.length() - 1;
      controls.rotateSpeed = Math.min(0.55, Math.max(0.04, altitude * 0.22));
    }

    const { latitudeDeg, longitudeDeg } = sceneToSelenographic([
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ]);
    const altitudeKm = (camera.position.length() - 1) * REFERENCE_RADIUS_KM;
    const last = lastTelemetry.current;
    if (
      !(Math.abs(latitudeDeg - last.lat) < 0.01) ||
      !(Math.abs(longitudeDeg - last.lon) < 0.01) ||
      !(Math.abs(altitudeKm - last.alt) < 1)
    ) {
      lastTelemetry.current = { lat: latitudeDeg, lon: longitudeDeg, alt: altitudeKm };
      setTelemetry({ subLatitudeDeg: latitudeDeg, subLongitudeDeg: longitudeDeg, altitudeKm });
    }
  });

  return null;
}
