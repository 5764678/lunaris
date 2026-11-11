import { describe, expect, it } from "vitest";

import { formatSpan, nextVisibilityEvent, type VisibilityWindow } from "./events";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 10);
const iso = (ms: number) => new Date(ms).toISOString();
const win = (
  startDay: number,
  endDay: number,
  censored_start = false,
  censored_end = false,
): VisibilityWindow => ({
  start_utc: iso(T0 + startDay * DAY),
  end_utc: iso(T0 + endDay * DAY),
  duration_s: ((endDay - startDay) * DAY) / 1000,
  censored_start,
  censored_end,
});
const END = T0 + 30 * DAY;

describe("nextVisibilityEvent", () => {
  it("says the body sets when the moment sits inside a window that ends", () => {
    const e = nextVisibilityEvent([win(0, 4), win(6, 10)], T0 + 1 * DAY, T0, END);
    expect(e?.state).toBe("up");
    expect(e?.change).toEqual({ kind: "set", atMs: T0 + 4 * DAY, inMs: 3 * DAY });
  });

  it("says the body rises at the next window's start when the moment is between windows", () => {
    const e = nextVisibilityEvent([win(0, 4), win(6, 10)], T0 + 5 * DAY, T0, END);
    expect(e?.state).toBe("down");
    expect(e?.change).toEqual({ kind: "rise", atMs: T0 + 6 * DAY, inMs: DAY });
  });

  it("reports no change for a window that runs to the end of the period", () => {
    const e = nextVisibilityEvent([win(0, 30, true, true)], T0 + 2 * DAY, T0, END);
    expect(e?.state).toBe("up");
    expect(e?.change).toBeNull();
  });

  it("reports no change when it stays down for the rest of the period", () => {
    const e = nextVisibilityEvent([win(0, 4)], T0 + 5 * DAY, T0, END);
    expect(e?.state).toBe("down");
    expect(e?.change).toBeNull();
  });

  it("treats no windows at all as down for the whole period", () => {
    expect(nextVisibilityEvent([], T0 + DAY, T0, END)).toMatchObject({ state: "down", change: null });
  });

  it("says nothing for a moment outside the analysed period", () => {
    expect(nextVisibilityEvent([win(0, 4)], T0 - DAY, T0, END)).toBeNull();
    expect(nextVisibilityEvent([win(0, 4)], END + DAY, T0, END)).toBeNull();
  });
});

describe("formatSpan", () => {
  it("uses the two biggest units", () => {
    expect(formatSpan(3 * DAY + 4 * 3_600_000 + 20 * 60_000)).toBe("3 d 4 h");
    expect(formatSpan(5 * 3_600_000 + 20 * 60_000)).toBe("5 h 20 min");
    expect(formatSpan(40 * 60_000)).toBe("40 min");
    expect(formatSpan(0)).toBe("0 min");
  });
});
