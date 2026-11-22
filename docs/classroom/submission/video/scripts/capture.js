// Captures real LUNARIS output from the live demo for the video (1920x1080 viewport, deviceScaleFactor 2).
// Run from the repo root:  node docs/classroom/submission/video/scripts/capture.js [what...]
//   what: stills | p2 | globe | sky | p5   (default: all)
// Output: docs/classroom/submission/video/public/captures/ (not committed; regenerate with this script).
// The free host sleeps: the first page load can take a minute; the script waits for the API.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.LUNARIS_URL || 'https://lunaris-demo.onrender.com';
const OUT = path.join(__dirname, '..', 'public', 'captures');
fs.mkdirSync(OUT, { recursive: true });
const which = process.argv.slice(2);
const want = (k) => which.length === 0 || which.includes(k);
const pad = (n) => String(n).padStart(3, '0');

async function newPage(b) {
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, locale: 'th-TH' });
  return ctx.newPage();
}

async function open(p, route) {
  await p.goto(BASE + route, { waitUntil: 'networkidle', timeout: 180000 });
  for (let i = 0; i < 40; i++) {
    const t = await p.locator('header').innerText().catch(() => '');
    if (!/Waking|กำลังปลุก/i.test(t)) break;
    await p.waitForTimeout(5000);
  }
  await p.waitForTimeout(4000);
}

// Hide the header clock, the sidebar and anything else outside <main> so no live time or English chrome shows.
const hideChrome = (p) =>
  p.addStyleTag({ content: 'header, aside, nav[aria-label] { visibility: hidden !important; }' });

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // /learn/2: day slider, one still per day 1..30 (day index 0..29), cropped to the Moon + readout + slider.
  if (want('p2') || want('stills')) {
    const p = await newPage(b);
    await open(p, '/learn/2');
    await hideChrome(p);
    const fwd = p.getByRole('button', { name: 'เดินหน้าหนึ่งวัน' });
    const clip = { x: 580, y: 270, width: 1000, height: 760 };
    const last = want('p2') ? 29 : 8;
    for (let d = 0; d <= last; d++) {
      if (d > 0) { await fwd.click(); }
      await p.waitForTimeout(d === 0 ? 1500 : 1100);
      if (want('p2') || d === 8) await p.screenshot({ path: path.join(OUT, `p2-day-${pad(d)}.png`), clip });
    }
    await p.context().close();
  }

  // /: globe canvas only, HUD hidden, "South polar" then "Pole" (the poster's method).
  if (want('globe') || want('stills')) {
    const p = await newPage(b);
    await open(p, '/');
    for (const lab of ['Labels', 'Sites', 'Graticule', 'Grid']) {
      const bt = p.getByRole('button', { name: lab, exact: true }).first();
      if ((await bt.count()) && (await bt.getAttribute('data-state')) === 'on') await bt.click();
    }
    const hideHud = () => p.evaluate(() => {
      const c = document.querySelector('canvas');
      const sec = c.closest('section');
      const keep = new Set(); let q = c; while (q && q !== sec) { keep.add(q); q = q.parentElement; }
      sec.querySelectorAll('*').forEach((e) => { if (!keep.has(e) && !e.contains(c) && !c.contains(e)) e.style.visibility = 'hidden'; });
    });
    const showHud = () => p.evaluate(() => document.querySelectorAll('section *').forEach((e) => (e.style.visibility = '')));
    const canvas = p.locator('canvas').first();
    await p.getByRole('radio', { name: 'South polar', exact: true }).click();
    await p.waitForTimeout(8000);
    await hideHud(); await p.waitForTimeout(800);
    await canvas.screenshot({ path: path.join(OUT, 'globe-southpolar.png') });
    if (want('globe')) {
      // the camera eases between presets; sample it at ~10 fps (frames are retimed in Remotion)
      await showHud();
      await p.getByRole('radio', { name: 'Pole', exact: true }).click();
      await hideHud();
      for (let i = 0; i < 60; i++) { await canvas.screenshot({ path: path.join(OUT, `globe-move-${pad(i)}.png`) }); }
      await p.waitForTimeout(4000);
      await canvas.screenshot({ path: path.join(OUT, 'globe-pole.png') });
    }
    await p.context().close();
  }

  // /learn/4: the sky chart, cropped to the plot (Thai axis labels are part of the app).
  if (want('sky') || want('stills')) {
    const p = await newPage(b);
    await open(p, '/learn/4');
    await hideChrome(p);
    await p.screenshot({ path: path.join(OUT, 'sky-chart.png'), clip: { x: 592, y: 440, width: 976, height: 320 } });
    await p.context().close();
  }

  // /learn/5: the table, then one number's evidence opened.
  if (want('p5')) {
    const p = await newPage(b);
    await open(p, '/learn/5');
    await hideChrome(p);
    const table = p.locator('main table').first();
    await table.scrollIntoViewIfNeeded();
    await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(OUT, 'p5-table.png'), fullPage: false });
    const num = p.getByRole('button', { name: '88.3 %' }).first();
    const bb = await num.boundingBox();
    fs.writeFileSync(path.join(OUT, 'p5-layout.json'), JSON.stringify({ target: '88.3 %', box: bb, scrollY: await p.evaluate(() => scrollY) }, null, 2));
    await num.click();
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, 'p5-evidence.png'), fullPage: false });
    await p.context().close();
  }

  await b.close();
  console.log(fs.readdirSync(OUT).filter((f) => !/move|day-0[1-9][0-9]/.test(f)).join('\n'));
})();
