"use client";

import { useEffect, useState } from "react";

/**
 * Which surface the globe shows. The texture manifest is produced by
 * `uv run lunaris-data build-web-texture` and carries the provenance of the image.
 */
export interface TextureManifest {
  schema_version: 1;
  kind: "lunar-color-equirectangular";
  file: string;
  width: number;
  height: number;
  projection: "equirectangular";
  source: {
    dataset_id: string;
    dataset_title: string;
    file: string;
    source_url: string;
    sha256: string;
    retrieved_at_utc: string;
  };
  credit: string;
  usage: string;
  assumptions: string[];
  generated_at_utc: string;
  generator: string;
}

export type SurfaceSource =
  | { kind: "resolving" }
  | { kind: "procedural"; reason: string }
  | { kind: "texture"; url: string; manifest: TextureManifest };

export const TEXTURE_BASE = "/textures/moon";

export function isTextureManifest(value: unknown): value is TextureManifest {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  const source = m.source as Record<string, unknown> | undefined;
  return (
    m.schema_version === 1 &&
    m.kind === "lunar-color-equirectangular" &&
    typeof m.file === "string" &&
    /^[A-Za-z0-9._-]+$/.test(m.file) &&
    typeof m.width === "number" &&
    typeof m.height === "number" &&
    typeof source === "object" &&
    source !== null &&
    typeof source.dataset_id === "string" &&
    typeof source.sha256 === "string"
  );
}

/** Resolve the globe surface: the acquired NASA texture if built, else the placeholder. */
export function useSurfaceSource(): SurfaceSource {
  const [source, setSource] = useState<SurfaceSource>({ kind: "resolving" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${TEXTURE_BASE}/manifest.json`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          setSource({ kind: "procedural", reason: "No acquired texture (manifest.json not found)." });
          return;
        }
        const manifest: unknown = await response.json();
        if (!isTextureManifest(manifest)) {
          setSource({ kind: "procedural", reason: "Texture manifest is invalid." });
          return;
        }
        setSource({ kind: "texture", url: `${TEXTURE_BASE}/${manifest.file}`, manifest });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSource({
          kind: "procedural",
          reason: error instanceof Error ? error.message : "Texture manifest unavailable.",
        });
      });
    return () => controller.abort();
  }, []);

  return source;
}
