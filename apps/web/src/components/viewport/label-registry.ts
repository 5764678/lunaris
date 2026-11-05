import { Vector3, type Camera } from "three";

import type { Vec3 } from "@/lib/geo/selenographic";

export type LabelAnchorOffset = "center" | "above";

interface Anchor {
  position: Vector3;
  normal: Vector3;
  element: HTMLElement;
  offset: LabelAnchorOffset;
}

const projected = new Vector3();
const toCamera = new Vector3();

/** Minimum cosine between the surface normal and the camera direction for visibility. */
const HORIZON_MARGIN = 0.12;

/**
 * Bridges DOM labels (rendered outside the WebGL canvas) and the 3D camera.
 *
 * DOM elements register their surface anchor; the canvas projects every anchor to screen
 * space on each rendered frame and positions the elements imperatively. One plain DOM
 * layer replaces per-label React roots, so labels cost no React work per frame.
 */
export class LabelRegistry {
  private readonly anchors = new Map<string, Anchor>();
  private invalidate: (() => void) | null = null;

  /** `normal` defaults to the radial direction of `position` (globe: scene origin = Moon centre). */
  register(id: string, position: Vec3, element: HTMLElement, offset: LabelAnchorOffset, normal?: Vec3): void {
    const point = new Vector3(...position);
    const up = normal ? new Vector3(...normal).normalize() : point.clone().normalize();
    this.anchors.set(id, { position: point, normal: up, element, offset });
    this.invalidate?.();
  }

  unregister(id: string, element: HTMLElement): void {
    if (this.anchors.get(id)?.element === element) this.anchors.delete(id);
  }

  /** Called by the canvas so newly registered labels trigger a render. */
  connect(invalidate: (() => void) | null): void {
    this.invalidate = invalidate;
    invalidate?.();
  }

  project(camera: Camera, width: number, height: number): void {
    for (const anchor of this.anchors.values()) {
      projected.copy(anchor.position).project(camera);
      toCamera.copy(camera.position).sub(anchor.position).normalize();
      const visible = projected.z < 1 && toCamera.dot(anchor.normal) > HORIZON_MARGIN;
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const shift =
        anchor.offset === "above" ? "translate(-50%, calc(-100% - 9px))" : "translate(-50%, -50%)";
      anchor.element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${shift}`;
      anchor.element.style.opacity = visible ? "1" : "0";
    }
  }

  get size(): number {
    return this.anchors.size;
  }
}
