/**
 * One citation style for the whole app: authors, year, title, journal, DOI.
 *
 * The API sends each source with a free-text `citation`. Those strings differ in style and
 * sometimes name two references at once, so this module finds the DOIs in them and prints each
 * known reference in one fixed form. A DOI it does not know falls back to the text it was sent.
 * Every reference is listed once, however many data files cite it.
 */

export interface Reference {
  /** Lower-case DOI, or null for a reference without one. */
  doi: string | null;
  /** Authors, year, title and journal. No DOI, which is shown as a link beside it. */
  text: string;
  /** Link target: the DOI resolver when there is a DOI, else the page the text names. */
  url: string | null;
}

/** References the app relies on. Titles and journal details were checked against doi.org. */
const KNOWN: Reference[] = [
  {
    doi: "10.1007/s11214-009-9512-y",
    text: "Smith, D. E., et al. (2010). The Lunar Orbiter Laser Altimeter Investigation on the Lunar Reconnaissance Orbiter Mission. Space Science Reviews, 150, 209–241.",
    url: null,
  },
  {
    doi: "10.17189/tnyt-7007",
    text: "Smith, D. E., & Neumann, G. A. (2023). Lunar Reconnaissance Orbiter LOLA Processed Data (RDR) Bundle [Data set]. NASA Planetary Data System.",
    url: null,
  },
  {
    doi: "10.1016/j.pss.2020.105119",
    text: "Barker, M. K., et al. (2021). Improved LOLA elevation maps for south pole landing sites: Error estimates and their impact on illumination conditions. Planetary and Space Science, 203, 105119.",
    url: null,
  },
  {
    doi: "10.3847/psj/acf3e1",
    text: "Barker, M. K., et al. (2023). A New View of the Lunar South Pole from the Lunar Orbiter Laser Altimeter (LOLA). The Planetary Science Journal, 4(9), 183.",
    url: null,
  },
  {
    doi: "10.60903/gsfcpgda-lola-spole",
    text: "Barker, M. K. (2023). A New View of the Lunar South Pole from LOLA [Data set]. NASA Goddard Space Flight Center, Planetary Geodynamics Data Archive, product 90.",
    url: null,
  },
  {
    doi: "10.1016/0032-0633(95)00107-7",
    text: "Acton, C. H. (1996). Ancillary data services of NASA's Navigation and Ancillary Information Facility. Planetary and Space Science, 44(1), 65–70.",
    url: null,
  },
  {
    doi: "10.3847/1538-3881/abd414",
    text: "Park, R. S., Folkner, W. M., Williams, J. G., & Boggs, D. H. (2021). The JPL Planetary and Lunar Ephemerides DE440 and DE441. The Astronomical Journal, 161(3), 105.",
    url: null,
  },
];

// Parentheses are legal inside a DOI (10.1016/0032-0633(95)00107-7), so they are matched and the
// unbalanced closing one that ends a sentence is trimmed afterwards.
const DOI_PATTERN = /10\.\d{4,9}\/[^\s,;<>"]+/gi;
const URL_PATTERN = /https?:\/\/[^\s,;<>"]+/gi;

const KNOWN_BY_DOI = new Map<string, Reference>(
  KNOWN.map((r): [string, Reference] => [r.doi as string, { ...r, url: doiUrl(r.doi as string) }]),
);

/** `https://doi.org/…` for a DOI (any case, with or without a `doi:` prefix). */
export function doiUrl(doi: string): string {
  return `https://doi.org/${doi.replace(/^doi:\s*/i, "")}`;
}

/**
 * Strips what trails a DOI or web address in running text: full stops, and a closing bracket
 * that has no opening one inside the match (as in "(see doi:10.1000/x)").
 */
function trimTail(match: string): string {
  let out = match.replace(/[.]+$/, "");
  while (out.endsWith(")") && (out.match(/\)/g)?.length ?? 0) > (out.match(/\(/g)?.length ?? 0)) {
    out = out.slice(0, -1).replace(/[.]+$/, "");
  }
  return out;
}

/** The DOIs named in a block of citation text, lower-case, in order, without repeats. */
export function doisIn(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(DOI_PATTERN)) {
    const doi = trimTail(match[0]).toLowerCase();
    if (!found.includes(doi)) found.push(doi);
  }
  return found;
}

/**
 * The distinct references a set of citation strings name, in the app's one style. A citation with
 * known DOIs becomes those references; one without falls back to its own text. Nothing repeats.
 */
export function referencesFrom(citations: readonly (string | null | undefined)[]): Reference[] {
  const out: Reference[] = [];
  const seen = new Set<string>();
  const add = (ref: Reference) => {
    const key = ref.doi ?? ref.text;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(ref);
  };
  for (const citation of citations) {
    const text = citation?.trim();
    if (!text) continue;
    const dois = doisIn(text);
    const known = dois.map((d) => KNOWN_BY_DOI.get(d)).filter((r): r is Reference => r !== undefined);
    if (known.length > 0) {
      known.forEach(add);
      // A DOI the app does not know is not dropped: the whole text is kept for it.
      if (known.length < dois.length) add({ doi: null, text, url: null });
    } else {
      add({
        doi: dois[0] ?? null,
        text: dois[0] ? text.replace(DOI_PATTERN, "").trim() : text,
        url: dois[0] ? doiUrl(dois[0]) : null,
      });
    }
  }
  return out;
}

/**
 * References a dataset needs that its manifest citation does not carry. The LOLA map's manifest
 * names its paper and a PDS data set with a note to look up the exact citation; the data set's
 * own DOI is added here. (Editing the manifest would change its fingerprint and mark the
 * acquired file as changed.)
 */
const EXTRA_CITATIONS: Record<string, string[]> = {
  "lola-ldem-75s-240m": ["doi:10.17189/tnyt-7007"],
};

/** The distinct references for one dataset: its manifest citation plus any the app adds. */
export function datasetReferences(datasetId: string, citation: string | null | undefined): Reference[] {
  return referencesFrom([citation, ...(EXTRA_CITATIONS[datasetId] ?? [])]);
}

/** Merges reference lists, keeping each reference once. */
export function distinctReferences(lists: readonly Reference[][]): Reference[] {
  const seen = new Set<string>();
  return lists.flat().filter((r) => {
    const key = r.doi ?? r.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A reference as one plain line, for the copy button: text, then its DOI link. */
export function referenceLine(ref: Reference): string {
  return ref.doi ? `${ref.text} ${doiUrl(ref.doi)}` : ref.text;
}

export type TextPart = { text: string; href?: string };

/** Splits free text into plain parts and links: DOIs and web addresses become clickable. */
export function linkify(text: string): TextPart[] {
  const matches: { start: number; end: number; href: string; text: string }[] = [];
  for (const m of text.matchAll(URL_PATTERN)) {
    const t = trimTail(m[0]);
    matches.push({ start: m.index, end: m.index + t.length, href: t, text: t });
  }
  for (const m of text.matchAll(/(?:doi:\s*)?(10\.\d{4,9}\/[^\s,;<>"]+)/gi)) {
    const t = trimTail(m[0]);
    const start = m.index;
    if (matches.some((x) => start < x.end && start + t.length > x.start)) continue;
    matches.push({ start, end: start + t.length, href: doiUrl(trimTail(m[1]!)), text: t });
  }
  matches.sort((a, b) => a.start - b.start);
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) parts.push({ text: text.slice(cursor, m.start) });
    parts.push({ text: m.text, href: m.href });
    cursor = m.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export interface SourceInput {
  source_id: string;
  title: string;
  url?: string | null;
  version?: string | null;
  sha256?: string | null;
  citation?: string | null;
}

export interface DatasetGroup {
  /** The dataset id: the part of the source id before the first "/". */
  id: string;
  /** Plain dataset name. */
  name: string;
  /** The dataset's web page, when known. The data files are listed separately. */
  pageUrl: string | null;
  references: Reference[];
  /** Individual data files: the technical details. */
  files: { title: string; url: string | null; sha256: string | null; version: string | null }[];
}

/** Plain names and web pages for the datasets the app uses. Unknown ids fall back to the source. */
const DATASETS: Record<string, { name: string; pageUrl: string }> = {
  "lola-ldem-75s-240m": {
    name: "LOLA south-polar elevation map, 240 m per pixel",
    pageUrl: "https://pds-geosciences.wustl.edu/missions/lro/lola.htm",
  },
  "pgda-lola-20mpp-80s": {
    name: "LOLA south-pole elevation map, 20 m per pixel",
    pageUrl: "https://pgda.gsfc.nasa.gov/products/90",
  },
  "naif-generic-kernels-lunar": {
    name: "NAIF SPICE kernels (Sun, Earth and Moon positions)",
    pageUrl: "https://naif.jpl.nasa.gov/naif/data_generic.html",
  },
  "nasa-svs-cgi-moon-kit": {
    name: "NASA CGI Moon Kit (globe image only)",
    pageUrl: "https://svs.gsfc.nasa.gov/4720",
  },
};

/** Groups an evidence's sources by dataset so each dataset and each reference appears once. */
export function groupSources(sources: readonly SourceInput[]): DatasetGroup[] {
  const order: string[] = [];
  const byId = new Map<string, SourceInput[]>();
  for (const s of sources) {
    const id = s.source_id.split("/")[0] ?? s.source_id;
    if (!byId.has(id)) {
      byId.set(id, []);
      order.push(id);
    }
    byId.get(id)!.push(s);
  }
  return order.map((id) => {
    const list = byId.get(id)!;
    const known = DATASETS[id];
    const first = list[0]!;
    const sameTitle = list.every((s) => s.title === first.title);
    return {
      id,
      name: known?.name ?? (sameTitle ? first.title : id),
      pageUrl: known?.pageUrl ?? null,
      references: referencesFrom([...list.map((s) => s.citation), ...(EXTRA_CITATIONS[id] ?? [])]),
      files: list.map((s) => ({
        title: s.title,
        url: s.url ?? null,
        sha256: s.sha256 ?? null,
        version: s.version ?? null,
      })),
    };
  });
}

/**
 * Provenance lines that describe how a file was fetched (URLs, validators, byte counts), not a
 * limit of the science. The evidence popup folds these into its technical details.
 */
export function isTechnicalNote(note: string): boolean {
  return /^(DEM window:|HTTP validators:|Transfer:)/.test(note);
}
