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
  /** "available" once the module's computation is served and shown somewhere in the UI. */
  status?: "planned" | "available";
  /** Where an available module's output appears. */
  availableIn?: string;
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
    status: "available",
    availableIn: "South-pole terrain scene (Overview) and height/slope/roughness in Site comparison.",
  },
  {
    id: "geometry",
    title: "Celestial Geometry",
    description: "Sun and Earth azimuth/elevation from SPICE ephemerides.",
    milestone: "M03",
    icon: Orbit,
    status: "available",
    availableIn: "Sun/Earth elevation lanes in the timeline (select a site).",
  },
  {
    id: "illumination",
    title: "Illumination",
    description: "Geometric and terrain-aware solar illumination timelines.",
    milestone: "M04",
    icon: Sun,
    status: "available",
    availableIn: "Illumination lane, terrain-scene site value and Site comparison.",
  },
  {
    id: "visibility",
    title: "Earth Visibility",
    description: "Geometric and terrain-obstructed direct-to-Earth line of sight.",
    milestone: "M04",
    icon: Earth,
    status: "available",
    availableIn: "Earth line-of-sight lane and Site comparison (geometric; not a radio link).",
  },
  {
    id: "analysis",
    title: "Mission Intelligence",
    description: "Site comparison with per-value evidence (constraints, scoring and reports later).",
    milestone: "M05",
    icon: Scale,
    href: "/compare",
    status: "available",
    availableIn: "Site comparison table with per-value evidence. No scoring or ranking yet.",
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
