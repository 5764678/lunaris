#!/usr/bin/env node
// Make sure the globe texture exists before the dev server starts (T-30).
//
// If apps/web/public/textures/moon/manifest.json is missing or invalid, this runs, from
// the repository root:
//
//   uv run lunaris-data acquire nasa-svs-cgi-moon-kit   (no-op when already acquired)
//   uv run lunaris-data build-web-texture
//
// Acquisition is checksum-pinned by the dataset manifest (13 MB from svs.gsfc.nasa.gov).
// Failure never blocks development: the globe then shows the labelled procedural
// placeholder, and this script says why and how to retry.
//
// Runs automatically as `predev` of @lunaris/web. Skipped when CI is set or when
// LUNARIS_SKIP_TEXTURE_SETUP=1. Run by hand with `npm run setup:texture -w @lunaris/web`
// (add `-- --force` to rebuild).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webDir, "../..");
const textureDir = join(webDir, "public/textures/moon");
const manifestPath = join(textureDir, "manifest.json");
const DATASET_ID = "nasa-svs-cgi-moon-kit";
const force = process.argv.includes("--force");

function log(message) {
  process.stdout.write(`[setup-texture] ${message}\n`);
}

/** Returns a reason string when the built texture is unusable, or null when it is fine. */
function textureProblem() {
  if (!existsSync(manifestPath)) return "manifest.json not found";
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    if (manifest.schema_version !== 1 || typeof manifest.file !== "string") return "manifest.json is invalid";
    if (!/^[A-Za-z0-9._-]+$/.test(manifest.file)) return "manifest.json names an unsafe file";
    if (!existsSync(join(textureDir, manifest.file))) return `${manifest.file} not found`;
    if (manifest.source?.dataset_id !== DATASET_ID) return "manifest.json names another dataset";
  } catch (error) {
    return `manifest.json unreadable (${error instanceof Error ? error.message : error})`;
  }
  return null;
}

function run(args) {
  log(`$ uv ${args.join(" ")}`);
  const result = spawnSync("uv", args, { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) return `could not run uv (${result.error.message})`;
  if (result.status !== 0) return `uv ${args.slice(1, 3).join(" ")} exited with code ${result.status}`;
  return null;
}

function main() {
  if (process.env.LUNARIS_SKIP_TEXTURE_SETUP === "1" || (process.env.CI && !force)) {
    log("skipped (CI or LUNARIS_SKIP_TEXTURE_SETUP=1).");
    return;
  }
  const problem = textureProblem();
  if (problem === null && !force) {
    log("globe texture present (apps/web/public/textures/moon/manifest.json).");
    return;
  }
  log(force ? "rebuilding the globe texture (--force)." : `globe texture missing: ${problem}.`);
  const failure =
    run(["run", "lunaris-data", "acquire", DATASET_ID]) ??
    run(["run", "lunaris-data", "build-web-texture", "--output-dir", textureDir]);
  if (failure) {
    log(`WARNING: ${failure}.`);
    log("The globe will show the labelled procedural placeholder. Retry with:");
    log("  npm run setup:texture -w @lunaris/web");
    return;
  }
  const after = textureProblem();
  log(after === null ? "globe texture ready." : `WARNING: texture still unusable after build: ${after}.`);
}

main();
