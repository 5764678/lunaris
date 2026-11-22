import { continueRender, delayRender, staticFile } from 'remotion';

const FACES: [string, number, string][] = [
  ['Kanit', 300, 'Kanit-300'], ['Kanit', 500, 'Kanit-500'], ['Kanit', 600, 'Kanit-600'], ['Kanit', 700, 'Kanit-700'],
  ['NotoThai', 400, 'NotoSansThai-400'], ['NotoThai', 500, 'NotoSansThai-500'], ['NotoThai', 700, 'NotoSansThai-700'],
];

let started = false;
export const loadFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('fonts');
  Promise.all(
    FACES.map(([family, weight, file]) => {
      const f = new FontFace(family, `url(${staticFile(`fonts/${file}.ttf`)})`, { weight: String(weight) });
      return f.load().then((l) => document.fonts.add(l));
    }),
  ).then(() => continueRender(handle)).catch((e) => { console.error(e); continueRender(handle); });
};
