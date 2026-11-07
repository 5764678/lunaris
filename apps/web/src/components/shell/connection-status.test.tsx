// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { ConnectionState } from "@/lib/api/queries";

import { ConnectionStatus } from "./connection-status";

const mocks = vi.hoisted(() => ({ state: { kind: "connecting" } as ConnectionState }));
vi.mock("@/lib/api/queries", () => ({ useConnection: () => mocks.state }));

afterEach(cleanup);

function chip(state: ConnectionState) {
  mocks.state = state;
  render(
    <TooltipProvider>
      <ConnectionStatus />
    </TooltipProvider>,
  );
  return screen.getByTestId("api-status");
}

describe("ConnectionStatus", () => {
  it("says the server is waking up, not that it is offline", () => {
    const button = chip({ kind: "waking", error: null });
    expect(button.getAttribute("data-state")).toBe("waking");
    expect(button.textContent).toContain("Waking up");
    expect(button.textContent).not.toMatch(/offline/i);
  });

  it("still says Offline when the server is really down", () => {
    const button = chip({ kind: "offline", error: new Error("down"), checkedAt: 0 });
    expect(button.getAttribute("data-state")).toBe("offline");
    expect(button.textContent).toContain("Offline");
  });
});
