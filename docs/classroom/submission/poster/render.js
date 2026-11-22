// Renders poster.html to an A0 PDF and a preview JPG.
// Run: node docs/classroom/submission/poster/render.js [poster.html] [out-basename]
// Needs: Playwright + Chromium (preinstalled), poppler-utils (pdfimages), python3 with Pillow.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const H = __dirname;
const src = path.join(H, process.argv[2] || 'poster.html');
const base = process.argv[3] || 'lunaris-poster-A0';

// 1. template raster out of the organisers' PDF (not committed twice)
const tpl = path.join(H, 'img', 'template.png');
if (!fs.existsSync(tpl)) {
  execFileSync('pdfimages', ['-png', '-f', '1', '-l', '1', path.join(H, '..', 'poster-template-students.pdf'), path.join(H, 'img', 'tpl')]);
  fs.renameSync(path.join(H, 'img', 'tpl-000.png'), tpl);
}

// 2. fonts (SIL OFL, from Google Fonts; downloaded, not committed)
const fdir = path.join(H, 'fonts');
fs.mkdirSync(fdir, { recursive: true });
const need = ['Kanit-300', 'Kanit-500', 'Kanit-600', 'Kanit-700', 'NotoSansThai-400', 'NotoSansThai-500', 'NotoSansThai-700'];
if (need.some((n) => !fs.existsSync(path.join(fdir, n + '.ttf')))) {
  for (const spec of ['Kanit:wght@300;500;600;700', 'Noto+Sans+Thai:wght@400;500;700']) {
    const css = execFileSync('curl', ['-s', `https://fonts.googleapis.com/css2?family=${spec}`]).toString();
    for (const m of css.matchAll(/font-family: '([^']+)';[\s\S]*?font-weight: (\d+);[\s\S]*?url\((\S+?)\)/g)) {
      execFileSync('curl', ['-s', '-o', path.join(fdir, `${m[1].replace(/ /g, '')}-${m[2]}.ttf`), m[3]]);
    }
  }
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 3179, height: 4495 }, deviceScaleFactor: 1 });
  await p.goto('file://' + src);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);

  // checks: everything inside the white panel, nothing overflowing its box
  const report = await p.evaluate(() => {
    const k = 3889 / 3178.583, out = [];
    const PANEL = { x0: 344, y0: 348, x1: 3545, y1: 5137 };
    document.querySelectorAll('#sheet > *:not(#level)').forEach((e) => {
      const r = e.getBoundingClientRect();
      const x0 = r.left * k, y0 = r.top * k, x1 = r.right * k, y1 = r.bottom * k;
      if (x0 < PANEL.x0 || y0 < PANEL.y0 || x1 > PANEL.x1 || y1 > PANEL.y1)
        out.push(`OUTSIDE ${e.id || e.className}: ${[x0, y0, x1, y1].map(Math.round)}`);
    });
    document.querySelectorAll('.card, .part, #hl, .blk, #use .ic, #qr').forEach((e) => {
      if (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2)
        out.push(`OVERFLOW ${e.id || e.className} ${e.scrollWidth}x${e.scrollHeight} > ${e.clientWidth}x${e.clientHeight}`);
    });
    // text budget: Thai words approximated with Intl.Segmenter, footer excluded
    const seg = new Intl.Segmenter('th', { granularity: 'word' });
    const txt = [...document.querySelectorAll('#sheet > *:not(#foot):not(#level)')].map((e) => e.innerText).join(' ');
    const words = [...seg.segment(txt)].filter((s) => s.isWordLike).length;
    out.push(`WORDS (excl. footer, Intl.Segmenter th): ${words}`);
    return out;
  });
  console.log(report.join('\n'));

  await p.screenshot({ path: path.join(H, `${base}-full.png`) });
  await p.pdf({ path: path.join(H, `${base}.pdf`), width: '841mm', height: '1189mm', printBackground: true, preferCSSPageSize: true });
  await b.close();
  execFileSync('python3', ['-c', `from PIL import Image
im=Image.open('${base}-full.png').convert('RGB'); im.thumbnail((1700,2500)); im.save('${base}-preview.jpg', quality=88)`], { cwd: H });
  console.log('wrote', base + '.pdf', base + '-preview.jpg');
})();
