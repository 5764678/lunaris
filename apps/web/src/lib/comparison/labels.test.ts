import { describe, expect, it } from "vitest";

import { calendarYearOf, formatDateUtc, formatPeriodUtc, metricCopy, metricTitle } from "./labels";

describe("metricCopy", () => {
  it("gives the plain name and explanation for a known column", () => {
    const copy = metricCopy("sun_mean_visible_disk_fraction", "Sun: mean visible disk", "api text");
    expect(copy.label).toBe("Sunlit, average");
    expect(copy.tip).toContain("average share of the Sun's disk");
  });

  it("uses one name per metric, with no developer wording", () => {
    for (const key of [
      "slope_p95_deg",
      "roughness_rms_m",
      "sun_illuminated_fraction",
      "sun_longest_hidden_s",
      "sun_longest_visible_s",
      "earth_visible_fraction",
      "earth_longest_outage_s",
    ]) {
      const { label, tip } = metricCopy(key, "api", "api");
      expect(label).not.toMatch(/p95|LOS|footprint|illuminated|outage:|visible disk/i);
      expect(tip).not.toMatch(/\bLOS\b|DEM|SPICE|HTTP/);
    }
  });

  it("says Earth visibility is geometry only", () => {
    expect(metricCopy("earth_visible_fraction", "x").tip).toMatch(/does not promise a working radio link/);
  });

  it("warns that a run touching the window edge is a minimum", () => {
    expect(metricCopy("sun_longest_hidden_s", "x").tip).toMatch(/treat it as a minimum/);
    expect(metricCopy("sun_longest_visible_s", "x").tip).toMatch(/treat it as a minimum/);
    expect(metricCopy("earth_longest_outage_s", "x").tip).toMatch(/treat it as a minimum/);
  });

  it("falls back to the API's own text for an unknown column", () => {
    expect(metricCopy("brand_new_column", "Brand new", "From the API.")).toEqual({
      label: "Brand new",
      tip: "From the API.",
    });
    expect(metricCopy("brand_new_column", "Brand new")).toEqual({ label: "Brand new", tip: "" });
  });
});

describe("metricTitle", () => {
  it("adds the API's technical description after the plain one", () => {
    const title = metricTitle("slope_p95_deg", "Slope p95 (footprint)", "95th-percentile Horn slope.");
    expect(title).toMatch(/^Within the footprint/);
    expect(title).toMatch(/\(Technical: 95th-percentile Horn slope\.\)$/);
  });

  it("does not repeat identical text", () => {
    expect(metricTitle("brand_new_column", "Brand new", "Same.")).toBe("Same.");
  });
});

describe("dates", () => {
  it("formats an ISO UTC timestamp as a day, month and year", () => {
    expect(formatDateUtc("2027-01-01T00:00:00Z")).toBe("1 Jan 2027");
    expect(formatDateUtc("2027-12-31T23:59:59Z")).toBe("31 Dec 2027");
  });

  it("keeps the input when it is not a date", () => {
    expect(formatDateUtc("soon")).toBe("soon");
  });

  it("formats a period", () => {
    expect(formatPeriodUtc("2027-01-01T00:00:00Z", "2028-01-01T00:00:00Z")).toBe(
      "1 Jan 2027 to 1 Jan 2028 (UTC)",
    );
  });
});

describe("calendarYearOf", () => {
  it("names the year when the dates are exactly one calendar year (UTC)", () => {
    expect(calendarYearOf("2027-01-01T00:00:00Z", "2028-01-01T00:00:00Z")).toBe(2027);
    expect(calendarYearOf("2028-01-01T00:00:00+00:00", "2029-01-01T00:00:00Z")).toBe(2028);
  });

  it("is null for any other stretch of time, so a row never claims a year it does not cover", () => {
    expect(calendarYearOf("2027-01-01T00:00:00Z", "2027-07-01T00:00:00Z")).toBeNull();
    expect(calendarYearOf("2027-01-01T00:00:00Z", "2029-01-01T00:00:00Z")).toBeNull();
    expect(calendarYearOf("2027-03-01T00:00:00Z", "2028-03-01T00:00:00Z")).toBeNull();
    expect(calendarYearOf("2027-01-01T00:00:00Z", "2028-01-01T00:00:01Z")).toBeNull();
  });

  it("is null for something that is not a date", () => {
    expect(calendarYearOf("soon", "later")).toBeNull();
  });
});
