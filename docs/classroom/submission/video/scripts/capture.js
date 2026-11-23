// Captures real LUNARIS output from the live demo for the video (1920x1080 viewport, deviceScaleFactor 2).
// Run from the repo root:  node docs/classroom/submission/video/scripts/capture.js [what...]
//   what: stills | p2 | globe | sky | p5 | orbit   (default: all)
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
      // the preset switch is instant (no eased camera), so P4's motion comes from 'orbit' below
      await showHud();
      await p.getByRole('radio', { name: 'Pole', exact: true }).click();
      await p.waitForTimeout(6000);
      await hideHud(); await p.waitForTimeout(800);
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

  // /learn/5: full-page captures (scroll container unlocked) before and after tapping 88.3 %,
  // plus the button and evidence-panel boxes in page coordinates for the PageCam keys.
  if (want('p5')) {
    const p = await newPage(b);
    await open(p, '/learn/5');
    await hideChrome(p);
    await p.addStyleTag({ content: 'html, body, body * { height: auto !important; max-height: none !important; overflow: visible !important; } aside { display: none !important; }' });
    await p.waitForTimeout(1500);
    const num = p.getByRole('button', { name: '88.3 %' }).first();
    const box = async (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; });
    const table = await box(p.locator('main table').first());
    const target = await box(num);
    await p.screenshot({ path: path.join(OUT, 'p5-page-before.png'), fullPage: true });
    await num.click();
    await p.waitForTimeout(1500);
    const ev = await p.evaluate(() => {
      const s = [...document.querySelectorAll('span')].find((e) => e.textContent.trim() === 'ชนิด:');
      let el = s; while (el && el.parentElement && el.getBoundingClientRect().width < 900) el = el.parentElement;
      const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
    });
    await p.screenshot({ path: path.join(OUT, 'p5-page-after.png'), fullPage: true });
    const pageH = await p.evaluate(() => document.documentElement.scrollHeight);
    fs.writeFileSync(path.join(OUT, 'p5-layout.json'), JSON.stringify({ pageW: 1920, pageH, table, target, evidence: ev }, null, 2));
    await p.context().close();
  }

  // /: orbit the globe with real mouse drags from the South polar view toward the pole.
  if (want('orbit')) {
    const p = await newPage(b);
    await open(p, '/');
    for (const lab of ['Labels', 'Sites', 'Graticule', 'Grid']) {
      const bt = p.getByRole('button', { name: lab, exact: true }).first();
      if ((await bt.count()) && (await bt.getAttribute('data-state')) === 'on') await bt.click();
    }
    await p.getByRole('radio', { name: 'South polar', exact: true }).click();
    await p.waitForTimeout(8000);
    const canvas = p.locator('canvas').first();
    const bb = await canvas.boundingBox();
    const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    await p.evaluate(() => {
      const c = document.querySelector('canvas'); const sec = c.closest('section');
      const keep = new Set(); let q = c; while (q && q !== sec) { keep.add(q); q = q.parentElement; }
      sec.querySelectorAll('*').forEach((e) => { if (!keep.has(e) && !e.contains(c) && !c.contains(e)) e.style.visibility = 'hidden'; });
    });
    const steps = Number(process.env.ORBIT_STEPS || 48), dy = Number(process.env.ORBIT_DY || 5);
    await p.mouse.move(cx, cy); await p.mouse.down();
    for (let i = 0; i <= steps; i++) {
      if (i > 0) await p.mouse.move(cx, cy - i * dy, { steps: 2 });
      await p.waitForTimeout(250);
      await canvas.screenshot({ path: path.join(OUT, `globe-orbit-${pad(i)}.png`) });
    }
    await p.mouse.up();
    await p.context().close();
  }

  await b.close();
  console.log(fs.readdirSync(OUT).filter((f) => !/move|day-0[1-9][0-9]/.test(f)).join('\n'));
})();
