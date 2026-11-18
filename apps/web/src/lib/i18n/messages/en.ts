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
  learn: {
    title: "Moon mission classroom",
    intro: "Six periods, from the phases of the Moon to choosing a landing site at the lunar south pole.",
    stepNavLabel: "Lesson steps",
    period: (n: number) => `Period ${n}`,
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    previous: "Previous step",
    next: "Next step",
    allSteps: "All steps",
    open: "Open",
    draftNote: "The Thai text is a draft waiting for the team and the advisor teacher to review.",
    steps: {
      p1: { phase: "Engage", title: "Why does the Moon change shape?" },
      p2: { phase: "Explore", title: "One lunation of phases" },
      p3: { phase: "Explain", title: "Explain with evidence" },
      p4: { phase: "Elaborate 1", title: "Stand at the lunar south pole" },
      p5: { phase: "Elaborate 2", title: "Compare three landing sites" },
      p6: { phase: "Evaluate", title: "Present and reflect" },
    },
    pack: {
      loading: "Loading the lesson data…",
      error: "The lesson data could not be loaded",
      retry: "Try again",
      syntheticLabel: "Synthetic data",
      syntheticDetail:
        "Every value on this page is made up to test the screen. It is not a calculation of the real Moon, and the dates match no real calendar.",
      realLabel: (version: string) => `Lesson pack ${version}`,
      realDetail:
        "Generated beforehand from the LUNARIS science core and served with the web app; no server is called during the lesson.",
    },
    guidance: {
      goalHeading: "Goal of this period",
      doHeading: "What you do",
      limitHeading: "Good to know",
      p1: {
        goal: "Predict before seeing any data: why does the Moon change shape?",
        steps: [
          "Watch the short clip about the mission to the lunar south pole, then draw and explain why the Moon changes shape.",
          "Build a lamp-and-ball model in groups and try to make the different shapes.",
          "Keep the prediction sketch to compare with the data in period 2.",
        ],
        limit:
          "No app is needed in this period. The lamp-and-ball model the students build themselves is what the learning indicator asks for; the app does not replace it.",
      },
      p3: {
        goal: "Explain the phases with the evidence from period 2 and write a conclusion.",
        steps: [
          "The teacher explains, using the data table students filled in during period 2.",
          "Write a claim–evidence–reasoning conclusion on why the phases happen.",
          "Discuss moonrise and moonset times and the tides without the app.",
        ],
        limit:
          "The app does not yet compute moonrise or moonset for an observer in Thailand, and it has no tide model. Those two topics are taught without the app.",
      },
      p6: {
        goal: "Present the team's recommended landing site, take the post-test, and reflect.",
        steps: [
          "Each team presents its recommended site with the evidence from its decision memo.",
          "Take the post-test.",
          "Write a reflection on which values in the model are measurements, which are models, and which are assumptions.",
        ],
        limit:
          'You can use the "Compare" page of the app in the presentation. Every value there opens its evidence.',
      },
    },
    comingSoon: {
      heading: "This step is not available in classroom mode yet",
      body: "It is being built. Meanwhile you can use the exploration page below. That page calls the server, which can take up to a minute to wake the first time.",
      p4Link: 'Open the "Illumination & Earth" page',
      p5Link: 'Open the "Compare" page',
    },
    earth: {
      heading: "The Moon as seen from the Earth",
      viewLabel: "The Moon as seen from the centre of the Earth, north up",
      viewNote:
        "Seen from the centre of the Earth, north up. This view does not show the tilt, or the rise and set times, as seen from Thailand.",
      surfacePlaceholder:
        "The Moon surface in the picture is a placeholder (no real image is shipped in this build). The light and shadow follow the Sun direction in the data.",
      percentLit: "Lit",
      percentValue: (p: number) => `${p}%`,
      direction: "Part of the cycle",
      waxing: "Waxing (lit part growing)",
      waning: "Waning (lit part shrinking)",
      phaseName: "Phase name",
      phaseAngle: "Phase angle",
      elongation: "Elongation",
      degrees: (d: number) => `${d.toFixed(0)}°`,
      day: (d: number, total: number) => `Day ${d} of ${total} of the lunation`,
      dayShort: (d: number) => `Day ${d}`,
      dateLabel: "Date and time (UTC)",
      slider: "Move through the lunation",
      prevDay: "Back one day",
      nextDay: "Forward one day",
      restart: "Back to the start",
      bandsNote:
        "The phase names are bands of the lit percentage chosen for the classroom; they are not astronomical definitions.",
      calendarNote:
        "The app does not compute the lunar-calendar day (the ค่ำ count): it is a calendar convention and can differ from the astronomical phase by a day.",
      evidenceHeading: "Evidence for this value",
      evidenceKind: "Kind",
      evidenceEnglishNote:
        "The method and limitation text below is in English, as the science core wrote it.",
      method: "Method",
      limitations: "Limitations",
      phases: {
        new: "New Moon",
        waxingCrescent: "Waxing crescent",
        firstQuarter: "First quarter",
        waxingGibbous: "Waxing gibbous",
        full: "Full Moon",
        waningGibbous: "Waning gibbous",
        lastQuarter: "Last quarter",
        waningCrescent: "Waning crescent",
      },
    },
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
      shortTitle: "Sunlight",
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
