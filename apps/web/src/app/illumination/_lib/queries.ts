"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiError, isErrorResponse } from "@/lib/api/client";
import { api } from "@/lib/api/instance";
import { useHydrated } from "@/lib/use-hydrated";

import { isHorizonMask, type HorizonMask } from "./model";

/** First request for a site ray-marches 1 440 azimuths over 200 km (seconds); then it is cached. */
const HORIZON_TIMEOUT_MS = 60_000;

/** `GET /api/v1/sites/{id}/horizon` (T-16): the terrain horizon mask at the default eye height. */
export async function fetchHorizon(siteId: string, signal?: AbortSignal): Promise<HorizonMask> {
  const path = `/api/v1/sites/${encodeURIComponent(siteId)}/horizon`;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, HORIZON_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  let response: Response;
  try {
    response = await fetch(`${api.baseUrl}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new ApiError({
      kind: timedOut ? "timeout" : "network",
      message: timedOut
        ? `Horizon mask did not arrive within ${HORIZON_TIMEOUT_MS / 1000} s.`
        : `LUNARIS API unreachable at ${api.baseUrl}.`,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // handled below
  }
  if (!response.ok) {
    const envelope = isErrorResponse(payload) ? payload.error : null;
    throw new ApiError({
      kind: "http",
      status: response.status,
      code: envelope?.code ?? null,
      message: envelope?.message ?? `HTTP ${response.status} from ${path}.`,
      details: envelope?.details ?? [],
      requestId: envelope?.request_id ?? response.headers.get("x-request-id"),
    });
  }
  if (!isHorizonMask(payload)) {
    throw new ApiError({
      kind: "invalid_response",
      status: response.status,
      message: `Response from ${path} does not match the LUNARIS API contract.`,
    });
  }
  return payload;
}

export function useSiteHorizon(siteId: string | null) {
  const hydrated = useHydrated();
  return useQuery({
    queryKey: ["sites", siteId ?? "", "horizon"],
    enabled: hydrated && siteId !== null,
    staleTime: Infinity,
    retry: 1,
    queryFn: ({ signal }) => fetchHorizon(siteId!, signal),
  });
}

/** C4 timeline for the page's own window (not the dashboard timeline's). */
export function useIlluminationTimeline(
  siteId: string | null,
  window: { startMs: number; endMs: number; stepS: number } | null,
) {
  const hydrated = useHydrated();
  return useQuery({
    queryKey: ["illumination", siteId ?? "", window?.startMs ?? 0, window?.endMs ?? 0, window?.stepS ?? 0],
    enabled: hydrated && siteId !== null && window !== null,
    staleTime: Infinity,
    retry: 1,
    queryFn: ({ signal }) =>
      api
        .analysisTimeline(
          siteId!,
          {
            startUtc: new Date(window!.startMs).toISOString(),
            endUtc: new Date(window!.endMs).toISOString(),
            stepS: window!.stepS,
          },
          signal,
        )
        .then((r) => r.data),
  });
}
