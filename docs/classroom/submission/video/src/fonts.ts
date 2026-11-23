import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';

const FACES: [string, number, string][] = [
  ['Kanit', 300, 'Kanit-300'], ['Kanit', 500, 'Kanit-500'], ['Kanit', 600, 'Kanit-600'], ['Kanit', 700, 'Kanit-700'],
  ['NotoThai', 400, 'NotoSansThai-400'], ['NotoThai', 500, 'NotoSansThai-500'], ['NotoThai', 700, 'NotoSansThai-700'],
];

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('font load timeout')), ms))]);

// Load one face, retrying: under parallel rendering a tab's first fetch can stall.
const loadFace = async ([family, weight, file]: [string, number, string]) => {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const buf = await withTimeout(fetch(`${staticFile(`fonts/${file}.ttf`)}?a=${attempt}`).then((r) => {
        if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
        return r.arrayBuffer();
      }), 15000);
      const f = new FontFace(family, buf, { weight: String(weight) });
      document.fonts.add(await f.load());
      return;
    } catch (e) { last = e; }
  }
  throw last;
};

let started = false;
export const loadFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('fonts', { timeoutInMilliseconds: 170000 });
  Promise.all(FACES.map(loadFace))
    .then(() => continueRender(handle))
    .catch((e) => cancelRender(e)); // never render a frame with fallback fonts
};
