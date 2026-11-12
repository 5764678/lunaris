import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Regression guard for the review finding F2: text colours must reach the WCAG AA contrast
 * ratio for small text (4.5:1) on every surface they can sit on. The tokens are read from
 * globals.css, so lightening a surface or darkening a text colour fails here.
 */
const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1]!, m[2]!]),
  );
}
/** The light page, and the dark "space" windows (globe, terrain, sky chart), which re-declare the tokens. */
const light = block(":root");
const space = { ...light, ...block(".space") };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const SURFACES = [
  "background",
  "surface",
  "panel",
  "panel-raised",
  "panel-sunken",
  "popover",
  "accent",
  "muted",
  "secondary",
];

const TEXT = [
  "foreground",
  "secondary-foreground",
  "muted-foreground",
  "dim",
  "primary",
  "ok",
  "warn",
  "critical",
  "ev-observation",
  "ev-derived",
  "ev-model",
  "ev-calculation",
  "ev-assumption",
  "ev-placeholder",
  "ev-not-computed",
];

const THEMES = [
  ["light page", light],
  ["space window", space],
] as const;

describe.each(THEMES)("text colour contrast, %s (WCAG AA, 4.5:1)", (_name, tokens) => {
  it("finds the tokens in globals.css", () => {
    for (const name of [...SURFACES, ...TEXT]) expect(tokens[name], name).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(TEXT)("%s is readable on every surface", (name) => {
    for (const surface of SURFACES) {
      const ratio = contrast(tokens[name]!, tokens[surface]!);
      expect(ratio, `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps dim text visibly quieter than muted text", () => {
    expect(contrast(tokens["dim"]!, tokens["panel"]!)).toBeLessThan(
      contrast(tokens["muted-foreground"]!, tokens["panel"]!),
    );
  });

  it("keeps button label text readable on the primary colour", () => {
    expect(contrast(tokens["primary-foreground"]!, tokens["primary"]!)).toBeGreaterThanOrEqual(4.5);
  });
});
