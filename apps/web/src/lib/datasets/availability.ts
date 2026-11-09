import type { DatasetStatus, DatasetSummary } from "@lunaris/shared-types";

/**
 * What "ready" means for the top-bar data chip: the application can use the dataset now.
 * A dataset does not have to be downloaded to the server to be ready; it can also be read
 * from NASA's server on demand, or be a picture the web app itself ships.
 */

/** The part of a dataset these functions look at (a `DatasetSummary` fits). */
export interface DatasetLike {
  id: string;
  title: string;
  category: DatasetSummary["category"];
  local: { status: DatasetStatus };
}

/** Why a dataset cannot be used: the server's own status for it. */
export type NotReadyStatus = Exclude<DatasetStatus, "acquired" | "remote_window">;

export type DatasetAvailability =
  /** Downloaded to the server; every file matches its download record. */
  | { kind: "stored" }
  /** Read from NASA's server in small windows when needed; never downloaded whole. */
  | { kind: "streamed" }
  /** The web app ships a picture built from this dataset (the globe surface). */
  | { kind: "web-texture" }
  | { kind: "unavailable"; status: NotReadyStatus };

/**
 * `shippedTextureIds` are the datasets the web app ships a texture for (from the texture
 * manifest). Only a visualization dataset can be satisfied that way: a picture cannot
 * stand in for terrain or ephemeris data.
 */
export function datasetAvailability(
  dataset: DatasetLike,
  shippedTextureIds: ReadonlySet<string>,
): DatasetAvailability {
  const { status } = dataset.local;
  if (status === "acquired") return { kind: "stored" };
  if (status === "remote_window") return { kind: "streamed" };
  if (dataset.category === "visualization" && shippedTextureIds.has(dataset.id)) {
    return { kind: "web-texture" };
  }
  return { kind: "unavailable", status };
}

export interface DataSummary {
  total: number;
  ready: number;
  stored: number;
  streamed: number;
  textures: number;
  notReady: { id: string; title: string; status: NotReadyStatus }[];
}

export function summarizeDatasets(
  datasets: readonly DatasetLike[],
  shippedTextureIds: ReadonlySet<string>,
): DataSummary {
  const summary: DataSummary = {
    total: datasets.length,
    ready: 0,
    stored: 0,
    streamed: 0,
    textures: 0,
    notReady: [],
  };
  for (const dataset of datasets) {
    const availability = datasetAvailability(dataset, shippedTextureIds);
    switch (availability.kind) {
      case "stored":
        summary.stored += 1;
        break;
      case "streamed":
        summary.streamed += 1;
        break;
      case "web-texture":
        summary.textures += 1;
        break;
      case "unavailable":
        summary.notReady.push({ id: dataset.id, title: dataset.title, status: availability.status });
        break;
    }
  }
  summary.ready = summary.stored + summary.streamed + summary.textures;
  return summary;
}

const NOT_READY_REASON: Record<NotReadyStatus, string> = {
  missing: "not downloaded on the server",
  untracked: "files found without a download record, so not used",
  incomplete: "download incomplete",
};

/** The chip's tooltip as plain sentences: a headline, where the ready data lives, what is not ready. */
export function describeDataSummary(summary: DataSummary): {
  headline: string;
  where: string[];
  notReady: string[];
} {
  const where: string[] = [];
  if (summary.stored > 0) where.push(`${summary.stored} stored on the server`);
  if (summary.streamed > 0) where.push(`${summary.streamed} streamed from NASA when needed`);
  if (summary.textures > 0) {
    where.push(
      `${summary.textures} ${summary.textures === 1 ? "texture" : "textures"} shipped with the web app`,
    );
  }
  return {
    headline:
      summary.total > 0 && summary.ready === summary.total
        ? `All ${summary.total} datasets ready.`
        : `${summary.ready} of ${summary.total} datasets ready.`,
    where,
    notReady: summary.notReady.map((d) => `${d.title}: ${NOT_READY_REASON[d.status]}`),
  };
}
