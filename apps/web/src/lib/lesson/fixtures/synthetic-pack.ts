import type { Evidence, LessonPack, MoonPhaseSample, MoonPhaseSeries, SunDirectionSeries } from "../types";

/**
 * SYNTHETIC FIXTURE. Not computed from ephemerides, not real dates.
 *
 * It stands in for the lesson pack (contract L2) until the real pack is committed, so the
 * route can be built and tested. It models one lunation with a circular orbit: the Earth sits
 * on the Moon's +X axis (no libration) and the Sun goes round the equator once per synodic
 * month. Everything that shows it carries the label from `SYNTHETIC_LABEL`; the loader only
 * returns it when the real pack is absent, and says why.
 */

export const SYNTHETIC_START_UTC = "2000-01-01T00:00:00Z";
export const SYNODIC_DAYS = 29.530588;
const STEP_S = 3600;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const evidence: Evidence = {
  kind: "placeholder",
  statement:
    "SYNTHETIC teaching fixture: a circular-orbit model with made-up dates. It is not an ephemeris result.",
  method: "Circular orbit, Earth fixed on the Moon's +X axis, Sun moving uniformly round the equator.",
  assumptions: ["No libration", "Circular orbits", "Dates are arbitrary and do not match any real lunation"],
  sources: [],
};

const limitations = [
  "SYNTHETIC: placeholder values for building the lesson route; not a calculation of the real Moon.",
];

export function buildSyntheticPack(reason: string): LessonPack {
  const startMs = Date.parse(SYNTHETIC_START_UTC);
  const count = Math.ceil((SYNODIC_DAYS * 24 * 3600) / STEP_S) + 1;
  const sunSamples: SunDirectionSeries["samples"] = [];
  const phaseSamples: MoonPhaseSample[] = [];

  for (let i = 0; i < count; i++) {
    const t = i * STEP_S;
    const epoch = new Date(startMs + t * 1000).toISOString().replace(".000Z", "Z");
    // Elongation lambda: 0 at new Moon, 180 at full. Sun direction angle psi = 180 - lambda,
    // so the lit fraction (1 + cos psi) / 2 is 0 at new Moon. Waxing while lambda < 180.
    const lambda = ((t / (SYNODIC_DAYS * 86400)) * 360) % 360;
    const psi = (180 - lambda) * RAD;
    const sun = [Math.cos(psi), Math.sin(psi), 0];
    const phaseAngle = Math.abs(Math.atan2(Math.sin(psi), Math.cos(psi))) * DEG;
    const subsolarLon = (((Math.atan2(sun[1]!, sun[0]!) * DEG) % 360) + 360) % 360;
    sunSamples.push({
      epoch_utc: epoch,
      direction_moon_me: sun,
      subsolar_latitude_deg: 0,
      subsolar_longitude_deg: subsolarLon,
      angular_radius_deg: 0.27,
      range_m: 1.496e11,
    });
    phaseSamples.push({
      epoch_utc: epoch,
      earth_direction_moon_me: [1, 0, 0],
      subearth_latitude_deg: 0,
      subearth_longitude_deg: 0,
      phase_angle_deg: phaseAngle,
      illuminated_fraction: (1 + Math.cos(psi)) / 2,
      elongation_deg: 180 - phaseAngle,
      waxing: lambda > 0 && lambda < 180,
    });
  }

  const endUtc = sunSamples[sunSamples.length - 1]!.epoch_utc;
  const sun: SunDirectionSeries = {
    start_utc: SYNTHETIC_START_UTC,
    end_utc: endUtc,
    step_s: STEP_S,
    sample_count: sunSamples.length,
    max_samples: sunSamples.length,
    frame: "MOON_ME",
    origin: "MOON",
    aberration_correction: "CN+S",
    sun_radius_m: 6.957e8,
    samples: sunSamples,
    evidence,
    limitations,
  };
  const phase: MoonPhaseSeries = {
    start_utc: SYNTHETIC_START_UTC,
    end_utc: endUtc,
    step_s: STEP_S,
    sample_count: phaseSamples.length,
    max_samples: phaseSamples.length,
    frame: "MOON_ME",
    origin: "MOON",
    viewpoint: "geocentric",
    aberration_correction: "CN+S",
    samples: phaseSamples,
    evidence,
    limitations,
  };
  return { provenance: { kind: "synthetic", reason }, sun, phase };
}
