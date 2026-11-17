import {
  Database,
  Earth,
  Info,
  LayoutDashboard,
  Mountain,
  Orbit,
  Scale,
  Sun,
  type LucideIcon,
} from "lucide-react";

import type { Messages } from "@/lib/i18n";

/**
 * Navigation: every item is a real page. Pages whose content another session is still
 * building show an explicit "in progress" page, never a fake view.
 */
export interface NavItem {
  /** Also the key of the item's text in the message catalogue: `t.nav[id]` has `title`,
   *  `shortTitle` (the label under the icon where the title does not fit) and `description`. */
  id: keyof Messages["nav"];
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    id: "illumination",
    href: "/illumination",
    icon: Sun,
  },
  {
    id: "terrain",
    href: "/terrain",
    icon: Mountain,
  },
  {
    id: "compare",
    href: "/compare",
    icon: Scale,
  },
  {
    id: "data",
    href: "/data",
    icon: Database,
  },
  {
    id: "about",
    href: "/about",
    icon: Info,
  },
];

/**
 * Analysis modules for the readiness panel, named as the roadmap's modules (the nav groups
 * them into pages: Celestial Geometry under Illumination & Earth, Mission Intelligence under
 * Compare). "available" only when the computation is
 * served by the API and shown somewhere in the UI (`availableIn` says where).
 */
export interface AnalysisModule {
  id: string;
  title: string;
  milestone: string;
  icon: LucideIcon;
  status: "planned" | "available";
  availableIn?: string;
  /** Dataset `required_by` keys whose local status the panel shows. */
  inputs: string[];
}

export const ANALYSIS_MODULES: readonly AnalysisModule[] = [
  {
    id: "terrain",
    title: "Terrain Intelligence",
    milestone: "M02",
    icon: Mountain,
    status: "available",
    availableIn: "South-pole terrain scene (Overview); height, slope, bumpiness and horizon in Compare.",
    inputs: ["terrain"],
  },
  {
    id: "geometry",
    title: "Celestial Geometry",
    milestone: "M03",
    icon: Orbit,
    status: "available",
    availableIn: "Sun/Earth elevation lanes and SPICE-lit terrain (Overview).",
    inputs: ["geometry"],
  },
  {
    id: "illumination",
    title: "Illumination",
    milestone: "M04",
    icon: Sun,
    status: "available",
    availableIn: "Illumination lane and terrain-scene site value (Overview); Compare.",
    inputs: ["illumination"],
  },
  {
    id: "visibility",
    title: "Earth Visibility",
    milestone: "M04",
    icon: Earth,
    status: "available",
    availableIn: "Earth line-of-sight lane (Overview); Compare. Geometric, not a radio link.",
    inputs: ["visibility"],
  },
  {
    id: "analysis",
    title: "Mission Intelligence",
    milestone: "M05",
    icon: Scale,
    status: "available",
    availableIn: "Compare: site comparison with per-value evidence. No scoring or ranking yet.",
    inputs: ["terrain", "geometry", "illumination", "visibility"],
  },
];
