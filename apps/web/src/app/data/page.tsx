import type { Metadata } from "next";

import { DatasetRegistry, RuntimeTable } from "@/components/data/dataset-registry";

export const metadata: Metadata = { title: "Data sources" };

export default function DataSourcesPage() {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <header className="space-y-2">
          <p className="label-caps">Data sources · where the numbers come from</p>
          <h1 className="text-lg font-medium text-foreground">Dataset registry</h1>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground" data-testid="data-intro">
            Every dataset LUNARIS uses is listed here with who produced it, how to cite it, its map projection
            and resolution, and where to download it. The status beside each one says how the app gets it:
            Acquired (stored on the server), Remote (read from NASA when needed) or In web app (the Moon image
            the globe shows). Each file&apos;s checksum is recorded when it is downloaded. Files without a
            record are marked untracked and are never used.
          </p>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            <span className="label-caps mr-1.5">For developers</span>
            Datasets are downloaded with{" "}
            <code className="font-mono text-foreground">uv run lunaris-data acquire &lt;id&gt;</code>, which
            records the URL, size, SHA-256 and retrieval time in an acquisition record.
          </p>
        </header>
        <DatasetRegistry />
        <RuntimeTable />
      </div>
    </div>
  );
}
