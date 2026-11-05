import { describe, expect, it } from "vitest";

import {
  TerrainDecodeError,
  decodeTerrainScene,
  heightColor,
  heightColors,
  placeOnTerrain,
  type Vec3,
} from "./scene-data";

/**
 * SYNTHETIC test grids — not lunar data. A small flat patch at the south pole of a
 * 1 737 400 m sphere, laid out like C3: rows advance toward −X (180° E), columns toward
 * +Y (90° E), positions relative to the origin (0, 0, −R).
 */
const R = 1_737_400;
const ORIGIN: Vec3 = [0, 0, -R];

function grid(width: number, height: number, spacing = 100, nan: number[] = []): ArrayBuffer {
  const out = new Float32Array(width * height * 4);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const i = r * width + c;
      const x = -(r - (height - 1) / 2) * spacing;
      const y = (c - (width - 1) / 2) * spacing;
      const h = r * 10 + c; // distinct heights
      // Point on the sphere of radius R + h along the direction of (x, y, −R).
      const len = Math.hypot(x, y, R);
      const k = (R + h) / len;
      const v = nan.includes(i) ? [NaN, NaN, NaN, NaN] : [x * k, y * k, -R * k + R, h];
      out.set(v, i * 4);
    }
  }
  return out.buffer;
}

describe("decodeTerrainScene", () => {
  it("decodes a full grid into two triangles per quad", () => {
    const t = decodeTerrainScene(grid(4, 3), { width: 4, height: 3 });
    expect(t.validVertexCount).toBe(12);
    expect(t.invalidVertexCount).toBe(0);
    expect(t.triangleCount).toBe(3 * 2 * 2);
    expect(t.heightMinM).toBe(0);
    expect(t.heightMaxM).toBe(23);
    expect(t.heights[5]).toBe(11);
  });

  it("winds triangles with outward (−Z) normals at the pole", () => {
    const t = decodeTerrainScene(grid(3, 3), { width: 3, height: 3 });
    const p = t.positions;
    for (let k = 0; k < t.indices.length; k += 3) {
      const [a, b, c] = [t.indices[k]!, t.indices[k + 1]!, t.indices[k + 2]!];
      const ab = [0, 1, 2].map((j) => p[b * 3 + j]! - p[a * 3 + j]!);
      const ac = [0, 1, 2].map((j) => p[c * 3 + j]! - p[a * 3 + j]!);
      const nz = ab[0]! * ac[1]! - ab[1]! * ac[0]!;
      expect(nz).toBeLessThan(0);
    }
  });

  it("never references a NaN vertex and never turns it into a height", () => {
    // 3×3 grid, centre vertex (index 4) missing: every quad touches it.
    const t = decodeTerrainScene(grid(3, 3, 100, [4]), { width: 3, height: 3 });
    expect(t.valid[4]).toBe(0);
    expect(Number.isNaN(t.heights[4])).toBe(true);
    expect(t.invalidVertexCount).toBe(1);
    expect([...t.indices]).not.toContain(4);
    // Of 8 triangles, only (0,3,1) in the top-left quad and (5,7,8) in the bottom-right
    // quad avoid the centre vertex.
    expect(t.triangleCount).toBe(2);
    expect([...t.indices]).toEqual([0, 3, 1, 5, 7, 8]);
    for (const v of t.positions) expect(Number.isFinite(v)).toBe(true);
    expect(t.heightMinM).toBe(0);
  });

  it("treats a vertex with any non-finite component as missing", () => {
    const buffer = grid(2, 2);
    new Float32Array(buffer)[3] = Number.NaN; // height of vertex 0 only
    const t = decodeTerrainScene(buffer, { width: 2, height: 2 });
    expect(t.valid[0]).toBe(0);
    expect(t.triangleCount).toBe(1);
  });

  it("reports NaN extremes when nothing is valid", () => {
    const t = decodeTerrainScene(grid(2, 2, 100, [0, 1, 2, 3]), { width: 2, height: 2 });
    expect(t.triangleCount).toBe(0);
    expect(Number.isNaN(t.heightMinM)).toBe(true);
  });

  it.each([
    ["short body", grid(3, 3).slice(16), { width: 3, height: 3 }],
    ["grid too small", grid(2, 2), { width: 1, height: 4 }],
    ["grid over cap", new ArrayBuffer(0), { width: 2048, height: 2 }],
  ])("rejects %s", (_name, buffer, size) => {
    expect(() => decodeTerrainScene(buffer, size)).toThrow(TerrainDecodeError);
  });
});

describe("placeOnTerrain", () => {
  const t = decodeTerrainScene(grid(5, 5, 1000), { width: 5, height: 5 });

  it("puts a site on the radial line through it at the nearest vertex's radius", () => {
    // Site exactly over vertex (r=1, c=3): x = +1000, y = +1000 on the 1000 m grid.
    const dir = [1000, 1000, -R];
    const len = Math.hypot(...dir);
    const site: Vec3 = [(dir[0]! / len) * R, (dir[1]! / len) * R, (dir[2]! / len) * R];
    const placed = placeOnTerrain(t, ORIGIN, site, 0.01)!;
    expect(placed.vertexIndex).toBe(1 * 5 + 3);
    const r = Math.hypot(placed.position[0], placed.position[1], placed.position[2] + ORIGIN[2]);
    expect(r).toBeCloseTo(R + t.heights[8]!, 0);
  });

  it("returns null for a site off the scene", () => {
    const far: Vec3 = [R * Math.sin(0.1), 0, -R * Math.cos(0.1)];
    expect(placeOnTerrain(t, ORIGIN, far, 0.002)).toBeNull();
  });
});

describe("height colours", () => {
  it("ramps from dark to light and clamps", () => {
    const lo = heightColor(0);
    const hi = heightColor(1);
    expect(hi[0]).toBeGreaterThan(lo[0]);
    expect(heightColor(-5)).toEqual(lo);
    expect(heightColor(7)).toEqual(hi);
  });

  it("leaves invalid vertices black", () => {
    const t = decodeTerrainScene(grid(2, 2, 100, [0]), { width: 2, height: 2 });
    const c = heightColors(t, 0, 20);
    expect([c[0], c[1], c[2]]).toEqual([0, 0, 0]);
    expect(c[3]).toBeGreaterThan(0);
  });
});
