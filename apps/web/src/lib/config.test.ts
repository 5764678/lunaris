import { describe, expect, it } from "vitest";

import { config, normalizeBaseUrl } from "./config";

describe("normalizeBaseUrl", () => {
  it("trims, removes trailing slashes and falls back", () => {
    expect(normalizeBaseUrl(" https://example.org/// ")).toBe("https://example.org");
    expect(normalizeBaseUrl(undefined)).toBe("http://localhost:8000");
    expect(normalizeBaseUrl("", "https://fallback.example")).toBe("https://fallback.example");
  });
});

describe("config.siteUrl", () => {
  it("is an absolute URL without a trailing slash (needed for link-preview image URLs)", () => {
    expect(config.siteUrl).toMatch(/^https?:\/\/[^/]+$/);
    expect(() => new URL(config.siteUrl)).not.toThrow();
  });
});
