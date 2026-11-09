import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, describeError, isTimelineAnalysis } from "./client";

const HEALTH = {
  status: "ok",
  service: "lunaris-api",
  version: "0.1.0",
  api_version: "v1",
  environment: "test",
  time_utc: "2026-11-04T09:30:00Z",
  uptime_s: 1.5,
  checks: [],
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function clientWith(fetchImpl: typeof fetch, timeoutMs = 1_000) {
  let t = 0;
  return createApiClient({
    baseUrl: "http://api.test/",
    fetch: fetchImpl,
    timeoutMs,
    now: () => (t += 5),
  });
}

describe("createApiClient", () => {
  it("returns typed health with latency and request id", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(HEALTH, 200, { "x-request-id": "req-1" }));
    const client = clientWith(fetchMock as unknown as typeof fetch);
    const result = await client.health();
    expect(result.data.status).toBe("ok");
    expect(result.requestId).toBe("req-1");
    expect(result.latencyMs).toBe(5);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/health",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("accepts a degraded 503 health body instead of throwing", async () => {
    const client = clientWith((async () =>
      jsonResponse({ ...HEALTH, status: "degraded" }, 503)) as unknown as typeof fetch);
    const result = await client.health();
    expect(result.status).toBe(503);
    expect(result.data.status).toBe("degraded");
  });

  it("parses the error envelope into ApiError", async () => {
    const envelope = {
      error: {
        code: "validation_error",
        message: "Request validation failed.",
        details: [{ location: ["body", "latitude_deg"], message: "too large", type: "x" }],
        request_id: "req-9",
      },
    };
    const client = clientWith((async () => jsonResponse(envelope, 422)) as unknown as typeof fetch);
    const error = await client
      .createSite({ name: "A", latitude_deg: 91, longitude_deg: 0 })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.kind).toBe("http");
    expect(apiError.status).toBe(422);
    expect(apiError.code).toBe("validation_error");
    expect(apiError.requestId).toBe("req-9");
    expect(describeError(apiError)).toContain("latitude_deg: too large");
  });

  it("sends JSON bodies with a content type", async () => {
    const site = {
      id: "s1",
      name: "A",
      coordinate: { latitude_deg: -89, longitude_deg: 10, frame: "MOON_ME" },
    };
    const fetchMock = vi.fn(async () => jsonResponse(site, 201));
    const client = clientWith(fetchMock as unknown as typeof fetch);
    await client.createSite({ name: "A", latitude_deg: -89, longitude_deg: 10 });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ name: "A", latitude_deg: -89, longitude_deg: 10 });
  });

  it("handles 204 responses without a body", async () => {
    const client = clientWith((async () => new Response(null, { status: 204 })) as unknown as typeof fetch);
    const result = await client.deleteSite("a b/c");
    expect(result.status).toBe(204);
    expect(result.data).toBeUndefined();
  });

  it("encodes path parameters", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 204 }),
    );
    await clientWith(fetchMock as unknown as typeof fetch).deleteSite("a b/c");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.test/api/v1/sites/a%20b%2Fc");
  });

  it("reports unreachable servers as network errors", async () => {
    const client = clientWith((async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch);
    await expect(client.health()).rejects.toMatchObject({ kind: "network" });
  });

  it("records how long a request ran before a network failure or timeout (the clock ticks 5 ms per read)", async () => {
    const refused = clientWith((async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch);
    await expect(refused.health()).rejects.toMatchObject({ kind: "network", elapsedMs: 5 });

    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as unknown as typeof fetch;
    await expect(clientWith(hanging, 20).health()).rejects.toMatchObject({ kind: "timeout", elapsedMs: 5 });
  });

  it("leaves elapsedMs empty for errors that came with a response", async () => {
    const client = clientWith((async () => jsonResponse({ nope: true }, 500)) as unknown as typeof fetch);
    await expect(client.health()).rejects.toMatchObject({ kind: "http", status: 500, elapsedMs: null });
  });

  it("times out slow responses", async () => {
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as unknown as typeof fetch;
    await expect(clientWith(hanging, 20).health()).rejects.toMatchObject({ kind: "timeout" });
  });

  it("rejects responses that do not match the contract", async () => {
    const client = clientWith((async () => jsonResponse({ hello: "world" })) as unknown as typeof fetch);
    await expect(client.health()).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("rejects non-JSON bodies", async () => {
    const client = clientWith(
      (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch,
    );
    await expect(client.listSites()).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("propagates caller cancellation instead of wrapping it", async () => {
    const controller = new AbortController();
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as unknown as typeof fetch;
    const pending = clientWith(fetchImpl).health(controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(DOMException);
  });
});

describe("terrain scene (C3)", () => {
  // SYNTHETIC metadata shaped like the API's TerrainSceneMetadata; a 2×2 grid.
  const META = {
    scene_id: "south-pole",
    title: "synthetic",
    frame: "MOON_ME",
    width: 2,
    height: 2,
    origin_moon_me_m: [0, 0, -1737400],
    height_reference_radius_m: 1737400,
    height_min_m: -1,
    height_max_m: 1,
    vertex_spacing_m: 100,
    half_extent_m: 50,
    center_latitude_deg: -90,
    center_longitude_deg: 0,
    resampling: "bilinear",
    method: "synthetic",
    nodata: "NaN",
    nodata_vertex_count: 0,
    layout: {
      dtype: "float32",
      byte_order: "little",
      order: "row-major",
      values_per_vertex: 4,
      components: ["x_m", "y_m", "z_m", "height_m"],
      row_direction: "row 0 toward 0° E",
      byte_length: 64,
    },
    dem: { sha256: "a".repeat(64) },
    evidence: { kind: "derived_product" },
    etag: '"e"',
    data_url: "/api/v1/terrain/scenes/south-pole/data?grid_size=2",
  };

  it("fetches metadata with the grid size and checks its layout", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(META));
    const client = clientWith(fetchMock as unknown as typeof fetch);
    const result = await client.terrainScene("south-pole", 2);
    expect(result.data.width).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/v1/terrain/scenes/south-pole?grid_size=2",
      expect.anything(),
    );
    const wrong = clientWith((async () =>
      jsonResponse({ ...META, layout: { ...META.layout, byte_length: 63 } })) as unknown as typeof fetch);
    await expect(wrong.terrainScene("south-pole", 2)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("downloads the vertex buffer with ETag revalidation and checks its length", async () => {
    const body = new Uint8Array(64);
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }));
    const client = clientWith(fetchMock as unknown as typeof fetch);
    const result = await client.terrainSceneData(META as never);
    expect(result.data.byteLength).toBe(64);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/v1/terrain/scenes/south-pole/data?grid_size=2",
      expect.objectContaining({ cache: "no-cache" }),
    );
    const short = clientWith((async () => new Response(new Uint8Array(60))) as unknown as typeof fetch);
    await expect(short.terrainSceneData(META as never)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("parses an error envelope from the data endpoint", async () => {
    const client = clientWith((async () =>
      jsonResponse(
        { error: { code: "not_found", message: "DEM not acquired", details: [], request_id: "r" } },
        404,
      )) as unknown as typeof fetch);
    await expect(client.terrainSceneData(META as never)).rejects.toMatchObject({
      kind: "http",
      status: 404,
      message: "DEM not acquired",
    });
  });
});

describe("isTimelineAnalysis", () => {
  // SYNTHETIC minimal C4 response.
  const evidence = { kind: "calculation", statement: "s", sources: [], method: "m", assumptions: [] };
  const result = () => ({
    evidence,
    astronomical: {},
    terrain: null,
    limitations: [],
    samples: [
      { epoch_utc: "2026-11-05T00:00:00Z", astronomical_visible_fraction: 1, terrain_visible_fraction: null },
    ],
  });
  const valid = () => ({
    site_id: "s",
    step_s: 3600,
    terrain_horizon_available: false,
    illumination: result(),
    earth_visibility: result(),
  });

  it("accepts a contract-shaped response", () => {
    expect(isTimelineAnalysis(valid())).toBe(true);
  });

  it("rejects evidence without a known kind (would crash the badge) and malformed samples", () => {
    const noKind = valid();
    (noKind.earth_visibility as { evidence: unknown }).evidence = {};
    expect(isTimelineAnalysis(noKind)).toBe(false);
    const badKind = valid();
    badKind.illumination.evidence = { ...evidence, kind: "guess" };
    expect(isTimelineAnalysis(badKind)).toBe(false);
    const badSample = valid();
    (badSample.earth_visibility.samples[0] as Record<string, unknown>).astronomical_visible_fraction = "1";
    expect(isTimelineAnalysis(badSample)).toBe(false);
  });
});
