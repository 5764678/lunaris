// Captures real LUNARIS output from the live demo for the poster.
// Run: node docs/classroom/submission/poster/capture.js  (Playwright + Chromium preinstalled)
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.LUNARIS_URL || 'https://lunaris-demo.onrender.com';
const OUT = path.join(__dirname, 'captures');
const which = process.argv.slice(2);
const want = (k) => which.length === 0 || which.includes(k);

async function newPage(b, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, locale: 'th-TH' });
  return ctx.newPage();
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  if (want('phases')) {
    const p = await newPage(b, 1440, 900);
    await p.goto(BASE + '/learn/2', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForTimeout(4000);
    const fwd = p.getByRole('button', { name: 'เดินหน้าหนึ่งวัน' });
    const stops = [0, 4, 7, 11, 15, 18, 22, 26];
    let day = 0;
    const info = [];
    for (const s of stops) {
      while (day < s) { await fwd.click(); day++; await p.waitForTimeout(250); }
      await p.waitForTimeout(1200);
      const c = p.locator('canvas').first();
      await c.screenshot({ path: path.join(OUT, `phase-${String(s).padStart(2, '0')}.png`) });
      info.push({ day: s, text: (await p.locator('main').innerText()).match(/ส่วนสว่าง\s*\n?\s*([\d.]+\s*%)/)?.[1] });
    }
    console.log(JSON.stringify(info));
    await p.context().close();
  }

  if (want('sky')) {
    const p = await newPage(b, 1440, 1000);
    await p.goto(BASE + '/learn/4', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForTimeout(4000);
    const svg = p.locator('main svg').filter({ hasNot: p.locator('xxx') });
    const n = await svg.count();
    for (let i = 0; i < n; i++) {
      const bb = await svg.nth(i).boundingBox();
      if (bb && bb.width > 500 && bb.width < 2000) {
        await svg.nth(i).screenshot({ path: path.join(OUT, `sky-${i}.png`) });
      }
    }
    await p.context().close();
  }

  if (want('globe') || want('terrain')) {
    const p = await newPage(b, 2400, 1500);
    await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 180000 });
    for (let i = 0; i < 40; i++) {
      const t = await p.locator('header').innerText().catch(() => '');
      if (!/Waking/i.test(t)) break;
      await p.waitForTimeout(5000);
    }
    await p.waitForTimeout(5000);
    // labels and site pins off (the tag / pin buttons), grid off
    for (const lab of ['Labels', 'Sites', 'Graticule']) {
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
    const views = [];
    if (want('globe')) views.push(['globe-southpolar', 'South polar'], ['globe-pole', 'Pole']);
    for (const [name, preset] of views) {
      await showHud();
      await p.getByRole('radio', { name: preset, exact: true }).click();
      await p.waitForTimeout(7000);
      await hideHud(); await p.waitForTimeout(800);
      await p.locator('canvas').first().screenshot({ path: path.join(OUT, `${name}.png`) });
    }
    if (want('terrain')) {
      await showHud();
      await p.getByRole('radio', { name: 'South-pole terrain' }).click();
      await p.waitForTimeout(25000);
      for (const lab of ['Labels', 'Sites']) {
        const bt = p.getByRole('button', { name: lab, exact: true }).first();
        if ((await bt.count()) && (await bt.getAttribute('data-state')) === 'on') await bt.click();
      }
      await p.waitForTimeout(2000);
      await hideHud(); await p.waitForTimeout(800);
      await p.locator('canvas').first().screenshot({ path: path.join(OUT, 'terrain.png') });
    }
    await p.context().close();
  }
  await b.close();
})();
