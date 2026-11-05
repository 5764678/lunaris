"use client";

import type { CandidateSiteCreate, HealthResponse } from "@lunaris/shared-types";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";

import { config } from "@/lib/config";
import { useHydrated } from "@/lib/use-hydrated";

import { decodeTerrainScene, type DecodedTerrain } from "@/lib/terrain/scene-data";

import { ApiError, type TerrainSceneMetadata } from "./client";
import { api } from "./instance";

export const queryKeys = {
  health: ["health"] as const,
  runtime: ["system", "runtime"] as const,
  datasets: ["datasets"] as const,
  sites: ["sites"] as const,
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
  if (hydrated) return query;
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
  | { kind: "online"; health: HealthResponse; latencyMs: number; checkedAt: number }
  | { kind: "degraded"; health: HealthResponse; latencyMs: number; checkedAt: number }
  | { kind: "incompatible"; health: HealthResponse; latencyMs: number; checkedAt: number }
  | { kind: "offline"; error: ApiError | Error; checkedAt: number };

/** Interprets the health query as a single connection state for status indicators. */
export function useConnection(): ConnectionState {
  const query = useHealthQuery();
  if (query.isError) {
    return { kind: "offline", error: query.error, checkedAt: query.errorUpdatedAt };
  }
  if (!query.data) return { kind: "connecting" };
  const { data: health, latencyMs } = query.data;
  const base = { health, latencyMs, checkedAt: query.dataUpdatedAt };
  if (health.api_version !== config.expectedApiVersion) return { kind: "incompatible", ...base };
  return health.status === "ok" ? { kind: "online", ...base } : { kind: "degraded", ...base };
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
