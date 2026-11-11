/**
 * Client configuration. `NEXT_PUBLIC_*` variables are inlined at build time: changing
 * them requires a rebuild. They must never contain secrets.
 */

const DEFAULT_API_URL = "http://localhost:8000";
/** Public address of the hosted demo; used for absolute link-preview (Open Graph) URLs. */
const DEFAULT_SITE_URL = "https://lunaris-demo.onrender.com";

function normalizeBaseUrl(raw: string | undefined, fallback: string = DEFAULT_API_URL): string {
  const value = (raw ?? "").trim() || fallback;
  return value.replace(/\/+$/, "");
}

export const config = {
  /** Base URL of the LUNARIS API, without trailing slash. */
  apiBaseUrl: normalizeBaseUrl(process.env.NEXT_PUBLIC_LUNARIS_API_URL),
  /** Public address of this web app (no trailing slash), used for link-preview image URLs. */
  siteUrl: normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL, DEFAULT_SITE_URL),
  /** Team name shown on the About page; left out when not set. */
  teamName: (process.env.NEXT_PUBLIC_TEAM_NAME ?? "").trim() || null,
  /** Expected major version of the HTTP contract. */
  expectedApiVersion: "v1",
  /** Health polling interval. */
  healthPollMs: 10_000,
  /** Per-request timeout. */
  requestTimeoutMs: 8_000,
} as const;

export { normalizeBaseUrl };
