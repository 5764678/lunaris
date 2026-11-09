// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDatasetsQuery } from "@/lib/api/queries";

import { AnalysisReadiness } from "./analysis-readiness";

vi.mock("@/lib/api/queries", () => ({ useDatasetsQuery: vi.fn() }));
afterEach(cleanup);

type Status = "acquired" | "missing" | "remote_window";

/** Invented list shaped like the registry: what each module's `required_by` pulls in matters here. */
function registry(terrainStatuses: [Status, Status] = ["acquired", "remote_window"]) {
  const entry = (id: string, category: string, required_by: string[], status: Status) => ({
    id,
    title: `Title of ${id}`,
    category,
    required_by,
    local: { status },
  });
  return {
    datasets: [
      entry("lola-240m", "terrain", ["terrain", "illumination", "visibility"], terrainStatuses[0]),
      entry("naif-kernels", "ephemeris", ["geometry", "illumination", "visibility"], "acquired"),
      entry("moon-kit", "visualization", ["visualization"], "missing"),
      entry("pgda-20m", "terrain", ["terrain"], terrainStatuses[1]),
    ],
  };
}

function renderPanel(data: unknown) {
  vi.mocked(useDatasetsQuery).mockReturnValue({ data, isError: false } as never);
  render(<AnalysisReadiness />);
}

/** The tags shown under one module's title. */
function tagsUnder(moduleTitle: string): string[] {
  const row = screen.getByText(moduleTitle).closest("li")!;
  return within(row)
    .queryAllByTestId("readiness-input")
    .map((el) => el.textContent ?? "");
}

describe("AnalysisReadiness input tags", () => {
  it("shows 'terrain' once under Terrain Intelligence, not 'terrain, terrain'", () => {
    renderPanel(registry());
    expect(tagsUnder("Terrain Intelligence")).toEqual(["terrain"]);
  });

  it("shows each kind of input once under Mission Intelligence, not 'terrain, ephemeris, terrain'", () => {
    renderPanel(registry());
    expect(tagsUnder("Mission Intelligence")).toEqual(["terrain", "ephemeris"]);
  });

  it("marks a merged tag with its less ready dataset and lists both datasets in its tooltip", () => {
    renderPanel(registry(["acquired", "missing"]));
    const row = screen.getByText("Terrain Intelligence").closest("li")!;
    const tag = within(row).getByTestId("readiness-input");
    expect(tag.getAttribute("data-status")).toBe("missing");
    expect(tag.getAttribute("title")).toBe("Title of lola-240m — Acquired\nTitle of pgda-20m — Missing");
  });

  it("does not list the visualization dataset under any module", () => {
    renderPanel(registry());
    expect(screen.queryByText("visualization")).toBeNull();
  });
});

describe("AnalysisReadiness milestone chips", () => {
  it("keeps the roadmap's milestone ids and names the milestone on hover", () => {
    renderPanel(registry());
    const illumination = screen.getByTestId("readiness-illumination");
    const visibility = screen.getByTestId("readiness-visibility");
    const analysis = screen.getByTestId("readiness-analysis");
    // Illumination and Earth visibility share a milestone in docs/ROADMAP.md, so they share a label.
    expect(illumination.textContent).toBe("M04 · available");
    expect(visibility.textContent).toBe("M04 · available");
    expect(analysis.textContent).toBe("M05 · available");
    expect(illumination.getAttribute("title")).toContain("Milestone M04: Illumination and Earth visibility");
    expect(analysis.getAttribute("title")).toContain("Milestone M05: Mission intelligence");
    // The chip still says where the module's output appears.
    expect(illumination.getAttribute("title")).toContain("Illumination lane");
  });
});
