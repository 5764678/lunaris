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
  longitude_min_deg?: number;
  longitude_max_deg?: number;
  latitude_min_deg?: number;
  latitude_max_deg?: number;
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

/** Whether the image behind a `texture` source has reached the GPU yet. */
export type TextureLoadState = "loading" | "loaded";

export const TEXTURE_BASE = "/textures/moon";

const SAFE_FILE = /^[A-Za-z0-9._-]+$/;
const SHA256 = /^[0-9a-f]{64}$/;

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Only absolute https URLs are rendered as links in the provenance panel. */
export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates `manifest.json` from `build-web-texture`. Every field the provenance panel
 * displays is checked, so the HUD never shows a texture whose source it cannot state.
 */
export function isTextureManifest(value: unknown): value is TextureManifest {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  const source = m.source as Record<string, unknown> | undefined;
  return (
    m.schema_version === 1 &&
    m.kind === "lunar-color-equirectangular" &&
    m.projection === "equirectangular" &&
    isString(m.file) &&
    SAFE_FILE.test(m.file) &&
    isPositiveInteger(m.width) &&
    isPositiveInteger(m.height) &&
    isString(m.credit) &&
    isString(m.usage) &&
    Array.isArray(m.assumptions) &&
    m.assumptions.every(isString) &&
    isString(m.generated_at_utc) &&
    isString(m.generator) &&
    typeof source === "object" &&
    source !== null &&
    isString(source.dataset_id) &&
    isString(source.dataset_title) &&
    isString(source.file) &&
    isHttpsUrl(source.source_url) &&
    typeof source.sha256 === "string" &&
    SHA256.test(source.sha256) &&
    isString(source.retrieved_at_utc)
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
