// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DatasetAvailabilityPill } from "./dataset-status";

afterEach(cleanup);

const KIT = "nasa-svs-cgi-moon-kit";
const kit = (status: "missing" | "acquired" | "incomplete") => ({
  id: KIT,
  title: "Moon Kit",
  category: "visualization" as const,
  local: { status },
});

function pill(dataset: ReturnType<typeof kit>, shipped: string[]) {
  const { container } = render(
    <DatasetAvailabilityPill dataset={dataset} shippedTextureIds={new Set(shipped)} />,
  );
  return container.querySelector("[data-status]")!;
}

describe("DatasetAvailabilityPill", () => {
  it("reads 'In web app' instead of 'Missing' when the web app ships the texture", () => {
    const el = pill(kit("missing"), [KIT]);
    expect(el.textContent).toBe("In web app");
    expect(el.getAttribute("data-status")).toBe("web_texture");
    expect(el.getAttribute("title")).toContain("original download is not stored on the server");
  });

  it("keeps the server's own status when nothing is shipped", () => {
    expect(pill(kit("missing"), []).textContent).toBe("Missing");
    expect(pill(kit("incomplete"), []).textContent).toBe("Incomplete");
  });

  it("keeps 'Acquired' for a downloaded file, whether or not a texture is also shipped", () => {
    expect(pill(kit("acquired"), [KIT]).textContent).toBe("Acquired");
  });

  it("does not relabel a different dataset", () => {
    const dem = {
      id: "lola",
      title: "DEM",
      category: "terrain" as const,
      local: { status: "missing" as const },
    };
    const { container } = render(
      <DatasetAvailabilityPill dataset={dem} shippedTextureIds={new Set([KIT])} />,
    );
    expect(container.querySelector("[data-status]")?.textContent).toBe("Missing");
  });
});
