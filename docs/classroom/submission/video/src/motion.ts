// Small helpers. seg/E/lerp follow the skill's demos/_fixtures/Motion.tsx semantics.
import { Easing, interpolate } from 'remotion';
export const E = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const seg = (t: number, t0: number, t1: number, ease: (x: number) => number = E.linear) => ease(clamp01((t - t0) / (t1 - t0)));
export const lerp = (t: number, a: number, b: number) => a + (b - a) * t;
export const ramp = (f: number, f0: number, f1: number, a = 0, b = 1, ease: (x: number) => number = Easing.bezier(0.33, 0, 0.15, 1)) =>
  interpolate(f, [f0, f1], [a, b], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
// deterministic PRNG (skill core rule 9)
export const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
