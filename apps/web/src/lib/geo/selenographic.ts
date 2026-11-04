/**
 * Selenographic helpers for display and 3D placement.
 *
 * Conventions match lunaris_science.coordinates: planetocentric latitude, east longitude
 * in [0, 360), body-fixed MOON_ME (+X toward 0°N 0°E, +Y toward 0°N 90°E, +Z north).
 *
 * Scene frame: three.js is Y-up, so the scene is the MOON_ME frame rotated −90° about X:
 *     scene = (x_me, z_me, −y_me)
 * This is a proper rotation (no reflection): viewed from +X (the mean Earth direction)
 * with north up, east longitudes appear on the right, as in IAU convention.
 * Scene unit: 1 = one lunar reference radius (1737.4 km).
 */

export const REFERENCE_RADIUS_KM = 1737.4;

export type Vec3 = readonly [number, number, number];

export function normalizeEastLongitude(longitudeDeg: number): number {
  if (!Number.isFinite(longitudeDeg)) throw new RangeError("longitude must be finite");
  let lon = longitudeDeg % 360;
  if (lon < 0) lon += 360;
  if (lon >= 360 || Object.is(lon, -0) || lon === 0) lon = 0;
  return lon;
}

const RAD = Math.PI / 180;

/** MOON_ME Cartesian (any unit) from planetocentric coordinates. */
export function selenographicToBodyFixed(latDeg: number, lonDeg: number, radius = 1): Vec3 {
  const lat = latDeg * RAD;
  const lon = lonDeg * RAD;
  const c = Math.cos(lat);
  return [radius * c * Math.cos(lon), radius * c * Math.sin(lon), radius * Math.sin(lat)];
}

export function bodyFixedToScene([x, y, z]: Vec3): Vec3 {
  return [x, z, -y];
}

export function sceneToBodyFixed([x, y, z]: Vec3): Vec3 {
  return [x, -z, y];
}

/** Scene position (Y-up) of a surface point; `radius` in lunar radii. */
export function selenographicToScene(latDeg: number, lonDeg: number, radius = 1): Vec3 {
  return bodyFixedToScene(selenographicToBodyFixed(latDeg, lonDeg, radius));
}

/** Planetocentric latitude/east longitude of the direction of a scene-space vector. */
export function sceneToSelenographic(v: Vec3): { latitudeDeg: number; longitudeDeg: number } {
  const [x, y, z] = sceneToBodyFixed(v);
  const horizontal = Math.hypot(x, y);
  if (horizontal === 0 && z === 0) throw new RangeError("direction undefined at the origin");
  return {
    latitudeDeg: Math.atan2(z, horizontal) / RAD,
    longitudeDeg: normalizeEastLongitude(Math.atan2(y, x) / RAD),
  };
}

export function formatLatitude(latDeg: number, digits = 3): string {
  const hemisphere = latDeg < 0 ? "S" : "N";
  return `${Math.abs(latDeg).toFixed(digits)}°${hemisphere}`;
}

export function formatLongitude(lonDeg: number, digits = 3): string {
  // Round before folding so 359.9996° shown at 3 digits reads 0.000°E, not 360.000°E.
  const rounded = Number(normalizeEastLongitude(lonDeg).toFixed(digits));
  return `${normalizeEastLongitude(rounded).toFixed(digits)}°E`;
}

export interface CoordinateInputErrors {
  latitude?: string;
  longitude?: string;
}

/** Client-side mirror of the API's input rules (the API remains authoritative). */
export function validateCoordinateInput(latitude: string, longitude: string): CoordinateInputErrors {
  const errors: CoordinateInputErrors = {};
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (latitude.trim() === "" || !Number.isFinite(lat)) errors.latitude = "Enter a number.";
  else if (lat < -90 || lat > 90) errors.latitude = "Latitude must be within −90…90°.";
  if (longitude.trim() === "" || !Number.isFinite(lon)) errors.longitude = "Enter a number.";
  else if (lon < -180 || lon > 360) errors.longitude = "Longitude must be within −180…360°E.";
  return errors;
}
