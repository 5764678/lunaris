import type { Metadata } from "next";

import { DatasetRegistry, RuntimeTable } from "@/components/data/dataset-registry";

export const metadata: Metadata = { title: "Data sources" };

export default function DataSourcesPage() {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <header className="space-y-2">
          <p className="label-caps">Data sources · provenance</p>
          <h1 className="text-lg font-medium text-foreground">Dataset registry</h1>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Every dataset LUNARIS uses is described by a version-controlled manifest: archive, citation,
            frame, projection, resolution and download URLs. Nothing here is bundled with the application.
            Datasets are acquired reproducibly with{" "}
            <code className="font-mono text-foreground">uv run lunaris-data acquire &lt;id&gt;</code>, which
            records URL, size, SHA-256 and retrieval time in an acquisition record. Files without a record are
            reported as untracked and are never used.
          </p>
        </header>
        <DatasetRegistry />
        <RuntimeTable />
      </div>
    </div>
  );
}
