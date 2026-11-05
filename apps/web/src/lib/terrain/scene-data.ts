/**
 * Decoding of the C3 terrain scene binary (docs/TASKS.md §2, C3) for display.
 *
 * Layout: little-endian float32, row-major, 4 values per vertex: x, y, z (MOON_ME, m,
 * relative to `origin_moon_me_m`) then height_m. Row 0 is the map's top edge (toward
 * 0° E); rows advance toward 180° E; columns advance toward 90° E.
 *
 * Nodata: a vertex with any non-finite component is invalid. It is never drawn and never
 * replaced by a height: no triangle references it. (Its slot in the position buffer is
 * set to the origin only so GPU buffers stay finite; nothing indexes it.)
 *
 * The web never re-implements the projection: positions come from the API already in
 * MOON_ME. The only geometry here is display geometry (triangulation, marker placement).
 */

export interface TerrainGrid {
  width: number;
  height: number;
}

export interface DecodedTerrain {
  width: number;
  height: number;
  /** x, y, z per vertex, m, relative to the scene origin (MOON_ME axes). */
  positions: Float32Array;
  /** Height above the reference sphere per vertex, m (NaN where invalid). */
  heights: Float32Array;
  /** 1 where the vertex has finite data. */
  valid: Uint8Array;
  /** Triangle list over valid vertices only. Winding gives outward (−Z at the pole) normals. */
  indices: Uint32Array;
  validVertexCount: number;
  invalidVertexCount: number;
  triangleCount: number;
  heightMinM: number;
  heightMaxM: number;
}

export class TerrainDecodeError extends Error {
  override name = "TerrainDecodeError";
}

export const BYTES_PER_VERTEX = 16;
export const MAX_GRID = 1024;

const HOST_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

function readFloats(buffer: ArrayBuffer, count: number): Float32Array {
  if (HOST_LITTLE_ENDIAN) return new Float32Array(buffer, 0, count);
  const view = new DataView(buffer);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

export function expectedByteLength({ width, height }: TerrainGrid): number {
  return width * height * BYTES_PER_VERTEX;
}

export function decodeTerrainScene(buffer: ArrayBuffer, grid: TerrainGrid): DecodedTerrain {
  const { width, height } = grid;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new TerrainDecodeError(`invalid grid ${width}×${height}`);
  }
  if (width > MAX_GRID || height > MAX_GRID) {
    throw new TerrainDecodeError(`grid ${width}×${height} exceeds the ${MAX_GRID}² cap`);
  }
  const expected = expectedByteLength(grid);
  if (buffer.byteLength !== expected) {
    throw new TerrainDecodeError(
      `expected ${expected} bytes for ${width}×${height}, got ${buffer.byteLength}`,
    );
  }

  const n = width * height;
  const raw = readFloats(buffer, n * 4);
  const positions = new Float32Array(n * 3);
  const heights = new Float32Array(n);
  const valid = new Uint8Array(n);
  let validCount = 0;
  let hMin = Infinity;
  let hMax = -Infinity;

  for (let i = 0; i < n; i++) {
    const x = raw[i * 4]!;
    const y = raw[i * 4 + 1]!;
    const z = raw[i * 4 + 2]!;
    const h = raw[i * 4 + 3]!;
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && Number.isFinite(h)) {
      valid[i] = 1;
      validCount++;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      heights[i] = h;
      if (h < hMin) hMin = h;
      if (h > hMax) hMax = h;
    } else {
      heights[i] = Number.NaN;
    }
  }

  // Two triangles per quad, each kept only if all three corners are valid, so coverage
  // edges keep their half-quads. With rows → −X and columns → +Y at the pole, the order
  // (a, d, b) / (b, d, e) has normal (d−a)×(b−a) ∝ −X × +Y = −Z: outward.
  const tris = new Uint32Array((width - 1) * (height - 1) * 6);
  let t = 0;
  for (let r = 0; r < height - 1; r++) {
    for (let c = 0; c < width - 1; c++) {
      const a = r * width + c;
      const b = a + 1;
      const d = a + width;
      const e = d + 1;
      if (valid[a] && valid[d] && valid[b]) {
        tris[t++] = a;
        tris[t++] = d;
        tris[t++] = b;
      }
      if (valid[b] && valid[d] && valid[e]) {
        tris[t++] = b;
        tris[t++] = d;
        tris[t++] = e;
      }
    }
  }

  return {
    width,
    height,
    positions,
    heights,
    valid,
    indices: tris.slice(0, t),
    validVertexCount: validCount,
    invalidVertexCount: n - validCount,
    triangleCount: t / 3,
    heightMinM: validCount ? hMin : Number.NaN,
    heightMaxM: validCount ? hMax : Number.NaN,
  };
}

export type Vec3 = readonly [number, number, number];

/**
 * Display placement of a site marker on the terrain mesh. Finds the valid vertex whose
 * radial direction is closest to the site's, and places the marker on the site's radial
 * line at that vertex's radius. Returns null when the site is off the scene (nearest
 * valid vertex farther than `maxAngleRad`). Display-only: no height is reported from it.
 */
export function placeOnTerrain(
  terrain: DecodedTerrain,
  originMoonMeM: Vec3,
  siteBodyFixedM: Vec3,
  maxAngleRad: number,
): { position: Vec3; vertexIndex: number } | null {
  const [ox, oy, oz] = originMoonMeM;
  const sl = Math.hypot(...siteBodyFixedM);
  if (!(sl > 0)) return null;
  const ux = siteBodyFixedM[0] / sl;
  const uy = siteBodyFixedM[1] / sl;
  const uz = siteBodyFixedM[2] / sl;
  const p = terrain.positions;
  let best = -1;
  let bestDot = -Infinity;
  let bestRadius = 0;
  for (let i = 0; i < terrain.valid.length; i++) {
    if (!terrain.valid[i]) continue;
    const x = ox + p[i * 3]!;
    const y = oy + p[i * 3 + 1]!;
    const z = oz + p[i * 3 + 2]!;
    const r = Math.hypot(x, y, z);
    const dot = (x * ux + y * uy + z * uz) / r;
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
      bestRadius = r;
    }
  }
  if (best < 0 || Math.acos(Math.min(1, bestDot)) > maxAngleRad) return null;
  return {
    vertexIndex: best,
    position: [ux * bestRadius - ox, uy * bestRadius - oy, uz * bestRadius - oz],
  };
}

/** Colour ramp for heights (display only): deep blue-grey lows → pale highs. */
const RAMP: readonly (readonly [number, number, number, number])[] = [
  [0.0, 0.11, 0.13, 0.19],
  [0.35, 0.3, 0.32, 0.37],
  [0.65, 0.55, 0.55, 0.56],
  [1.0, 0.88, 0.86, 0.82],
];

export function heightColor(fraction: number): [number, number, number] {
  const f = Math.min(1, Math.max(0, fraction));
  for (let i = 1; i < RAMP.length; i++) {
    const [f1, r1, g1, b1] = RAMP[i]!;
    if (f <= f1) {
      const [f0, r0, g0, b0] = RAMP[i - 1]!;
      const k = (f - f0) / (f1 - f0);
      return [r0 + k * (r1 - r0), g0 + k * (g1 - g0), b0 + k * (b1 - b0)];
    }
  }
  const last = RAMP[RAMP.length - 1]!;
  return [last[1], last[2], last[3]];
}

/** Per-vertex colours from heights over [minM, maxM]; invalid vertices get black. */
export function heightColors(terrain: DecodedTerrain, minM: number, maxM: number): Float32Array {
  const out = new Float32Array(terrain.heights.length * 3);
  const span = maxM - minM || 1;
  for (let i = 0; i < terrain.heights.length; i++) {
    if (!terrain.valid[i]) continue;
    const [r, g, b] = heightColor((terrain.heights[i]! - minM) / span);
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  return out;
}
