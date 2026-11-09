import { describe, expect, it } from "vitest";

import { inputTags } from "./inputs";

type Status = "acquired" | "missing" | "untracked" | "incomplete" | "remote_window";

const dataset = (id: string, category: string, status: Status) => ({
  id,
  title: `Title of ${id}`,
  category: category as "terrain",
  local: { status },
});

describe("inputTags", () => {
  it("gives one tag per category: two terrain datasets no longer read 'terrain, terrain'", () => {
    // Registry order of the datasets Mission Intelligence depends on.
    const tags = inputTags([
      dataset("lola-240m", "terrain", "acquired"),
      dataset("naif-kernels", "ephemeris", "acquired"),
      dataset("pgda-20m", "terrain", "remote_window"),
    ]);
    expect(tags.map((t) => t.category)).toEqual(["terrain", "ephemeris"]);
    expect(tags[0].datasets.map((d) => d.id)).toEqual(["lola-240m", "pgda-20m"]);
  });

  it("shows the least ready status, so a usable dataset never hides a missing one", () => {
    const [terrain] = inputTags([dataset("a", "terrain", "acquired"), dataset("b", "terrain", "missing")]);
    expect(terrain.status).toBe("missing");
    // Order of the inputs does not change the outcome.
    const [reversed] = inputTags([dataset("b", "terrain", "missing"), dataset("a", "terrain", "acquired")]);
    expect(reversed.status).toBe("missing");
  });

  it("ranks a broken download above unknown provenance above an absent dataset", () => {
    const status = (...list: Status[]) =>
      inputTags(list.map((s, i) => dataset(`d${i}`, "terrain", s)))[0].status;
    expect(status("missing", "untracked")).toBe("untracked");
    expect(status("untracked", "incomplete", "missing")).toBe("incomplete");
    expect(status("acquired", "remote_window")).toBe("acquired");
  });

  it("returns nothing for no inputs", () => {
    expect(inputTags([])).toEqual([]);
  });
});
