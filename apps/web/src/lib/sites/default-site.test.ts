import type { CandidateSite } from "@lunaris/shared-types";
import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_NAME, pickDefaultSite } from "./default-site";

const site = (id: string, name: string, origin: CandidateSite["origin"] = "published") =>
  ({ id, name, origin }) as CandidateSite;

describe("pickDefaultSite", () => {
  it("prefers the best-known cited site, whatever its place in the list", () => {
    const sites = [site("a", "Connecting ridge"), site("b", "Malapert massif"), site("c", DEFAULT_SITE_NAME)];
    expect(pickDefaultSite(sites)).toBe("c");
    expect(pickDefaultSite([site("c", "PEAK NEAR SHACKLETON"), site("a", "Connecting ridge")])).toBe("c");
  });

  it("falls back to the first cited site", () => {
    expect(pickDefaultSite([site("a", "Connecting ridge"), site("b", "Malapert massif")])).toBe("a");
  });

  it("never picks a site the visitor typed in", () => {
    expect(pickDefaultSite([site("u", DEFAULT_SITE_NAME, "user_defined")])).toBeNull();
    expect(pickDefaultSite([site("u", "My site", "user_defined"), site("a", "Connecting ridge")])).toBe("a");
  });

  it("returns null when there are no sites", () => {
    expect(pickDefaultSite([])).toBeNull();
  });
});
