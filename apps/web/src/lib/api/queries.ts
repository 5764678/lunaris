"use client";

import type { CandidateSiteCreate, HealthResponse } from "@lunaris/shared-types";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useEffect } from "react";

import { shouldRetryComparison } from "@/lib/comparison/progress";
import { config } from "@/lib/config";
import { useHydrated } from "@/lib/use-hydrated";

import { decodeTerrainScene, type DecodedTerrain } from "@/lib/terrain/scene-data";

import { ApiError, type TerrainSceneMetadata } from "./client";
import { api } from "./instance";
import { useWaking } from "./waking";

export const queryKeys = {
  health: ["health"] as const,
  runtime: ["system", "runtime"] as const,
  datasets: ["datasets"] as const,
  sites: ["sites"] as const,
  comparison: (siteIds: readonly string[]) => ["analysis", "site-comparison", ...siteIds] as const,
  timeline: (siteId: string, startMs: number, endMs: number, stepS: number) =>
    ["sites", siteId, "timeline", startMs, endMs, stepS] as const,
  sun: (startMs: number, endMs: number, stepS: number) =>
    ["ephemeris", "sun", startMs, endMs, stepS] as const,
  ephemeris: (siteId: string, startMs: number, endMs: number, stepS: number) =>
    ["sites", siteId, "ephemeris", startMs, endMs, stepS] as const,
  terrainScene: (sceneId: string, gridSize: number) => ["terrain", "scene", sceneId, gridSize] as const,
  catalog: ["catalog", "sites"] as const,
};

export interface TerrainScene {
  metadata: TerrainSceneMetadata;
  terrain: DecodedTerrain;
  /** Bytes transferred and wall time for the vertex buffer (304 revalidations are fast). */
  dataLatencyMs: number;
}

/** A copy of the query that claims it is still loading (see `useHydrationSafe`). */
function asPending<TData>(query: UseQueryResult<TData, Error>): UseQueryResult<TData, Error> {
  return {
    ...query,
    data: undefined,
    error: null,
    status: "pending",
    fetchStatus: "idle",
    isPending: true,
    isLoading: false,
    isSuccess: false,
    isError: false,
    isFetched: false,
    isFetching: false,
  } as UseQueryResult<TData, Error>;
}

/**
 * Report a query as pending until hydration has finished.
 *
 * TanStack Query reads its shared cache while hydrating (its server snapshot is the live
 * client result). Data fetched by an earlier-hydrated component (e.g. the top bar) would
 * otherwise make a later-hydrating component render data where the server rendered a
 * loading state — a hydration mismatch that discards the tree.
 */
function useHydrationSafe<TData>(query: UseQueryResult<TData, Error>): UseQueryResult<TData, Error> {
  const hydrated = useHydrated();
  return hydrated ? query : asPending(query);
}

export function useHealthQuery() {
  return useHydrationSafe(
    useQuery({
      queryKey: queryKeys.health,
      queryFn: ({ signal }) => api.health(signal),
      refetchInterval: config.healthPollMs,
      refetchIntervalInBackground: false,
      retry: false,
      staleTime: 0,
    }),
  );
}

export type ConnectionState =
  | { kind: "connecting" }
  /** The first answer is slow or failing the way a sleeping free-plan server does (see `useWaking`). */
  | { kind: "waking"; error: ApiError | Error | null }
  | { kind: "online"; health: HealthResponse; latencyMs: number; checkedAt: number }
  | { kind: "degraded"; health: HealthResponse; latencyMs: number; checkedAt: number }
  | { kind: "incompatible"; health: HealthResponse; latencyMs: number; checkedAt: number }
  | { kind: "offline"; error: ApiError | Error; checkedAt: number };

/** Interprets the health query as a single connection state for status indicators. */
export function useConnection(): ConnectionState {
  const query = useHealthQuery();
  const error = query.isError ? query.error : null;
  const waking = useWaking(query.data !== undefined, error);
  if (waking) return { kind: "waking", error };
  if (query.isError) {
    return { kind: "offline", error: query.error, checkedAt: query.errorUpdatedAt };
  }
  if (!query.data) return { kind: "connecting" };
  const { data: health, latencyMs } = query.data;
  const base = { health, latencyMs, checkedAt: query.dataUpdatedAt };
  if (health.api_version !== config.expectedApiVersion) return { kind: "incompatible", ...base };
  return health.status === "ok" ? { kind: "online", ...base } : { kind: "degraded", ...base };
}

/**
 * Once the server answers for the first time in a visit, retries at once every request that
 * failed before it did, whether it has given up (error) or is still waiting out its next retry.
 * The first calls to a sleeping server time out, so without this the page would sit on errors or
 * on a long retry delay after the server woke up.
 */
export function useRetryFailedRequestsOnceAnswered() {
  const queryClient = useQueryClient();
  const answered = useHealthQuery().data !== undefined;
  useEffect(() => {
    if (!answered) return;
    void queryClient.invalidateQueries({
      predicate: (query) => query.state.status === "error" || query.state.fetchFailureCount > 0,
    });
  }, [answered, queryClient]);
}

export function useRuntimeQuery() {
  return useHydrationSafe(
    useQuery({
      queryKey: queryKeys.runtime,
      queryFn: ({ signal }) => api.runtime(signal).then((r) => r.data),
      staleTime: 5 * 60_000,
    }),
  );
}

export function useDatasetsQuery() {
  return useHydrationSafe(
    useQuery({
      queryKey: queryKeys.datasets,
      queryFn: ({ signal }) => api.listDatasets(signal).then((r) => r.data),
      staleTime: 30_000,
    }),
  );
}

export function useSitesQuery() {
  return useHydrationSafe(
    useQuery({
      queryKey: queryKeys.sites,
      queryFn: ({ signal }) => api.listSites(signal).then((r) => r.data),
      staleTime: 15_000,
    }),
  );
}

export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CandidateSiteCreate) => api.createSite(input).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sites }),
  });
}

export function useDeleteSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) => api.deleteSite(siteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sites }),
  });
}

/** Sample spacing for the timeline lanes: 30 d × 1 h = 721 samples per body (cap 10 000). */
export const EPHEMERIS_STEP_S = 3_600;

/** C2 Sun/Earth geometry for a site over the analysis window (SPICE, computed by the API). */
export function useSiteEphemeris(siteId: string | null, startMs: number | null, endMs: number | null) {
  return useHydrationSafe(
    useQuery({
      queryKey: queryKeys.ephemeris(siteId ?? "", startMs ?? 0, endMs ?? 0, EPHEMERIS_STEP_S),
      enabled: siteId !== null && startMs !== null && endMs !== null,
      staleTime: Infinity,
      retry: 1,
      queryFn: ({ signal }) =>
        api
          .siteEphemeris(
            siteId!,
            {
              startUtc: new Date(startMs!).toISOString(),
              endUtc: new Date(endMs!).toISOString(),
              stepS: EPHEMERIS_STEP_S,
            },
            signal,
          )
          .then((r) => r.data),
    }),
  );
}

/**
 * C3 terrain scene: metadata, then the vertex buffer, decoded for display. Kept for the
 * session (the scene is immutable for a given ETag; the browser revalidates the buffer).
 */
export function useTerrainScene(sceneId: string, gridSize: number, enabled: boolean) {
  return useHydrationSafe(
    useQuery({
      queryKey: queryKeys.terrainScene(sceneId, gridSize),
      enabled,
      staleTime: Infinity,
      gcTime: 5 * 60_000,
      retry: 1,
      queryFn: async ({ signal }): Promise<TerrainScene> => {
        const { data: metadata } = await api.terrainScene(sceneId, gridSize, signal);
        const binary = await api.terrainSceneData(metadata, signal);
        const terrain = decodeTerrainScene(binary.data, { width: metadata.width, height: metadata.height });
        return { metadata, terrain, dataLatencyMs: binary.latencyMs };
      },
    }),
  );
}

/** C4 illumination and Earth visibility (astronomical and terrain horizons) for a site. */
export function useSiteTimeline(siteId: string | null, startMs: number | null, endMs: number | null) {
  return useHydrationSafe(
    useQuery({
      queryKey: queryKeys.timeline(siteId ?? "", startMs ?? 0, endMs ?? 0, EPHEMERIS_STEP_S),
      enabled: siteId !== null && startMs !== null && endMs !== null,
      staleTime: Infinity,
      retry: 1,
      queryFn: ({ signal }) =>
        api
          .analysisTimeline(
            siteId!,
            {
              startUtc: new Date(startMs!).toISOString(),
              endUtc: new Date(endMs!).toISOString(),
              stepS: EPHEMERIS_STEP_S,
            },
            signal,
          )
          .then((r) => r.data),
    }),
  );
}

/** The cited south-pole site catalogue (static on the server). */
export function useSiteCatalog() {
  return useHydrationSafe(
    useQuery({
      queryKey: queryKeys.catalog,
      queryFn: ({ signal }) => api.siteCatalog(signal).then((r) => r.data),
      staleTime: Infinity,
    }),
  );
}

/** Adds the cited demo trio to the registry in one request (idempotent on the server). */
export function useRegisterDemoTrio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.registerDemoTrio().then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sites }),
  });
}

/**
 * T-17 site comparison for the given sites, over the server's default window (calendar
 * year 2027, 1 h). Horizon masks and DEM windows are computed on first request (seconds).
 */
export function useSiteComparison(siteIds: readonly string[]) {
  const sorted = [...siteIds].sort();
  return useHydrationSafe(
    useQuery({
      queryKey: queryKeys.comparison(sorted),
      enabled: sorted.length > 0,
      staleTime: Infinity,
      retry: 1,
      queryFn: ({ signal }) => api.siteComparison(sorted, signal).then((r) => r.data),
    }),
  );
}

/**
 * The same comparison with one request per site, so each row can appear as soon as it is ready
 * and one failing site does not blank the others. A one-site request has the same cache key as
 * `useSiteComparison([id])` (the site panel's), so a site already opened there is instant here.
 * Results come back in the order of `siteIds`.
 */
export function useSiteComparisons(siteIds: readonly string[]) {
  const hydrated = useHydrated();
  const results = useQueries({
    queries: siteIds.map((id) => ({
      queryKey: queryKeys.comparison([id]),
      staleTime: Infinity,
      retry: shouldRetryComparison,
      queryFn: ({ signal }: { signal: AbortSignal }) => api.siteComparison([id], signal).then((r) => r.data),
    })),
  });
  return hydrated ? results : results.map(asPending);
}

/** Moon-centred SPICE Sun direction over the analysis window (lights the globe; T-26). */
/**
 * The globe's Sun series. Waits for the server's first answer: a waking server is not asked for
 * ephemerides, and the page start stays limited to the health check and the panels.
 */
export function useSunDirection(startMs: number | null, endMs: number | null) {
  const answered = useHealthQuery().data !== undefined;
  return useHydrationSafe(
    useQuery({
      queryKey: queryKeys.sun(startMs ?? 0, endMs ?? 0, EPHEMERIS_STEP_S),
      enabled: answered && startMs !== null && endMs !== null,
      staleTime: Infinity,
      retry: 1,
      queryFn: ({ signal }) =>
        api
          .sunDirection(
            {
              startUtc: new Date(startMs!).toISOString(),
              endUtc: new Date(endMs!).toISOString(),
              stepS: EPHEMERIS_STEP_S,
            },
            signal,
          )
          .then((r) => r.data),
    }),
  );
}
