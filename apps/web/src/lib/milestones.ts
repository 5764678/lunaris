/**
 * Delivery milestones as named in docs/ROADMAP.md. Modules refer to a milestone by its id
 * ("M04"); anything that shows a milestone looks its name up here, so a name cannot be
 * changed in one place and left behind in another.
 *
 * Two modules can share a milestone on purpose: Illumination and Earth visibility are both
 * delivered in M04. The id is the roadmap's number, not a count of modules, so it is not
 * renumbered to make the labels unique.
 */
export const MILESTONES = {
  M01: "Foundation",
  M02: "Terrain intelligence",
  M03: "Celestial geometry",
  M04: "Illumination and Earth visibility",
  M05: "Mission intelligence",
  M06: "Hardening and presentation",
} as const;

export type MilestoneId = keyof typeof MILESTONES;

export function isMilestoneId(id: string): id is MilestoneId {
  return Object.prototype.hasOwnProperty.call(MILESTONES, id);
}

/** "Milestone M04: Illumination and Earth visibility"; just the id for one that is not listed. */
export function milestoneLabel(id: string): string {
  return isMilestoneId(id) ? `Milestone ${id}: ${MILESTONES[id]}` : id;
}
