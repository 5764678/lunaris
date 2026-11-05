"use client";

import { Globe2, Mountain } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMissionStore } from "@/store/mission-store";

/** Globe ↔ south-pole terrain (D5). Entering the terrain flies the globe down to the pole first. */
export function SceneSwitch() {
  const scene = useMissionStore((s) => s.scene);
  const descending = useMissionStore((s) => s.sceneTransition === "descending");
  const enterTerrain = useMissionStore((s) => s.enterTerrain);
  const exitTerrain = useMissionStore((s) => s.exitTerrain);
  const value = descending ? "terrain" : scene;
  return (
    <ToggleGroup type="single" value={value} aria-label="3D scene" data-testid="scene-switch">
      <ToggleGroupItem value="globe" onClick={exitTerrain} aria-label="Globe">
        <Globe2 /> Globe
      </ToggleGroupItem>
      <ToggleGroupItem value="terrain" onClick={enterTerrain} aria-label="South-pole terrain">
        <Mountain /> Pole terrain
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
