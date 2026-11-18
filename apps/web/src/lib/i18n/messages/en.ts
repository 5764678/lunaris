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
    evidence: {
      kindHeading: "Kind of evidence",
      kinds: {
        observation: "Observation",
        derived_product: "Derived product",
        model: "Model",
        calculation: "Calculation",
        assumption: "Assumption",
        placeholder: "Placeholder",
        notComputed: "Not computed",
      },
      meanings: {
        observation: "Measured by an instrument, as published by the team that ran it.",
        derived_product: "Built from measurements by the team that produced the dataset.",
        model: "Produced by a trusted physical model or planet-position table.",
        calculation: "Worked out by LUNARIS from other evidence; the method is recorded.",
        assumption: "A value chosen by setting or convention, not a measurement.",
        placeholder: "Stand-in content. Never valid evidence for a decision.",
      },
      show: "Show evidence",
      close: "Close",
      englishNote:
        "The method, source and limitation text below is in English, as the science core wrote it.",
      method: "Method",
      sources: "Sources",
      assumptions: "Assumptions",
      limitations: "Limitations",
      valueOf: (label: string, value: string) => `${label}: ${value}`,
    },
    sky: {
      heading: "Standing near the lunar south pole",
      siteLine: (name: string) => `Standing point: ${name}`,
      siteNote: "This is the centre of a data tile in the catalogue, not a chosen landing point.",
      windowNote: (start: string, end: string) =>
        `One lunation of data: ${start} to ${end} (UTC), every hour`,
      chartHeading: "Sky chart",
      chartHelp:
        "The horizontal axis is direction (azimuth 0°–360°, clockwise from north) and the vertical axis is elevation above the flat horizon. The grey area is the skyline made by the terrain. The dots are the Sun and the Earth every hour.",
      legendSun: "Sun",
      legendEarth: "Earth",
      legendSkyline: "Terrain skyline",
      factsHeading: "What you can read from the chart",
      sunRange: (max: string, min: string) => `The Sun is highest at ${max} and lowest at ${min}`,
      earthRange: (elMin: string, elMax: string, azMin: string, azMax: string) =>
        `The Earth is at ${elMin} to ${elMax} elevation, in direction ${azMin} to ${azMax}`,
      skylineRange: (min: string, max: string) => `The terrain skyline is between ${min} and ${max}`,
      lowSun:
        "The Sun stays low near the horizon and circles through every direction; the Earth stays low in nearly the same direction.",
      sunlitHeading: "How much of the time is it sunlit?",
      withTerrain: "With the terrain around the point",
      flatHorizon: "With no terrain (a flat horizon)",
      sunlitExplain:
        "The Sun reaches this point when its elevation is above the terrain skyline in that direction. A high point is lit more than it would be with a flat horizon.",
      sunlitEvidence: "Evidence for the sunlit fraction",
      hourHeading: "Hour by hour",
      hourSlider: "Move through time",
      hourLabel: "Date and time (UTC)",
      hourSun: (az: string, el: string, sky: string) =>
        `Sun: direction ${az}, elevation ${el}, skyline in that direction ${sky}`,
      hourEarth: (az: string, el: string, sky: string) =>
        `Earth: direction ${az}, elevation ${el}, skyline in that direction ${sky}`,
      visible: "In view (above the terrain skyline)",
      hidden: "Hidden by terrain (below the terrain skyline)",
      earthGeometric: "Earth visibility is geometric only; it does not mean a radio link works.",
      nearDarkHeading: "An example of an almost dark site",
      nearDarkBody: (name: string, pct: string, n: number) =>
        `In the scan of ${n} catalogue sites, the least-lit site this lunation is ${name}, sunlit ${pct} of the time.`,
      nearDarkNotZero:
        "That is not 0 %, but it is dark almost all the time. The lesson pack has no site at exactly 0 % in this window.",
      nearDarkSource: (start: string, end: string, criterion: string) =>
        `Source: the lesson pack (manifest.json, shadowed_scan), ${start} to ${end} (UTC), criterion: ${criterion}. This is the result for this one lunation, not a long-term value, and it has no per-value evidence label.`,
      nearDarkNoChart:
        "The lesson pack has no sky chart for this site; compare with the chart of the standing point above.",
      nearDarkUnavailable: "The lesson pack has no scan result for a dark site.",
      tanNote:
        "The crater-rim mathematics (tan) is worked on worksheet 2, part 4, with made-up numbers; it is not done in the app.",
      loading: "Loading the standing point's data…",
    },
    compare: {
      heading: "Compare the three demo sites",
      intro:
        "Data for the whole of 2027. The three sites are centres of data tiles in the catalogue, not chosen landing points. The mission is an invented classroom scenario.",
      periodNote: (start: string, end: string) => `Data period: ${start} to ${end} (UTC)`,
      tableHeading: "Values of the three sites, by role",
      tableCaption: "Comparison table. Press a value to see its evidence label.",
      siteHeader: "Site",
      pressForEvidence: "Press a value to see its evidence label. Every value has its kind of evidence.",
      roles: { geologist: "Geologist", power: "Power engineer", comms: "Communications officer" },
      metrics: {
        slope_at_site_deg: "Slope at the site",
        slope_p95_deg: "Slope (95th percentile around the site)",
        roughness_rms_m: "Roughness",
        sun_illuminated_fraction: "Share of time sunlit",
        sun_longest_hidden_s: "Longest darkness",
        sun_longest_visible_s: "Longest continuous sunlight",
        earth_visible_fraction: "Share of time Earth is in view",
        earth_longest_outage_s: "Longest time without Earth in view",
        surface_height_m: "Surface height",
        horizon_min_deg: "Lowest skyline",
        horizon_max_deg: "Highest skyline",
        horizon_truncated_azimuths: "Directions where the skyline is only a lower bound",
        sun_mean_visible_disk_fraction: "Mean visible fraction of the Sun's disk",
      },
      better: { lower: "Lower is better", higher: "Higher is better", none: "No better direction" },
      moreHeading: "Other values the app holds",
      verdictHeading: "The conclusion that uses no weights: is any site best on everything?",
      verdictNote:
        "This text is built from which site leads or trails on each value; it uses no weights. It is in English, as the science core wrote it.",
      missionHeading: "What the mission needs",
      missionHelp:
        "Let the team agree what the mission needs before looking at the recommendation, then pick the closest set. The lesson pack has four precomputed sets.",
      variants: {
        default: "Default: everything “important”",
        "power-critical": "Power critical, the other two not needed",
        "comms-critical": "Communications critical, the other two not needed",
        "landing-critical": "Landing critical, the other two not needed",
      },
      claimHeading: "The app's recommendation: a claim to check",
      claimNote:
        "A recommendation is not always right. It depends on the weights and scales the app chose, which are assumptions, not facts.",
      recommended: "Recommended site",
      runnerUp: "Runner-up",
      score: "Fit to the mission",
      scoreNote: "Computed from the weights below, so it is a result of assumptions.",
      confidence: { clear: "A clear lead", narrow: "A narrow lead: treat the two sites as close" },
      margin: "Score margin",
      weightsHeading: "Weights the app used",
      weightsAssumed: "Assumption",
      weightsNote: "The weights and scoring scales are chosen by the app; they are not mission requirements.",
      needs: { power: "Power", comms: "Communications", landing: "Landing" },
      priorities: { none: "Not needed", low: "Nice to have", medium: "Important", high: "Critical" },
      reasonsHeading: "Reasons the app gives",
      tradeoffsHeading: "What the recommended site gives up",
      noTradeoffs: "The app found no trade-off for this set of needs. Try changing the needs.",
      robustnessHeading: "When does the recommendation change?",
      generatedEnglish: "The text in this part is generated by the science core, so it is in English.",
      evidenceFold: "Evidence label of the recommendation",
      loading: "Loading the comparison…",
      siteNames: {} as Record<string, string>,
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
