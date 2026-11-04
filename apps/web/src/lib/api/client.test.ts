import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, describeError } from "./client";

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
