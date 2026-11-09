// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConnectionState } from "@/lib/api/queries";

import { WakingBanner } from "./waking-banner";

const mocks = vi.hoisted(() => ({
  state: { kind: "connecting" } as ConnectionState,
  retryWhenAnswered: vi.fn(),
}));
vi.mock("@/lib/api/queries", () => ({
  useConnection: () => mocks.state,
  useRetryFailedRequestsOnceAnswered: () => mocks.retryWhenAnswered(),
}));

afterEach(() => {
  cleanup();
  mocks.retryWhenAnswered.mockClear();
});

describe("WakingBanner", () => {
  it("tells the visitor the server is waking and that the page fills in by itself", () => {
    mocks.state = { kind: "waking", error: null };
    render(<WakingBanner />);
    const banner = screen.getByTestId("waking-banner");
    expect(banner.textContent).toContain("Waking the server, this can take up to a minute.");
    expect(banner.textContent).toContain("fills in by itself");
    // Inside the live region, so a screen reader announces it.
    expect(screen.getByRole("status").contains(banner)).toBe(true);
  });

  it.each<ConnectionState>([
    { kind: "connecting" },
    { kind: "offline", error: new Error("down"), checkedAt: 0 },
  ])("shows nothing while the connection is $kind, but keeps the live region mounted", (state) => {
    mocks.state = state;
    render(<WakingBanner />);
    expect(screen.queryByTestId("waking-banner")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("always arms the retry of requests that failed while the server slept", () => {
    mocks.state = { kind: "connecting" };
    render(<WakingBanner />);
    expect(mocks.retryWhenAnswered).toHaveBeenCalled();
  });
});
