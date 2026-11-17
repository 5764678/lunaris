import type { Messages } from "./th";

/** English messages. Same shape as `th.ts`; the compiler enforces it. */
export const en: Messages = {
  language: {
    label: "Language",
    th: "ไทย",
    en: "English",
    switchTo: "Switch to Thai",
  },
  shell: {
    homeLabel: "LUNARIS home",
    tagline: "Compare lunar south-pole landing sites by sunlight, Earth contact and terrain",
    modulesLabel: "Modules",
    scopeHeading: "Scope",
    scopeNote: "Preliminary mission-planning and research tool. Not a certified spacecraft landing system.",
  },
  nav: {
    learn: {
      title: "Learn",
      shortTitle: "Learn",
      description: "A six-period unit: Moon phases, the lunar south pole, and choosing a landing site.",
    },
    overview: {
      title: "Overview",
      shortTitle: "Overview",
      description: "Lunar globe and south-pole terrain, candidate sites, timeline and system status.",
    },
    illumination: {
      title: "Illumination & Earth",
      shortTitle: "Sun/Earth",
      description: "Sun and Earth geometry, illumination and direct-to-Earth line of sight per site.",
    },
    terrain: {
      title: "Terrain",
      shortTitle: "Terrain",
      description: "LOLA elevation, slope, bumpiness and horizon per site.",
    },
    compare: {
      title: "Compare",
      shortTitle: "Compare",
      description: "Side-by-side site comparison; every value opens its evidence.",
    },
    data: {
      title: "Data Sources",
      shortTitle: "Data",
      description: "Dataset registry, provenance and acquisition status.",
    },
    about: {
      title: "About",
      shortTitle: "About",
      description: "What LUNARIS is, who it is for, how it was built, and a glossary.",
    },
  },
};
