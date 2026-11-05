"use client";

import type { CandidateSite } from "@lunaris/shared-types";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";

/** What a catalogue reference point is (from the catalogue's own definition). */
export const TILE_CENTRE_NOTE = "Tile centre, not a landing point.";

/** CITED for sites added from the published catalogue; USER for user-entered coordinates. */
export function SiteOriginBadge({ site }: { site: CandidateSite }) {
  if (site.origin === "published") {
    return (
      <EvidenceBadge
        kind="derived_product"
        label="CITED"
        detail={`${site.reference ?? "Published catalogue."} ${TILE_CENTRE_NOTE}`}
      />
    );
  }
  return (
    <EvidenceBadge
      kind="assumption"
      label="USER"
      detail="Coordinates entered by a user; not curated or verified."
    />
  );
}
