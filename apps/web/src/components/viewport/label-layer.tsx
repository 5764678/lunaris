"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import type { Vec3 } from "@/lib/geo/selenographic";
import { cn } from "@/lib/utils";

import type { LabelAnchorOffset, LabelRegistry } from "./label-registry";

export interface LabelSpec {
  id: string;
  text: string;
  position: Vec3;
  offset: LabelAnchorOffset;
  className: string;
}

function Label({ registry, spec }: { registry: LabelRegistry; spec: LabelSpec }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [x, y, z] = spec.position;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    registry.register(spec.id, [x, y, z], element, spec.offset);
    return () => registry.unregister(spec.id, element);
  }, [registry, spec.id, spec.offset, x, y, z]);

  return (
    <span
      ref={ref}
      className={cn(
        "absolute top-0 left-0 whitespace-nowrap opacity-0 transition-opacity duration-100 will-change-transform",
        spec.className,
      )}
    >
      {spec.text}
    </span>
  );
}

/** DOM overlay holding all surface labels; positioned by `LabelProjector`. */
export function LabelLayer({ registry, labels }: { registry: LabelRegistry; labels: LabelSpec[] }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {labels.map((spec) => (
        <Label key={spec.id} registry={registry} spec={spec} />
      ))}
    </div>
  );
}

/** Inside the canvas: projects registered labels with the current camera every frame. */
export function LabelProjector({ registry }: { registry: LabelRegistry }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    registry.connect(invalidate);
    return () => registry.connect(null);
  }, [registry, invalidate]);
  useFrame(({ camera, size }) => registry.project(camera, size.width, size.height));
  return null;
}
