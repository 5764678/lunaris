import type { IsoDate, IsoUtcTimestamp, LunarFrame, Sha256Hex } from "./conventions";

export type { Evidence, EvidenceKind, SourceReference } from "./api";

/**
 * Provenance of a dataset as acquired into the local store. Mirrors the dataset
 * manifest (packages/data/src/lunaris_data/manifests) joined with its acquisition record.
 *
 * The implemented wire form is `DatasetSummary` (see ./api). This interface is the
 * condensed form embedded in analysis results so every result names the exact bytes
 * it was computed from.
 */
export interface DatasetProvenance {
  dataset_id: string;
  title: string;
  provider: string;
  mission: string | null;
  instrument: string | null;
  /** Archive landing page for the product. */
  source_page: string;
  /** Exact file-level sources, with checksums recorded at acquisition. */
  files: DatasetFileProvenance[];
  frame: LunarFrame | null;
  projection: string | null;
  nominal_resolution_m: number | null;
  citation: string;
  usage: string;
  url_verification: { status: "unverified" | "verified"; checked_on: IsoDate | null };
  acquired_at_utc: IsoUtcTimestamp | null;
}

export interface DatasetFileProvenance {
  name: string;
  source_url: string;
  size_bytes: number;
  sha256: Sha256Hex;
  retrieved_at_utc: IsoUtcTimestamp;
}

/**
 * Software that produced a result (reproducibility). The implemented wire form of the
 * component list is `RuntimeReport` (see ./api).
 */
export interface SoftwareProvenance {
  service_version: string;
  components: { name: string; version: string | null }[];
}
