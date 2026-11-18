import { bodyFixedToScene, type Vec3 } from "@/lib/geo/selenographic";

/**
 * The Earth-view camera (decision D12): it looks at the Moon from the direction of the
 * Earth's centre, with lunar north up. It is geocentric: it does not show the tilt, or the
 * rising and setting, seen from a place in Thailand.
 */
export interface EarthViewPose {
  /** Unit vector from the Moon's centre toward the camera, in scene axes (Y-up). */
  direction: Vec3;
  /** Camera up vector: scene +Y (lunar north), made perpendicular to the view direction. */
  up: Vec3;
}

export function earthViewPose(earthDirectionMoonMe: readonly number[]): EarthViewPose {
  const [x, y, z] = earthDirectionMoonMe;
  if (x === undefined || y === undefined || z === undefined)
    throw new RangeError("direction needs 3 components");
  const len = Math.hypot(x, y, z);
  if (!(len > 0)) throw new RangeError("direction must be non-zero");
  const d = bodyFixedToScene([x / len, y / len, z / len]);
  // Lunar north in the scene is +Y. Remove its component along the view direction.
  const dot = d[1];
  const ux = -dot * d[0];
  const uy = 1 - dot * d[1];
  const uz = -dot * d[2];
  const ul = Math.hypot(ux, uy, uz);
  // The Earth is within about 7° of the Moon's equator, so ul is near 1; guard the pole anyway.
  const up: Vec3 = ul > 1e-6 ? [ux / ul, uy / ul, uz / ul] : [0, 0, -1];
  return { direction: d, up };
}
