import type { DatasetStatus, DatasetSummary } from "@lunaris/shared-types";

/** The part of a dataset the readiness tags look at (a `DatasetSummary` fits). */
type DatasetInput = Pick<DatasetSummary, "id" | "title" | "category"> & {
  local: { status: DatasetStatus };
};

/** One tag under a module in Analysis readiness: a kind of input data and whether it is usable. */
export interface InputTag {
  /** The dataset category shown as the tag, e.g. "terrain" or "ephemeris". */
  category: string;
  /** The least ready status among this category's datasets, so one usable dataset never hides a missing one. */
  status: DatasetStatus;
  datasets: { id: string; title: string; status: DatasetStatus }[];
}

/** Higher is less ready, and louder: a broken download, then unknown provenance, then simply absent. */
const ATTENTION: Record<DatasetStatus, number> = {
  acquired: 0,
  remote_window: 0,
  missing: 1,
  untracked: 2,
  incomplete: 3,
};

/**
 * One tag per category, in the order each category first appears. Two terrain datasets (the
 * 240 m and the 20 m DEM) used to give "terrain, terrain"; they now give one "terrain" tag that
 * shows the less ready of the two and lists both when hovered.
 */
export function inputTags(datasets: readonly DatasetInput[]): InputTag[] {
  const byCategory = new Map<string, InputTag>();
  for (const dataset of datasets) {
    const status = dataset.local.status;
    const entry = { id: dataset.id, title: dataset.title, status };
    const tag = byCategory.get(dataset.category);
    if (!tag) {
      byCategory.set(dataset.category, { category: dataset.category, status, datasets: [entry] });
      continue;
    }
    tag.datasets.push(entry);
    if (ATTENTION[status] > ATTENTION[tag.status]) tag.status = status;
  }
  return [...byCategory.values()];
}
