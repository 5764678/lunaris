"use client";

import { useEffect } from "react";

import { useSitesQuery } from "@/lib/api/queries";
import { useMissionStore } from "@/store/mission-store";

import { pickDefaultSite } from "./default-site";

/**
 * Selects a cited demo site the first time the registry has sites, so the first screen shows a
 * site with its numbers and the camera already flying to it. It waits while the registry is
 * empty, so adding the demo sites for the first time selects one too. After that it never
 * selects again: a visitor who deselects the site keeps an empty selection.
 */
export function useDefaultSite() {
  const sites = useSitesQuery().data?.sites;
  const applied = useMissionStore((s) => s.defaultSiteApplied);
  const applyDefaultSite = useMissionStore((s) => s.applyDefaultSite);

  useEffect(() => {
    if (applied || !sites || sites.length === 0) return;
    applyDefaultSite(pickDefaultSite(sites));
  }, [applied, sites, applyDefaultSite]);
}
