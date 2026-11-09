import { describe, expect, it } from "vitest";

import { ApiError, SITE_COMPARISON_TIMEOUT_MS, type SiteComparison } from "@/lib/api/client";

import { metricCopy } from "./labels";
import {
  columnsFor,
  countProgress,
  describeRowError,
  EXPECTED_COLUMNS,
  progressMessage,
  rowStatus,
  shouldRetryComparison,
} from "./progress";

const api = (kind: ApiError["kind"], status: number | null = null, message = "technical message") =>
  new ApiError({ kind, status, message });

describe("rowStatus", () => {
  const idle = { data: undefined, row: undefined, isFetching: false, isError: false };

  it("is ready when the answer holds this site's row", () => {
    expect(rowStatus({ ...idle, data: {}, row: {} })).toBe("ready");
  });

  it("counts an answer without this site's row as failed", () => {
    expect(rowStatus({ ...idle, data: {}, row: undefined })).toBe("error");
  });

  it("is pending before the first answer, while fetching and while idle", () => {
    expect(rowStatus({ ...idle, isFetching: true })).toBe("pending");
    expect(rowStatus(idle)).toBe("pending");
  });

  it("is failed once the request has given up", () => {
    expect(rowStatus({ ...idle, isError: true })).toBe("error");
  });

  it("is pending again while a retry runs, although the old error is still reported", () => {
    expect(rowStatus({ ...idle, isError: true, isFetching: true })).toBe("pending");
  });
});

describe("countProgress and progressMessage", () => {
  it("counts rows by status", () => {
    expect(countProgress(["ready", "pending", "error", "ready"])).toEqual({ ready: 2, failed: 1, total: 4 });
  });

  it("says how many are done, gives the estimate and says what is saved", () => {
    expect(progressMessage({ ready: 2, failed: 0, total: 3 })).toBe(
      "Computing 2 of 3 sites. Usually 20 to 40 seconds the first time; saved results load instantly.",
    );
  });

  it("uses the singular for one site and mentions failures", () => {
    expect(progressMessage({ ready: 0, failed: 0, total: 1 })).toContain("Computing 0 of 1 site.");
    expect(progressMessage({ ready: 1, failed: 1, total: 3 })).toContain("Computing 1 of 3 sites, 1 failed.");
  });
});

describe("describeRowError", () => {
  it("explains a timeout in plain words, with the number of seconds from the client setting", () => {
    const { message, detail } = describeRowError(
      api("timeout", null, "did not respond within 90 s (https://x)"),
    );
    expect(message).toContain(`${SITE_COMPARISON_TIMEOUT_MS / 1000} seconds`);
    expect(message).toContain("busy or still waking up");
    expect(detail).toContain("https://x");
  });

  it("explains an unreachable server", () => {
    expect(describeRowError(api("network")).message).toBe("Could not reach the server.");
  });

  it("passes the API's own message through for other errors", () => {
    expect(describeRowError(api("http", 500, "Horizon mask failed.")).message).toBe("Horizon mask failed.");
    expect(describeRowError(new Error("boom")).message).toBe("boom");
    expect(describeRowError("odd").message).toBe("Unknown error.");
  });
});

describe("shouldRetryComparison", () => {
  it("repeats a network failure or a server error once", () => {
    expect(shouldRetryComparison(0, api("network"))).toBe(true);
    expect(shouldRetryComparison(0, api("http", 500))).toBe(true);
    expect(shouldRetryComparison(0, api("http", 502))).toBe(true);
    expect(shouldRetryComparison(0, api("invalid_response", 502))).toBe(true);
    expect(shouldRetryComparison(1, api("network"))).toBe(false);
  });

  it("does not repeat a timeout, which would double the wait before Retry appears", () => {
    expect(shouldRetryComparison(0, api("timeout"))).toBe(false);
  });

  it("does not repeat a request the server refused (4xx)", () => {
    expect(shouldRetryComparison(0, api("http", 404))).toBe(false);
    expect(shouldRetryComparison(0, api("http", 422))).toBe(false);
  });
});

describe("columnsFor", () => {
  it("draws the expected columns until an answer arrives", () => {
    const columns = columnsFor(undefined);
    expect(columns).toHaveLength(12);
    expect(columns[0]).toMatchObject({ key: "surface_height_m", unit: "m" });
  });

  it("uses the columns of the first answer, so a column added to the API still shows", () => {
    const answer = {
      columns: [{ key: "new_metric", label: "New", unit: "m", description: "d" }],
    } as SiteComparison;
    expect(columnsFor(answer)).toEqual(answer.columns);
  });

  it("has plain wording for every expected column, so the loading header never shows a raw key", () => {
    const keys = EXPECTED_COLUMNS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(metricCopy(key, "FALLBACK").label).not.toBe("FALLBACK");
  });
});
