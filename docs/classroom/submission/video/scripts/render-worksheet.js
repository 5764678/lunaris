// Renders docs/classroom/kit/worksheet-1.md as a printed A4 page (794 x 1123 CSS px, 2.5x texture) for period 3.
// Writes public/worksheet-1.png (not committed) and src/generated/worksheet-layout.json (answer-cell boxes).
// Run: node docs/classroom/submission/video/scripts/render-worksheet.js   (needs scripts/fetch-fonts.js first)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const V = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(V, '../../kit/worksheet-1.md'), 'utf8');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');

// Minimal Markdown for this file: #/## headings, > quotes, | tables |, paragraphs.
function toHtml(src) {
  const out = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    if (l.startsWith('## ')) { out.push(`<h2>${inline(l.slice(3))}</h2>`); continue; }
    if (l.startsWith('# ')) { out.push(`<h1>${inline(l.slice(2))}</h1>`); continue; }
    if (l.startsWith('> ')) { out.push(`<blockquote>${inline(l.slice(2))}</blockquote>`); continue; }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++; }
      i--;
      const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim());
      const [head, , ...body] = rows;
      out.push('<table><thead><tr>' + cells(head).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        body.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    out.push(`<p>${inline(l)}</p>`);
  }
  return out.join('\n');
}

const font = (f) => 'file://' + path.join(V, 'fonts', f);
const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
@font-face { font-family: Kanit; font-weight: 600; src: url(${font('Kanit-600.ttf')}); }
@font-face { font-family: NotoThai; font-weight: 400; src: url(${font('NotoSansThai-400.ttf')}); }
@font-face { font-family: NotoThai; font-weight: 700; src: url(${font('NotoSansThai-700.ttf')}); }
html, body { margin: 0; background: #fff; }
.page { width: 794px; height: 1123px; box-sizing: border-box; padding: 56px 60px; font-family: NotoThai, sans-serif; font-size: 13.5px; line-height: 1.6; color: #1c1a17; overflow: hidden; }
h1 { font-family: Kanit, NotoThai; font-weight: 600; font-size: 22px; margin: 0 0 10px; }
h2 { font-family: Kanit, NotoThai; font-weight: 600; font-size: 16px; margin: 18px 0 6px; border-bottom: 1.5px solid #1c1a17; padding-bottom: 2px; }
p { margin: 0 0 7px; } b { font-weight: 700; }
code { font-family: ui-monospace, monospace; font-size: 12px; }
blockquote { margin: 8px 0 10px; padding: 6px 12px; border-left: 3px solid #a0461e; background: #f6f1e7; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 12.5px; }
th, td { border: 1px solid #555; padding: 4px 6px; height: 22px; text-align: left; }
th { background: #eee8dc; font-weight: 700; }
</style></head><body><div class="page">${toHtml(md)}</div></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2.5 })).newPage();
  const tmp = path.join(V, 'out', 'worksheet-1.html');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, html);
  await p.goto('file://' + tmp);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  // answer cells for the abstract handwriting: rows 1-3 of the first table, columns 3 (%) and 4 (ข้างขึ้น/ข้างแรม)
  const cells = await p.evaluate(() => {
    const t = document.querySelector('table');
    const out = [];
    [...t.querySelectorAll('tbody tr')].slice(0, 3).forEach((tr) => {
      [2, 3].forEach((ci) => { const r = tr.children[ci].getBoundingClientRect(); out.push({ x: r.x, y: r.y, w: r.width, h: r.height }); });
    });
    return out;
  });
  await p.screenshot({ path: path.join(V, 'public', 'worksheet-1.png') });
  fs.mkdirSync(path.join(V, 'src/generated'), { recursive: true });
  fs.writeFileSync(path.join(V, 'src/generated/worksheet-layout.json'), JSON.stringify({ pageW: 794, pageH: 1123, cells }, null, 2) + '\n');
  await b.close();
  console.log('worksheet-1.png +', cells.length, 'cells');
})();
