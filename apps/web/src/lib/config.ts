/**
 * Client configuration. `NEXT_PUBLIC_*` variables are inlined at build time: changing
 * them requires a rebuild. They must never contain secrets.
 */

const DEFAULT_API_URL = "http://localhost:8000";

function normalizeBaseUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim() || DEFAULT_API_URL;
  return value.replace(/\/+$/, "");
}

export const config = {
  /** Base URL of the LUNARIS API, without trailing slash. */
  apiBaseUrl: normalizeBaseUrl(process.env.NEXT_PUBLIC_LUNARIS_API_URL),
  /** Expected major version of the HTTP contract. */
  expectedApiVersion: "v1",
  /** Health polling interval. */
  healthPollMs: 10_000,
  /** Per-request timeout. */
  requestTimeoutMs: 8_000,
} as const;

export { normalizeBaseUrl };
