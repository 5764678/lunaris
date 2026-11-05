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
  components,
} from "@lunaris/shared-types";

/** C3 terrain scene metadata (generated from the API contract). */
export type TerrainSceneMetadata = components["schemas"]["TerrainSceneMetadata"];

const MAX_SCENE_GRID = 1024;
const SCENE_DATA_TIMEOUT_MS = 60_000;

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

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isGridSize = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 2 && v <= MAX_SCENE_GRID;

/** Checks every field the terrain scene relies on, including the binary layout (C3). */
export const isTerrainSceneMetadata: Guard<TerrainSceneMetadata> = (v): v is TerrainSceneMetadata => {
  if (!isObject(v) || !isGridSize(v.width) || !isGridSize(v.height)) return false;
  const layout = v.layout;
  return (
    v.frame === "MOON_ME" &&
    Array.isArray(v.origin_moon_me_m) &&
    v.origin_moon_me_m.length === 3 &&
    v.origin_moon_me_m.every(isFiniteNumber) &&
    isFiniteNumber(v.height_min_m) &&
    isFiniteNumber(v.height_max_m) &&
    isFiniteNumber(v.vertex_spacing_m) &&
    typeof v.data_url === "string" &&
    v.data_url.startsWith("/api/v1/terrain/scenes/") &&
    isObject(layout) &&
    layout.dtype === "float32" &&
    layout.byte_order === "little" &&
    layout.values_per_vertex === 4 &&
    layout.byte_length === v.width * v.height * 16 &&
    isObject(v.dem) &&
    typeof v.dem.sha256 === "string" &&
    isObject(v.evidence) &&
    typeof v.evidence.kind === "string"
  );
};

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
    terrainScene: (sceneId: string, gridSize: number, signal?: AbortSignal) =>
      request<TerrainSceneMetadata>(
        "GET",
        `/api/v1/terrain/scenes/${encodeURIComponent(sceneId)}?grid_size=${gridSize}`,
        { signal, guard: isTerrainSceneMetadata },
      ),
    terrainSceneData: (metadata: TerrainSceneMetadata, signal?: AbortSignal) =>
      requestBinary(metadata.data_url, metadata.layout.byte_length, signal),
  };

  /**
   * Fetches a C3 vertex buffer. `cache: "no-cache"` makes the browser revalidate with
   * the response's ETag (If-None-Match → 304) instead of downloading 16 MiB again, and
   * without a custom header that would need a CORS preflight.
   */
  async function requestBinary(path: string, expectedBytes: number, signal?: AbortSignal) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, SCENE_DATA_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener("abort", onExternalAbort, { once: true });
    const started = now();
    try {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}${path}`, {
          headers: { Accept: "application/octet-stream" },
          signal: controller.signal,
          cache: "no-cache",
        });
      } catch (cause) {
        if (signal?.aborted) throw cause;
        throw new ApiError({
          kind: timedOut ? "timeout" : "network",
          message: timedOut
            ? `Terrain data did not arrive within ${SCENE_DATA_TIMEOUT_MS / 1000} s.`
            : `LUNARIS API unreachable at ${baseUrl}.`,
        });
      }
      const requestId = response.headers.get("x-request-id");
      if (!response.ok) {
        let envelope: ErrorResponse["error"] | null = null;
        try {
          const payload: unknown = await response.json();
          envelope = isErrorResponse(payload) ? payload.error : null;
        } catch {
          // not an envelope
        }
        throw new ApiError({
          kind: "http",
          status: response.status,
          code: envelope?.code ?? null,
          message: envelope?.message ?? `HTTP ${response.status} from ${path}.`,
          details: envelope?.details ?? [],
          requestId: envelope?.request_id ?? requestId,
        });
      }
      const data = await response.arrayBuffer();
      if (data.byteLength !== expectedBytes) {
        throw new ApiError({
          kind: "invalid_response",
          status: response.status,
          requestId,
          message: `Terrain data from ${path} is ${data.byteLength} bytes; the metadata promised ${expectedBytes}.`,
        });
      }
      return { data, status: response.status, latencyMs: now() - started, requestId };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);
    }
  }
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
