// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShippedTextures } from "@/components/data/use-shipped-textures";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDatasetsQuery } from "@/lib/api/queries";

import { DataStatusIndicator } from "./data-status";

vi.mock("@/lib/api/queries", () => ({ useDatasetsQuery: vi.fn() }));
vi.mock("@/components/data/use-shipped-textures", () => ({ useShippedTextures: vi.fn() }));

type Status = "acquired" | "missing" | "untracked" | "incomplete" | "remote_window";

/** Invented registry shaped like the real one: two downloads, the Moon texture, one streamed DEM. */
function registry(dem: Status, kernels: Status, kit: Status) {
  const entry = (id: string, category: string, status: Status) => ({
    id,
    title: id,
    category,
    local: { status },
  });
  return {
    datasets: [
      entry("lola-ldem-75s-240m", "terrain", dem),
      entry("naif-generic-kernels-lunar", "ephemeris", kernels),
      entry("nasa-svs-cgi-moon-kit", "visualization", kit),
      entry("pgda-lola-20mpp-80s", "terrain", "remote_window"),
    ],
  };
}

function givenDatasets(result: { data?: unknown; isError?: boolean }) {
  vi.mocked(useDatasetsQuery).mockReturnValue({ data: undefined, isError: false, ...result } as never);
}

function givenTextures(ids: string[], settled = true) {
  vi.mocked(useShippedTextures).mockReturnValue({ settled, ids: new Set(ids) });
}

function chip() {
  render(
    <TooltipProvider>
      <DataStatusIndicator />
    </TooltipProvider>,
  );
  return screen.getByTestId("data-status");
}

beforeEach(() => {
  // Radix positions tooltips with ResizeObserver, which jsdom lacks.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DataStatusIndicator", () => {
  it("reads all ready, in green, when downloads, the streamed DEM and the shipped texture are counted", () => {
    // The live site: 2 downloaded, the Moon Kit original absent on the server, its texture shipped.
    givenDatasets({ data: registry("acquired", "acquired", "missing") });
    givenTextures(["nasa-svs-cgi-moon-kit"]);
    const el = chip();
    expect(screen.getByText("4/4 ready").classList.contains("text-ok")).toBe(true);
    expect(el.getAttribute("data-state")).toBe("ready");
    expect(el.getAttribute("href")).toBe("/data");
  });

  it("reads partly ready, in amber, and counts the streamed dataset as ready", () => {
    givenDatasets({ data: registry("missing", "acquired", "missing") });
    givenTextures([]);
    const el = chip();
    expect(screen.getByText("2/4 ready").classList.contains("text-warn")).toBe(true);
    expect(el.getAttribute("data-state")).toBe("partial");
  });

  it("shows a dash, not a count, until the datasets and the texture lookup have both arrived", () => {
    givenDatasets({ data: undefined });
    givenTextures([], false);
    expect(chip().getAttribute("data-state")).toBe("loading");
    cleanup();

    // Datasets are in but the texture manifest is still being looked up: no early "not ready".
    givenDatasets({ data: registry("acquired", "acquired", "missing") });
    givenTextures([], false);
    const el = chip();
    expect(el.getAttribute("data-state")).toBe("loading");
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText(/ready/)).toBeNull();
  });

  it("says unavailable, in red, when the dataset list cannot be loaded", () => {
    givenDatasets({ isError: true });
    givenTextures([]);
    const el = chip();
    expect(el.getAttribute("data-state")).toBe("unavailable");
    expect(screen.getByText("unavailable").classList.contains("text-critical")).toBe(true);
  });

  it("never reads ready for an empty registry", () => {
    givenDatasets({ data: { datasets: [] } });
    givenTextures([]);
    const el = chip();
    expect(screen.getByText("0/0 ready")).toBeTruthy();
    expect(el.getAttribute("data-state")).toBe("partial");
  });
});
