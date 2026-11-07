// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HorizontalScroll, scrollState } from "./horizontal-scroll";

describe("scrollState", () => {
  it("fits when nothing is hidden, or less than a pixel is", () => {
    expect(scrollState({ scrollLeft: 0, scrollWidth: 800, clientWidth: 800 })).toBe("fits");
    expect(scrollState({ scrollLeft: 0, scrollWidth: 800.6, clientWidth: 800 })).toBe("fits");
  });

  it("has more to the right while columns are hidden", () => {
    expect(scrollState({ scrollLeft: 0, scrollWidth: 1365, clientWidth: 1166 })).toBe("more");
    expect(scrollState({ scrollLeft: 120, scrollWidth: 1365, clientWidth: 1166 })).toBe("more");
  });

  it("is at the end within a pixel of the far edge", () => {
    expect(scrollState({ scrollLeft: 199, scrollWidth: 1365, clientWidth: 1166 })).toBe("end");
    expect(scrollState({ scrollLeft: 198.4, scrollWidth: 1365, clientWidth: 1166 })).toBe("end");
  });
});

describe("HorizontalScroll", () => {
  // jsdom has no layout and no ResizeObserver: record the callbacks and set the sizes by hand.
  let measureAll: () => void;

  beforeEach(() => {
    const callbacks: (() => void)[] = [];
    measureAll = () => act(() => callbacks.forEach((callback) => callback()));
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          callbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderBox({ scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
    render(
      <HorizontalScroll label="Comparison table (scrolls sideways)" testId="box">
        <table>
          <tbody>
            <tr>
              <td>cell</td>
            </tr>
          </tbody>
        </table>
      </HorizontalScroll>,
    );
    const box = screen.getByRole("region", { name: "Comparison table (scrolls sideways)" });
    Object.defineProperty(box, "scrollWidth", { configurable: true, value: scrollWidth });
    Object.defineProperty(box, "clientWidth", { configurable: true, value: clientWidth });
    measureAll();
    return box;
  }

  function scrollTo(box: HTMLElement, scrollLeft: number) {
    Object.defineProperty(box, "scrollLeft", { configurable: true, writable: true, value: scrollLeft });
    fireEvent.scroll(box);
  }

  it("is a named region that the keyboard can reach", () => {
    const box = renderBox({ scrollWidth: 1365, clientWidth: 1166 });
    expect(box.tabIndex).toBe(0);
  });

  it("shows nothing extra when everything fits", () => {
    const box = renderBox({ scrollWidth: 1200, clientWidth: 1200 });
    expect(box.getAttribute("data-scroll-state")).toBe("fits");
    expect(screen.queryByRole("button", { name: /more columns/i })).toBeNull();
  });

  it("offers 'More columns' while columns are hidden on the right", () => {
    const box = renderBox({ scrollWidth: 1365, clientWidth: 1166 });
    expect(box.getAttribute("data-scroll-state")).toBe("more");
    expect(screen.getByRole("button", { name: /more columns/i })).toBeTruthy();
  });

  it("hides the button at the far end but keeps its row, so the table does not jump", () => {
    const box = renderBox({ scrollWidth: 1365, clientWidth: 1166 });
    scrollTo(box, 199);
    expect(box.getAttribute("data-scroll-state")).toBe("end");
    // "invisible" keeps the space and removes the button from the tab order and the accessibility tree.
    expect(screen.getByTestId("box-more").className).toContain("invisible");
  });

  it("brings the button back when you scroll away from the end", () => {
    const box = renderBox({ scrollWidth: 1365, clientWidth: 1166 });
    scrollTo(box, 199);
    scrollTo(box, 50);
    expect(box.getAttribute("data-scroll-state")).toBe("more");
    expect(screen.getByTestId("box-more").className).not.toContain("invisible");
  });

  it("scrolls most of a screenful when the button is pressed", () => {
    const box = renderBox({ scrollWidth: 1365, clientWidth: 1166 });
    const scrollBy = vi.fn();
    box.scrollBy = scrollBy;
    fireEvent.click(screen.getByRole("button", { name: /more columns/i }));
    expect(scrollBy).toHaveBeenCalledTimes(1);
    const arg = scrollBy.mock.calls[0][0] as { left: number; behavior: string };
    expect(arg.left).toBeCloseTo(1166 * 0.7);
    expect(arg.behavior).toBe("smooth");
  });

  it("does not animate when the visitor asks for reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const box = renderBox({ scrollWidth: 1365, clientWidth: 1166 });
    const scrollBy = vi.fn();
    box.scrollBy = scrollBy;
    fireEvent.click(screen.getByRole("button", { name: /more columns/i }));
    expect((scrollBy.mock.calls[0][0] as { behavior: string }).behavior).toBe("auto");
  });

  it("keeps keyboard focus in the region when the focused button hides at the far end", () => {
    const box = renderBox({ scrollWidth: 1365, clientWidth: 1166 });
    const button = screen.getByRole("button", { name: /more columns/i });
    button.focus();
    expect(document.activeElement).toBe(button);
    scrollTo(box, 199);
    expect(document.activeElement).toBe(box);
  });
});
