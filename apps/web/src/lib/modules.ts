import { Database, Earth, LayoutDashboard, Mountain, Orbit, Scale, Sun, type LucideIcon } from "lucide-react";

/**
 * LUNARIS MISSION modules and their delivery milestones. Mirrors docs/ROADMAP.md.
 * Planned modules are shown in the navigation as disabled, with their milestone, so the
 * UI never implies a capability that does not exist yet.
 */
export interface MissionModule {
  id: string;
  title: string;
  description: string;
  milestone: string;
  icon: LucideIcon;
  /** Present only for modules with a working view. */
  href?: string;
}

export const MISSION_MODULES: readonly MissionModule[] = [
  {
    id: "overview",
    title: "Mission Overview",
    description: "Lunar globe, candidate sites, timeline and system status.",
    milestone: "M01",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    id: "terrain",
    title: "Terrain Intelligence",
    description: "LOLA elevation, slope, roughness and hazard indicators.",
    milestone: "M02",
    icon: Mountain,
  },
  {
    id: "geometry",
    title: "Celestial Geometry",
    description: "Sun and Earth azimuth/elevation from SPICE ephemerides.",
    milestone: "M03",
    icon: Orbit,
  },
  {
    id: "illumination",
    title: "Illumination",
    description: "Geometric and terrain-aware solar illumination timelines.",
    milestone: "M04",
    icon: Sun,
  },
  {
    id: "visibility",
    title: "Earth Visibility",
    description: "Geometric and terrain-obstructed direct-to-Earth line of sight.",
    milestone: "M04",
    icon: Earth,
  },
  {
    id: "analysis",
    title: "Mission Intelligence",
    description: "Constraints, scoring, site comparison and reports.",
    milestone: "M05",
    icon: Scale,
  },
  {
    id: "data",
    title: "Data Sources",
    description: "Dataset registry, provenance and acquisition status.",
    milestone: "M01",
    icon: Database,
    href: "/data",
  },
];
