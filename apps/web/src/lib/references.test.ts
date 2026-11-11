import { describe, expect, it } from "vitest";

import {
  datasetReferences,
  distinctReferences,
  doisIn,
  groupSources,
  isTechnicalNote,
  linkify,
  referencesFrom,
} from "./references";

const NAIF_CITATION =
  "Acton, C. H. (1996). Ancillary data services of NASA's Navigation and Ancillary Information Facility. Planetary and Space Science, 44(1), 65–70. doi:10.1016/0032-0633(95)00107-7. Park, R. S., Folkner, W. M., Williams, J. G., & Boggs, D. H. (2021). The JPL Planetary and Lunar Ephemerides DE440 and DE441. The Astronomical Journal, 161(3), 105. doi:10.3847/1538-3881/abd414";

describe("doisIn", () => {
  it("finds DOIs without the trailing full stop and without repeats", () => {
    expect(doisIn("see doi:10.1016/j.pss.2020.105119. Again 10.1016/J.PSS.2020.105119.")).toEqual([
      "10.1016/j.pss.2020.105119",
    ]);
  });
});

describe("doisIn with brackets", () => {
  it("keeps the brackets inside a DOI and drops the one that closes a sentence", () => {
    expect(doisIn("doi:10.1016/0032-0633(95)00107-7.")).toEqual(["10.1016/0032-0633(95)00107-7"]);
    expect(doisIn("(see doi:10.3847/1538-3881/abd414)")).toEqual(["10.3847/1538-3881/abd414"]);
  });
});

describe("referencesFrom", () => {
  it("splits a two-reference citation into two references in one style", () => {
    const refs = referencesFrom([NAIF_CITATION]);
    expect(refs.map((r) => r.doi)).toEqual(["10.1016/0032-0633(95)00107-7", "10.3847/1538-3881/abd414"]);
    expect(refs[0]!.text).toMatch(/^Acton, C\. H\. \(1996\)\. Ancillary data services/);
    expect(refs[0]!.url).toBe("https://doi.org/10.1016/0032-0633(95)00107-7");
  });

  it("lists each reference once however many files cite it", () => {
    const refs = referencesFrom([NAIF_CITATION, NAIF_CITATION, NAIF_CITATION, NAIF_CITATION, NAIF_CITATION]);
    expect(refs).toHaveLength(2);
  });

  it("prints the same reference the same way whatever style it arrived in", () => {
    const short = referencesFrom([
      "Barker et al. (2021), Planet. Space Sci. 203, 105119, doi:10.1016/j.pss.2020.105119",
    ]);
    const full = referencesFrom([
      "NASA PGDA product 78. Barker, M. K., et al. (2021). Improved LOLA elevation maps. doi:10.1016/j.pss.2020.105119",
    ]);
    expect(short).toEqual(full);
    expect(short[0]!.text).toContain("Improved LOLA elevation maps for south pole landing sites");
  });

  it("falls back to the text it was given for a citation without a known DOI", () => {
    const refs = referencesFrom(["NASA's Scientific Visualization Studio. CGI Moon Kit, SVS 4720."]);
    expect(refs).toEqual([
      { doi: null, text: "NASA's Scientific Visualization Studio. CGI Moon Kit, SVS 4720.", url: null },
    ]);
  });

  it("keeps the text of a DOI it does not know instead of dropping it", () => {
    const refs = referencesFrom(["Someone (2030). A paper. doi:10.9999/unknown.1"]);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.doi).toBe("10.9999/unknown.1");
    expect(refs[0]!.url).toBe("https://doi.org/10.9999/unknown.1");
  });

  it("ignores empty citations", () => {
    expect(referencesFrom([null, undefined, "  "])).toEqual([]);
  });
});

describe("linkify", () => {
  it("turns a DOI and a web address into links and leaves the rest as text", () => {
    const parts = linkify(
      "Data at https://pgda.gsfc.nasa.gov/products/78. See doi:10.1016/j.pss.2020.105119.",
    );
    expect(parts.filter((p) => p.href).map((p) => p.href)).toEqual([
      "https://pgda.gsfc.nasa.gov/products/78",
      "https://doi.org/10.1016/j.pss.2020.105119",
    ]);
    expect(parts.map((p) => p.text).join("")).toBe(
      "Data at https://pgda.gsfc.nasa.gov/products/78. See doi:10.1016/j.pss.2020.105119.",
    );
  });
});

describe("groupSources", () => {
  const file = (name: string) => ({
    source_id: `naif-generic-kernels-lunar/${name}`,
    title: `Kernel ${name}`,
    url: `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/${name}`,
    sha256: "a".repeat(64),
    citation: NAIF_CITATION,
  });

  it("groups the files of one dataset under one name with each reference once", () => {
    const groups = groupSources([file("lsk"), file("pck"), file("de440s.bsp")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.name).toMatch(/NAIF SPICE/);
    expect(groups[0]!.pageUrl).toBe("https://naif.jpl.nasa.gov/naif/data_generic.html");
    expect(groups[0]!.references).toHaveLength(2);
    expect(groups[0]!.files).toHaveLength(3);
  });
});

describe("isTechnicalNote", () => {
  it("recognises fetch provenance but not a limit of the science", () => {
    expect(isTechnicalNote("Transfer: 643,659 bytes requested, 0 retried request(s)")).toBe(true);
    expect(isTechnicalNote("DEM window: https://x — columns 1–2")).toBe(true);
    expect(isTechnicalNote("Limb darkening is neglected.")).toBe(false);
  });
});

describe("datasetReferences", () => {
  const LOLA =
    "Smith, D. E., et al. (2010). The Lunar Orbiter Laser Altimeter Investigation on the Lunar Reconnaissance Orbiter Mission. Space Science Reviews, 150, 209–241. doi:10.1007/s11214-009-9512-y. Data set: LRO-L-LOLA-4-GDR-V1.0, NASA Planetary Data System (use the exact data set citation from the PDS product page).";

  it("drops the developer note and adds the data set's own DOI", () => {
    const refs = datasetReferences("lola-ldem-75s-240m", LOLA);
    expect(refs.map((r) => r.doi)).toEqual(["10.1007/s11214-009-9512-y", "10.17189/tnyt-7007"]);
    expect(refs.map((r) => r.text).join(" ")).not.toMatch(/use the exact data set citation/);
  });

  it("merges lists without repeating a reference", () => {
    const a = datasetReferences("lola-ldem-75s-240m", LOLA);
    expect(distinctReferences([a, a])).toHaveLength(2);
  });
});
