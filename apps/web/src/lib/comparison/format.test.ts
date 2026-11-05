import { describe, expect, it } from "vitest";

import type { CompareCell } from "@/lib/api/client";

import { formatBaseline, formatCellValue, formatDuration } from "./format";

const cell = (value: number | null, unit: string, baseline_m: number | null = null) =>
  ({
    value,
    unit,
    baseline_m,
    reason: value === null ? "why" : null,
    evidence: null,
    limitations: [],
  }) as CompareCell;

describe("formatCellValue", () => {
  it("formats each unit", () => {
    expect(formatCellValue(cell(1942.156, "m"))).toBe("1,942 m");
    expect(formatCellValue(cell(0.448, "m"))).toBe("0.45 m");
    expect(formatCellValue(cell(-3.3646, "deg"))).toBe("−3.36°");
    expect(formatCellValue(cell(0.8123, "fraction"))).toBe("81.2 %");
    expect(formatCellValue(cell(0, "fraction"))).toBe("0.0 %");
    expect(formatCellValue(cell(3 * 86_400, "s"))).toBe("3.0 d");
    expect(formatCellValue(cell(5400, "s"))).toBe("1.5 h");
    expect(formatCellValue(cell(12, "count"))).toBe("12");
  });

  it("returns null for a null value (the caller shows the reason, never 0)", () => {
    expect(formatCellValue(cell(null, "fraction"))).toBeNull();
  });
});

describe("formatBaseline / formatDuration", () => {
  it("shows a baseline only when present", () => {
    expect(formatBaseline(cell(5.4, "deg", 39.999))).toBe("@ 40 m");
    expect(formatBaseline(cell(5.4, "deg"))).toBeNull();
    expect(formatDuration(47 * 3600)).toBe("47.0 h");
  });
});
