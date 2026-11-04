export type { CandidateSite, CandidateSiteCreate, CandidateSiteList } from "./api";

/**
 * Where a site's coordinates come from.
 *
 * - `user_defined` — entered by a user (implemented, Milestone 01).
 * - `published` — curated from a cited publication or agency release
 *   (@status draft — no curated sites ship until each can be cited).
 */
export type SiteOrigin = "user_defined" | "published";
