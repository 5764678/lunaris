/**
 * Typed client for the LUNARIS HTTP API.
 *
 * - Types come from @lunaris/shared-types (generated from the backend OpenAPI contract).
 * - Every request has a timeout and returns its latency and request id.
 * - Non-2xx responses are parsed from the LUNARIS error envelope into `ApiError`.
 * - Responses get a shallow runtime shape check, so pointing the client at the wrong
 *   server fails loudly instead of rendering garbage.
 */
import type {
  CandidateSite,
  CandidateSiteCreate,
  CandidateSiteList,
  DatasetListResponse,
  DatasetSummary,
  ErrorDetail,
  ErrorResponse,
  HealthResponse,
  RuntimeReport,
  SiteEphemeris,
} from "@lunaris/shared-types";

export type ApiErrorKind = "network" | "timeout" | "http" | "invalid_response";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly details: ErrorDetail[];
  readonly requestId: string | null;

  constructor(init: {
    kind: ApiErrorKind;
    message: string;
    status?: number | null;
    code?: string | null;
    details?: ErrorDetail[];
    requestId?: string | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.code = init.code ?? null;
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
  }
}

export interface ApiResult<T> {
  data: T;
  status: number;
  latencyMs: number;
  requestId: string | null;
}

export interface ApiClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  now?: () => number;
}

type Guard<T> = (value: unknown) => value is T;

interface RequestOptions<T> {
  body?: unknown;
  signal?: AbortSignal | undefined;
  /** Non-2xx statuses whose body is a valid payload of type T (e.g. 503 for /health). */
  acceptStatuses?: readonly number[];
  guard?: Guard<T>;
}

// ── Shape guards ───────────────────────────────────────────────────────────
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const isErrorResponse: Guard<ErrorResponse> = (v): v is ErrorResponse =>
  isObject(v) && isObject(v.error) && typeof v.error.code === "string" && typeof v.error.message === "string";

export const isHealthResponse: Guard<HealthResponse> = (v): v is HealthResponse =>
  isObject(v) &&
  v.service === "lunaris-api" &&
  (v.status === "ok" || v.status === "degraded") &&
  typeof v.version === "string" &&
  typeof v.api_version === "string" &&
  Array.isArray(v.checks);

const isRuntimeReport: Guard<RuntimeReport> = (v): v is RuntimeReport =>
  isObject(v) && typeof v.service_version === "string" && Array.isArray(v.components);

const isDatasetSummary: Guard<DatasetSummary> = (v): v is DatasetSummary =>
  isObject(v) && typeof v.id === "string" && isObject(v.local) && Array.isArray(v.files);

const isDatasetList: Guard<DatasetListResponse> = (v): v is DatasetListResponse =>
  isObject(v) && Array.isArray(v.datasets) && v.datasets.every(isDatasetSummary);

const isCandidateSite: Guard<CandidateSite> = (v): v is CandidateSite =>
  isObject(v) &&
  typeof v.id === "string" &&
  typeof v.name === "string" &&
  isObject(v.coordinate) &&
  typeof v.coordinate.latitude_deg === "number" &&
  typeof v.coordinate.longitude_deg === "number";

const isCandidateSiteList: Guard<CandidateSiteList> = (v): v is CandidateSiteList =>
  isObject(v) && Array.isArray(v.sites) && v.sites.every(isCandidateSite);

const isEphemerisSample = (v: unknown): boolean =>
  isObject(v) &&
  typeof v.epoch_utc === "string" &&
  typeof v.elevation_deg === "number" &&
  typeof v.angular_radius_deg === "number" &&
  Array.isArray(v.direction_moon_me) &&
  v.direction_moon_me.length === 3;

/** C2 ephemeris: bodies are "sun" / "earth", each with evidence and samples. */
export const isSiteEphemeris: Guard<SiteEphemeris> = (v): v is SiteEphemeris =>
  isObject(v) &&
  typeof v.site_id === "string" &&
  Array.isArray(v.bodies) &&
  v.bodies.every(
    (b) =>
      isObject(b) &&
      (b.body === "sun" || b.body === "earth") &&
      isObject(b.evidence) &&
      typeof b.evidence.kind === "string" &&
      Array.isArray(b.samples) &&
      b.samples.every(isEphemerisSample),
  );

// ── Client ─────────────────────────────────────────────────────────────────
export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? 8_000;
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const now = options.now ?? (() => performance.now());

  async function request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    { body, signal, acceptStatuses = [], guard }: RequestOptions<T> = {},
  ): Promise<ApiResult<T>> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener("abort", onExternalAbort, { once: true });

    const started = now();
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? null : JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (cause) {
      if (signal?.aborted) throw cause; // caller cancelled (e.g. query unmounted)
      throw new ApiError({
        kind: timedOut ? "timeout" : "network",
        message: timedOut
          ? `LUNARIS API did not respond within ${timeoutMs / 1000} s (${baseUrl}).`
          : `LUNARIS API unreachable at ${baseUrl}.`,
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);
    }

    const latencyMs = now() - started;
    const requestId = response.headers.get("x-request-id");
    const text = response.status === 204 ? "" : await response.text();
    let payload: unknown = undefined;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new ApiError({
          kind: "invalid_response",
          status: response.status,
          requestId,
          message: `Expected JSON from ${path}, received something else (HTTP ${response.status}).`,
        });
      }
    }

    if (!response.ok && !acceptStatuses.includes(response.status)) {
      const envelope = isErrorResponse(payload) ? payload.error : null;
      throw new ApiError({
        kind: "http",
        status: response.status,
        code: envelope?.code ?? null,
        message: envelope?.message ?? `HTTP ${response.status} from ${path}.`,
        details: envelope?.details ?? [],
        requestId: envelope?.request_id ?? requestId,
      });
    }

    if (guard && !guard(payload)) {
      throw new ApiError({
        kind: "invalid_response",
        status: response.status,
        requestId,
        message: `Response from ${path} does not match the LUNARIS API contract.`,
      });
    }
    return { data: payload as T, status: response.status, latencyMs, requestId };
  }

  return {
    baseUrl,
    health: (signal?: AbortSignal) =>
      request<HealthResponse>("GET", "/health", {
        signal,
        acceptStatuses: [503],
        guard: isHealthResponse,
      }),
    runtime: (signal?: AbortSignal) =>
      request<RuntimeReport>("GET", "/api/v1/system/runtime", { signal, guard: isRuntimeReport }),
    listDatasets: (signal?: AbortSignal) =>
      request<DatasetListResponse>("GET", "/api/v1/datasets", { signal, guard: isDatasetList }),
    listSites: (signal?: AbortSignal) =>
      request<CandidateSiteList>("GET", "/api/v1/sites", { signal, guard: isCandidateSiteList }),
    createSite: (input: CandidateSiteCreate) =>
      request<CandidateSite>("POST", "/api/v1/sites", { body: input, guard: isCandidateSite }),
    deleteSite: (siteId: string) =>
      request<undefined>("DELETE", `/api/v1/sites/${encodeURIComponent(siteId)}`),
    siteEphemeris: (
      siteId: string,
      window: { startUtc: string; endUtc: string; stepS: number },
      signal?: AbortSignal,
    ) => {
      const query = new URLSearchParams({
        start_utc: window.startUtc,
        end_utc: window.endUtc,
        step_s: String(window.stepS),
      });
      return request<SiteEphemeris>(
        "GET",
        `/api/v1/sites/${encodeURIComponent(siteId)}/ephemeris?${query.toString()}`,
        { signal, guard: isSiteEphemeris },
      );
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Human-readable message for any error thrown by the client. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === "http" && error.details.length > 0) {
      const first = error.details[0];
      if (first) return `${error.message} ${first.location.slice(1).join(".")}: ${first.message}`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Unknown error.";
}
