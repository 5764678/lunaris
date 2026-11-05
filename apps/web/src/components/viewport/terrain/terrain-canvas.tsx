"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, DirectionalLight, Quaternion, Vector3, type Group } from "three";

import type { TerrainScene } from "@/lib/api/queries";
import { heightColors } from "@/lib/terrain/scene-data";
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
    <mesh geometry={geometry} scale={1 / TERRAIN_UNIT_M} name="lunar-terrain">
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
  const color = selected ? "#7cb5ff" : "#e6eaef";
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
}: {
  scene: TerrainScene;
  placements: TerrainSitePlacement[];
  labelRegistry: LabelRegistry;
  onSettled: () => void;
}) {
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const showSites = useMissionStore((s) => s.layers.sites);
  return (
    <Canvas
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
      <DisplayLight />
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
