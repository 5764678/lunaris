// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LanguageSwitch } from "@/components/shell/language-switch";
import { NAV_ITEMS } from "@/lib/modules";

import { LanguageSync } from "./use-language";
import { LANGUAGE_STORAGE_KEY, resetLanguageForTests, setLanguage } from "./language-store";
import { CATALOGUE, DEFAULT_LANGUAGE } from "./messages";

beforeEach(() => {
  window.localStorage.clear();
  resetLanguageForTests();
  document.documentElement.lang = "th";
});
afterEach(cleanup);

function leaves(value: unknown, path = ""): string[] {
  if (typeof value === "string") return [path];
  if (typeof value === "function") return [path];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
}

describe("catalogue", () => {
  it("is Thai by default", () => {
    expect(DEFAULT_LANGUAGE).toBe("th");
  });

  it("has the same keys in Thai and English, and no empty message", () => {
    expect(leaves(CATALOGUE.en)).toEqual(leaves(CATALOGUE.th));
    for (const lang of ["th", "en"] as const) {
      for (const path of leaves(CATALOGUE[lang])) {
        const value = path
          .split(".")
          .slice(1)
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], CATALOGUE[lang]);
        if (typeof value === "string") expect(value.trim(), `${lang}${path}`).not.toBe("");
      }
    }
  });

  it("has text for every navigation item in both languages", () => {
    for (const item of NAV_ITEMS) {
      for (const lang of ["th", "en"] as const) {
        const text = CATALOGUE[lang].nav[item.id];
        expect(text.title).toBeTruthy();
        expect(text.shortTitle).toBeTruthy();
        expect(text.description).toBeTruthy();
      }
    }
  });
});

describe("language switch", () => {
  it("starts in Thai, switches to English, remembers it and sets <html lang>", () => {
    render(
      <>
        <LanguageSync />
        <LanguageSwitch />
      </>,
    );
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-label")).toBe("ภาษา");
    expect(screen.getByTestId("lang-th").getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.lang).toBe("th");

    act(() => screen.getByTestId("lang-en").click());

    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("Language");
    expect(screen.getByTestId("lang-en").getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.lang).toBe("en");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });

  it("ignores a stored value that is not a language", () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    render(<LanguageSwitch />);
    expect(screen.getByTestId("lang-th").getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the choice in memory when storage throws", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      render(<LanguageSwitch />);
      act(() => setLanguage("en"));
      expect(screen.getByTestId("lang-en").getAttribute("aria-pressed")).toBe("true");
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
