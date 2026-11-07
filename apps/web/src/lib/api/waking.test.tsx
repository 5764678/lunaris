// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiErrorKind } from "./client";
import { SLOW_FIRST_ANSWER_MS, WAKE_WINDOW_MS, looksLikeWaking, retryWhileWaking, useWaking } from "./waking";

const failure = (kind: ApiErrorKind, extra: { status?: number; elapsedMs?: number } = {}) =>
  new ApiError({ kind, message: "x", ...extra });

describe("looksLikeWaking", () => {
  it("treats the wait before any failure as waking", () => {
    expect(looksLikeWaking(null)).toBe(true);
    expect(looksLikeWaking(undefined)).toBe(true);
  });

  it("treats a timeout as waking", () => {
    expect(looksLikeWaking(failure("timeout"))).toBe(true);
  });

  it("treats a connection that failed only after a long wait as waking, but not one refused at once", () => {
    expect(looksLikeWaking(failure("network", { elapsedMs: 9_000 }))).toBe(true);
    expect(looksLikeWaking(failure("network", { elapsedMs: SLOW_FIRST_ANSWER_MS }))).toBe(true);
    expect(looksLikeWaking(failure("network", { elapsedMs: 40 }))).toBe(false);
  });

  it("treats the hosting proxy's gateway pages as waking", () => {
    for (const status of [502, 503, 504]) {
      expect(looksLikeWaking(failure("invalid_response", { status }))).toBe(true);
      expect(looksLikeWaking(failure("http", { status }))).toBe(true);
    }
  });

  it("does not hide a real answer from a server that is up", () => {
    expect(looksLikeWaking(failure("http", { status: 404 }))).toBe(false);
    expect(looksLikeWaking(failure("http", { status: 500 }))).toBe(false);
    expect(looksLikeWaking(failure("invalid_response", { status: 200 }))).toBe(false);
    expect(looksLikeWaking(new Error("something else"))).toBe(false);
  });
});

describe("retryWhileWaking", () => {
  const sleeping = { serverAnswered: false, sincePageLoadMs: 20_000 };

  it("always allows the first retry, whatever failed", () => {
    expect(retryWhileWaking(0, failure("http", { status: 404 }), sleeping)).toBe(true);
    expect(retryWhileWaking(0, failure("http", { status: 404 }), { ...sleeping, serverAnswered: true })).toBe(
      true,
    );
  });

  it("keeps retrying start-up failures while the server has not answered and the page is young", () => {
    for (const failures of [1, 2, 5, 9])
      expect(retryWhileWaking(failures, failure("timeout"), sleeping)).toBe(true);
  });

  it("gives up as before for anything that is not a start-up failure", () => {
    expect(retryWhileWaking(1, failure("http", { status: 500 }), sleeping)).toBe(false);
    expect(retryWhileWaking(1, failure("network", { elapsedMs: 5 }), sleeping)).toBe(false);
  });

  it("gives up once the server has answered, or once the wake window has passed", () => {
    expect(retryWhileWaking(1, failure("timeout"), { ...sleeping, serverAnswered: true })).toBe(false);
    expect(retryWhileWaking(1, failure("timeout"), { ...sleeping, sincePageLoadMs: WAKE_WINDOW_MS })).toBe(
      false,
    );
    expect(
      retryWhileWaking(1, failure("timeout"), { ...sleeping, sincePageLoadMs: WAKE_WINDOW_MS - 1 }),
    ).toBe(true);
  });
});

describe("useWaking", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it("stays false while the server answers quickly", () => {
    const { result, rerender } = renderHook(({ answered }) => useWaking(answered, null), {
      initialProps: { answered: false },
    });
    advance(SLOW_FIRST_ANSWER_MS - 1);
    expect(result.current).toBe(false);
    rerender({ answered: true });
    advance(WAKE_WINDOW_MS);
    expect(result.current).toBe(false);
  });

  it("turns true once the first answer is slower than the threshold, and false when it arrives", () => {
    const { result, rerender } = renderHook(({ answered }) => useWaking(answered, null), {
      initialProps: { answered: false },
    });
    advance(SLOW_FIRST_ANSWER_MS);
    expect(result.current).toBe(true);
    rerender({ answered: true });
    expect(result.current).toBe(false);
  });

  it("stays true through start-up failures, then gives up after the wake window", () => {
    const timeout = failure("timeout");
    const { result } = renderHook(() => useWaking(false, timeout));
    advance(SLOW_FIRST_ANSWER_MS);
    expect(result.current).toBe(true);
    advance(WAKE_WINDOW_MS - SLOW_FIRST_ANSWER_MS - 1);
    expect(result.current).toBe(true);
    advance(1);
    expect(result.current).toBe(false);
  });

  it("is never true for a failure that is not a start-up failure", () => {
    const refused = failure("network", { elapsedMs: 5 });
    const { result } = renderHook(() => useWaking(false, refused));
    advance(WAKE_WINDOW_MS);
    expect(result.current).toBe(false);
  });
});
