// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ health: vi.fn() }));
vi.mock("./instance", () => ({ api: { health: mocks.health } }));

import { useRetryFailedRequestsOnceAnswered } from "./queries";

const HEALTH_RESULT = {
  data: { status: "ok", service: "lunaris-api", version: "0.1.0", api_version: "v1", checks: [] },
  status: 200,
  latencyMs: 5,
  requestId: null,
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useRetryFailedRequestsOnceAnswered", () => {
  it("retries what failed while the server slept as soon as it answers, and leaves the rest alone", async () => {
    let answerHealth: (value: typeof HEALTH_RESULT) => void = () => {};
    mocks.health.mockReturnValue(new Promise((resolve) => (answerHealth = resolve)));
    const failedOnce = vi.fn().mockRejectedValueOnce(new Error("timed out")).mockResolvedValue("filled in");
    const fine = vi.fn().mockResolvedValue("fine");

    const { wrapper } = setup();
    const { result } = renderHook(
      () => {
        useRetryFailedRequestsOnceAnswered();
        return {
          failed: useQuery({ queryKey: ["failed"], queryFn: failedOnce }),
          fine: useQuery({ queryKey: ["fine"], queryFn: fine }),
        };
      },
      { wrapper },
    );

    // The server has not answered: the request that failed stays failed, nothing is retried yet.
    await waitFor(() => expect(result.current.failed.isError).toBe(true));
    await waitFor(() => expect(result.current.fine.data).toBe("fine"));
    expect(failedOnce).toHaveBeenCalledTimes(1);

    // The server answers: only the failed request is retried, and it fills in.
    answerHealth(HEALTH_RESULT);
    await waitFor(() => expect(result.current.failed.data).toBe("filled in"));
    expect(failedOnce).toHaveBeenCalledTimes(2);
    expect(fine).toHaveBeenCalledTimes(1);
  });
});
