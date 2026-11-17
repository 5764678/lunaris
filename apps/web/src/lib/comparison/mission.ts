/**
 * The mission questions on the Compare page: what the mission needs (three priorities) and
 * what it cannot accept (four optional limits). The API turns the answers into weights and
 * returns every weight and scale it used.
 */
import type { MissionAnswers, Priority } from "@/lib/api/client";

export const PRIORITY_OPTIONS: ReadonlyArray<{ id: Priority; label: string }> = [
  { id: "none", label: "Not needed" },
  { id: "low", label: "Nice to have" },
  { id: "medium", label: "Important" },
  { id: "high", label: "Critical" },
];

export type NeedId = "power" | "comms" | "landing";

export const NEED_QUESTIONS: ReadonlyArray<{ id: NeedId; question: string; hint: string }> = [
  {
    id: "power",
    question: "How much does the mission depend on sunlight?",
    hint: "Solar only: critical. Solar with storage for the dark: important. Nuclear: not needed.",
  },
  {
    id: "comms",
    question: "How much does it depend on a direct line of sight to Earth?",
    hint: "Direct-to-Earth only: critical. A relay orbiter covers the gaps: not needed.",
  },
  {
    id: "landing",
    question: "How much does it need gentle, smooth ground?",
    hint: "Rover or crew moving around: critical. Lander with hazard avoidance: nice to have.",
  },
];

export type LimitId = "maxSlopeDeg" | "maxDarknessD" | "maxEarthOutageD" | "minSunlitD";

export const LIMIT_QUESTIONS: ReadonlyArray<{
  id: LimitId;
  question: string;
  unit: string;
  placeholder: string;
}> = [
  { id: "maxSlopeDeg", question: "Steepest slope the lander can handle", unit: "°", placeholder: "e.g. 10" },
  { id: "maxDarknessD", question: "Longest darkness it can survive", unit: "days", placeholder: "e.g. 7" },
  {
    id: "maxEarthOutageD",
    question: "Longest gap without Earth in view",
    unit: "days",
    placeholder: "e.g. 14",
  },
  {
    id: "minSunlitD",
    question: "Unbroken sunlight needed for the surface stay",
    unit: "days",
    placeholder: "e.g. 14",
  },
];

export const DEFAULT_MISSION: MissionAnswers = {
  power: "medium",
  comms: "medium",
  landing: "medium",
  maxSlopeDeg: null,
  maxDarknessD: null,
  maxEarthOutageD: null,
  minSunlitD: null,
};

/** A limit typed by a person: a positive finite number, else no limit. */
export function parseLimit(text: string | null): number | null {
  if (text === null || text.trim() === "") return null;
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** The slope limit is an angle, so the API accepts at most 90°. */
export function clampLimit(id: LimitId, value: number | null): number | null {
  return id === "maxSlopeDeg" && value !== null ? Math.min(value, 90) : value;
}

export const isDefaultMission = (mission: MissionAnswers): boolean =>
  (Object.keys(DEFAULT_MISSION) as Array<keyof MissionAnswers>).every(
    (key) => mission[key] === DEFAULT_MISSION[key],
  );

/** 0..1 score as points out of 100, or a dash when there is none. */
export const points = (score: number | null | undefined): string =>
  score === null || score === undefined ? "–" : (score * 100).toFixed(1);
