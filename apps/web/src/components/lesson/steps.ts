/** The six periods of the unit (docs/classroom/PLAN.md). Text comes from the catalogue. */
export const PERIODS = [1, 2, 3, 4, 5, 6] as const;
export type Period = (typeof PERIODS)[number];
export type StepKey = `p${Period}`;

export const stepKey = (period: Period): StepKey => `p${period}`;
export const stepHref = (period: Period) => `/learn/${period}`;
