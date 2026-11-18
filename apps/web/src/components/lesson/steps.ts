/** The six periods of the unit (docs/classroom/PLAN.md). Text comes from the catalogue. */
export const PERIODS = [1, 2, 3, 4, 5, 6] as const;
export type Period = (typeof PERIODS)[number];
export type StepKey = `p${Period}`;

export const stepKey = (period: Period): StepKey => `p${period}`;
export const stepHref = (period: Period) => `/learn/${period}`;

/** The site period 4 stands at: Peak near Shackleton (a demo site in the pack manifest). */
export const STAND_SITE_ID = "pgda78-site07";

/** English names of catalogue sites the pack mentions by id only (the manifest's shadowed scan). */
export const CATALOG_SITE_NAMES: Record<string, string> = { "pgda78-npb": "Amundsen 1" };
