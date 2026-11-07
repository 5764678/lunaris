"use client";

import { useMemo } from "react";

import { useSurfaceSource } from "@/components/viewport/surface-source";

const NO_TEXTURES: ReadonlySet<string> = new Set();

export interface ShippedTextures {
  /** False until the texture manifest has been looked up (whether or not it exists). */
  settled: boolean;
  /** Ids of the datasets the web app ships a texture for. */
  ids: ReadonlySet<string>;
}

/**
 * Which datasets the web app itself ships a picture of. The globe reads
 * `/textures/moon/manifest.json`, written by `build-web-texture` when the web image is built;
 * the same file shows the data views that the NASA SVS Moon Kit is available to visitors even
 * though the API server never downloaded the original file. A manifest that is missing or
 * invalid means nothing is shipped (the globe then shows its labelled placeholder).
 */
export function useShippedTextures(): ShippedTextures {
  const surface = useSurfaceSource();
  return useMemo(() => {
    if (surface.kind === "texture") {
      return { settled: true, ids: new Set([surface.manifest.source.dataset_id]) };
    }
    return { settled: surface.kind !== "resolving", ids: NO_TEXTURES };
  }, [surface]);
}
