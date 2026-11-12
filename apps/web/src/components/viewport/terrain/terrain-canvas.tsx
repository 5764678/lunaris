"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  Matrix4,
  Quaternion,
  Vector3,
  type Group,
} from "three";

import type { TerrainScene } from "@/lib/api/queries";
import { heightColors } from "@/lib/terrain/scene-data";
import type { Direction } from "@/lib/terrain/sun";
import { readToken } from "@/lib/theme/tokens";
import { useMissionStore } from "@/store/mission-store";

import { LabelProjector } from "../label-layer";
import type { LabelRegistry } from "../label-registry";
import { TERRAIN_UNIT_M, type TerrainSitePlacement } from "./terrain-placements";

/**
 * South-pole terrain scene (D5) from the C3 export.
 *
 * Frame: MOON_ME axes, origin at `origin_moon_me_m` (the pole on the reference sphere), so
 * float32 vertex positions stay precise. Scene unit: km. Camera "up" is the radial
 * direction at the origin, (0, 0, −1). Lighting is a camera-relative display light, NOT
 * the computed Sun (that is T-33, from C2 `direction_moon_me`).
 */

const UP = new Vector3(0, 0, -1);
/** Start of the descent: straight above the pole. */
const DESCENT_START = new Vector3(0, 0, -650);
/** Hero view: 230 km out, 32° above the horizontal, looking from the 330° E side. */
const HERO = (() => {
  const el = (32 * Math.PI) / 180;
  const lon = (330 * Math.PI) / 180;
  const d = 230;
  return new Vector3(Math.cos(lon), Math.sin(lon), 0)
    .multiplyScalar(d * Math.cos(el))
    .addScaledVector(UP, d * Math.sin(el));
})();
const DESCENT_MS = 1600;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

declare global {
  interface Window {
    /** Frame intervals (ms) of the terrain canvas; read by the e2e frame-time check. */
    __lunarisTerrainFrames?: number[];
    /** When true, the terrain canvas renders continuously and orbits slowly (benchmark). */
    __lunarisTerrainBench?: boolean;
  }
}

function TerrainMesh({ scene }: { scene: TerrainScene }) {
  const geometry = useMemo(() => {
    const { terrain, metadata } = scene;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(terrain.positions, 3));
    g.setAttribute(
      "color",
      new BufferAttribute(heightColors(terrain, metadata.height_min_m, metadata.height_max_m), 3),
    );
    g.setIndex(new BufferAttribute(terrain.indices, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [scene]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} scale={1 / TERRAIN_UNIT_M} name="lunar-terrain" castShadow receiveShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}

const camUp = new Vector3();
const camRight = new Vector3();

/** Display light from the upper-left of the current view. NOT the computed Sun. */
function DisplayLight() {
  const light = useRef<DirectionalLight>(null);
  useFrame(({ camera }) => {
    if (!light.current) return;
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    light.current.position
      .copy(camera.position)
      .normalize()
      .addScaledVector(camUp, 1.1)
      .addScaledVector(camRight, -0.9)
      .normalize()
      .multiplyScalar(1000);
  });
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight ref={light} intensity={2.4} />
    </>
  );
}

/** Terrain bounds in scene units (km), for fitting the shadow camera. */
function terrainCorners(scene: TerrainScene): Vector3[] {
  const p = scene.terrain.positions;
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < scene.terrain.valid.length; i++) {
    if (!scene.terrain.valid[i]) continue;
    min.min(new Vector3(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!));
    max.max(new Vector3(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!));
  }
  min.divideScalar(TERRAIN_UNIT_M);
  max.divideScalar(TERRAIN_UNIT_M);
  const out: Vector3[] = [];
  for (const x of [min.x, max.x])
    for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) out.push(new Vector3(x, y, z));
  return out;
}

const SUN_DISTANCE_KM = 600;
const lightView = new Matrix4();
const corner = new Vector3();

/**
 * Directional light from the SPICE Sun direction (C2 `direction_moon_me`, MOON_ME), so
 * the scene needs no rotation. Shadows come from a shadow map whose orthographic
 * frustum is fitted to the terrain in light space: at Sun elevations of 1–2° the
 * terrain is a thin sliver seen from the Sun, and a fitted frustum keeps the texels
 * small. Rendered shadows are illustrative (point source, no penumbra from the 0.53°
 * disk, 240 m terrain); quantitative illumination comes only from the API.
 */
function SunLight({ direction, corners }: { direction: Direction; corners: Vector3[] }) {
  const light = useRef<DirectionalLight>(null);
  const shadowMapSize = useThree((s) => (s.size.width < 640 ? 2048 : 4096));
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    const eye = new Vector3(...direction).multiplyScalar(SUN_DISTANCE_KM);
    l.position.copy(eye);
    l.target.position.set(0, 0, 0);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.up.copy(UP); // the Sun is near the horizon, never along the radial
    lightView
      .lookAt(eye, new Vector3(0, 0, 0), UP)
      .setPosition(eye)
      .invert();
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const c of corners) {
      corner.copy(c).applyMatrix4(lightView);
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y);
      maxY = Math.max(maxY, corner.y);
      minZ = Math.min(minZ, corner.z);
      maxZ = Math.max(maxZ, corner.z);
    }
    const pad = 2;
    cam.left = minX - pad;
    cam.right = maxX + pad;
    cam.bottom = minY - pad;
    cam.top = maxY + pad;
    cam.near = Math.max(0.1, -maxZ - pad);
    cam.far = -minZ + pad;
    cam.updateProjectionMatrix();
    l.shadow.needsUpdate = true;
    invalidate();
  }, [direction, corners, invalidate]);
  return (
    <>
      {/* Faint fill so shadowed ground is not pure black; not a physical source (no Earthshine model). */}
      <ambientLight intensity={0.06} />
      <directionalLight
        ref={light}
        intensity={3.2}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.35}
      />
    </>
  );
}

interface ControlsLike {
  enabled: boolean;
  update: () => void;
}

/** Descends from above the pole to the hero view once, then hands over to the controls. */
function DescentRig({ onSettled }: { onSettled: () => void }) {
  const start = useRef<number | null>(null);
  const done = useRef(false);
  useFrame((state) => {
    if (done.current) return;
    const controls = state.controls as unknown as ControlsLike | null;
    start.current ??= performance.now();
    const t = Math.min(1, (performance.now() - start.current) / DESCENT_MS);
    state.camera.position.lerpVectors(DESCENT_START, HERO, ease(t));
    state.camera.lookAt(0, 0, 0);
    if (controls) {
      controls.enabled = t >= 1;
      controls.update();
    }
    if (t < 1) state.invalidate();
    else {
      done.current = true;
      onSettled();
    }
  });
  return null;
}

const Z = new Vector3(0, 0, 1);

function SitePin({ placement, selected }: { placement: TerrainSitePlacement; selected: boolean }) {
  const group = useRef<Group>(null);
  const selectSite = useMissionStore((s) => s.selectSite);
  const quaternion = useMemo(
    () => new Quaternion().setFromUnitVectors(Z, new Vector3(...placement.normal)),
    [placement.normal],
  );
  useFrame(({ camera }) => {
    if (!group.current) return;
    const d = camera.position.distanceTo(group.current.position);
    group.current.scale.setScalar(Math.max(0.05, d * 0.012));
  });
  const color = selected ? readToken("primary") : readToken("chart-marker-idle");
  return (
    <group ref={group} position={placement.position} quaternion={quaternion}>
      <mesh
        position={[0, 0, 1.5]}
        onClick={(event) => {
          event.stopPropagation();
          selectSite(selected ? null : placement.siteId);
        }}
      >
        <sphereGeometry args={[0.45, 16, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 0, 0.75]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 1.5, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

/** Records frame intervals; in benchmark mode renders continuously while orbiting. */
function FrameProbe() {
  const last = useRef<number | null>(null);
  const axis = useMemo(() => UP.clone(), []);
  const invalidate = useThree((s) => s.invalidate);
  // Demand rendering draws nothing until something invalidates: kick the bench loop.
  useEffect(() => {
    const timer = setInterval(() => {
      if (window.__lunarisTerrainBench === true) invalidate();
    }, 250);
    return () => clearInterval(timer);
  }, [invalidate]);
  useFrame((state) => {
    const now = performance.now();
    const bench = window.__lunarisTerrainBench === true;
    if (bench) {
      const frames = (window.__lunarisTerrainFrames ??= []);
      if (last.current !== null) frames.push(now - last.current);
      if (frames.length > 2000) frames.splice(0, frames.length - 2000);
      state.camera.position.applyAxisAngle(axis, 0.004);
      state.camera.lookAt(0, 0, 0);
      state.invalidate();
    }
    last.current = bench ? now : null;
  });
  return null;
}

function CameraUp() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.up.copy(UP);
  }, [camera]);
  return null;
}

export default function TerrainCanvas({
  scene,
  placements,
  labelRegistry,
  onSettled,
  sunDirection,
}: {
  scene: TerrainScene;
  placements: TerrainSitePlacement[];
  labelRegistry: LabelRegistry;
  onSettled: () => void;
  /** SPICE Sun direction at the epoch (MOON_ME unit vector), or null → display light. */
  sunDirection: Direction | null;
}) {
  const corners = useMemo(() => terrainCorners(scene), [scene]);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const showSites = useMissionStore((s) => s.layers.sites);
  return (
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 1.75]}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 40, near: 0.05, far: 5000, up: [0, 0, -1], position: DESCENT_START.toArray() }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      aria-label="Interactive 3D south-pole terrain"
      data-testid="terrain-canvas"
    >
      <CameraUp />
      <TerrainMesh scene={scene} />
      {sunDirection ? <SunLight direction={sunDirection} corners={corners} /> : <DisplayLight />}
      {showSites &&
        placements.map((p) => (
          <SitePin key={p.siteId} placement={p} selected={p.siteId === selectedSiteId} />
        ))}
      <LabelProjector registry={labelRegistry} />
      <DescentRig onSettled={onSettled} />
      <FrameProbe />
      <OrbitControls
        makeDefault
        enablePan
        enableDamping
        dampingFactor={0.09}
        zoomSpeed={0.6}
        minDistance={4}
        maxDistance={900}
        maxPolarAngle={Math.PI * 0.47}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
