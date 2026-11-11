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

/**
 * Navigation: every item is a real page. Pages whose content another session is still
 * building show an explicit "in progress" page, never a fake view.
 */
export interface NavItem {
  id: string;
  title: string;
  /** Label under the icon where the full title does not fit (narrow screens, small laptops). */
  shortTitle: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "overview",
    title: "Overview",
    shortTitle: "Overview",
    description: "Lunar globe and south-pole terrain, candidate sites, timeline and system status.",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    id: "illumination",
    title: "Illumination & Earth",
    shortTitle: "Sun/Earth",
    description: "Sun and Earth geometry, illumination and direct-to-Earth line of sight per site.",
    href: "/illumination",
    icon: Sun,
  },
  {
    id: "terrain",
    title: "Terrain",
    shortTitle: "Terrain",
    description: "LOLA elevation, slope, bumpiness and horizon per site.",
    href: "/terrain",
    icon: Mountain,
  },
  {
    id: "compare",
    title: "Compare",
    shortTitle: "Compare",
    description: "Side-by-side site comparison; every value opens its evidence.",
    href: "/compare",
    icon: Scale,
  },
  {
    id: "data",
    title: "Data Sources",
    shortTitle: "Data",
    description: "Dataset registry, provenance and acquisition status.",
    href: "/data",
    icon: Database,
  },
  {
    id: "about",
    title: "About",
    shortTitle: "About",
    description: "What LUNARIS is, who it is for, how it was built, and a glossary.",
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
