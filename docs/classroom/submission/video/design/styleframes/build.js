// Builds the checkpoint-2 styleframes (static HTML, 1920x1080) and screenshots them to JPG.
// Needs: node scripts/fetch-fonts.js, node scripts/capture.js stills, node scripts/extract-diagram.js
// Run: node docs/classroom/submission/video/design/styleframes/build.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const H = __dirname;
const V = path.join(H, '..', '..');
const rel = (p) => path.relative(H, path.join(V, p)).split(path.sep).join('/');
const DIAGRAM_SVG = JSON.parse(fs.readFileSync(path.join(V, 'src/generated/diagram.ts'), 'utf8').match(/DIAGRAM_SVG = (".*");/)[1]);

const tokens = `
@font-face { font-family: Kanit; font-weight: 300; src: url(${rel('fonts/Kanit-300.ttf')}); }
@font-face { font-family: Kanit; font-weight: 500; src: url(${rel('fonts/Kanit-500.ttf')}); }
@font-face { font-family: Kanit; font-weight: 600; src: url(${rel('fonts/Kanit-600.ttf')}); }
@font-face { font-family: Kanit; font-weight: 700; src: url(${rel('fonts/Kanit-700.ttf')}); }
@font-face { font-family: NotoThai; font-weight: 400; src: url(${rel('fonts/NotoSansThai-400.ttf')}); }
@font-face { font-family: NotoThai; font-weight: 500; src: url(${rel('fonts/NotoSansThai-500.ttf')}); }
:root { --space:#06080b; --navy:#0d1626; --rust:#a0461e; --sun:#f2b43a; --earth:#7db3ff; --cream:#f6f1e7;
  --paper:#f4eddd; --ink:#1c1a17; --cap:#aab4bf; --text:#e9edf2;
  --head: Kanit, NotoThai, sans-serif; --body: NotoThai, Kanit, sans-serif; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:1920px; height:1080px; overflow:hidden; background:var(--space); color:var(--text); font-family:var(--body); }
.stage { position:absolute; inset:0; background: radial-gradient(1200px 800px at 62% 40%, var(--navy) 0%, var(--space) 70%); }
.stars { position:absolute; inset:0; }
.abs { position:absolute; }
.num { width:96px; height:96px; border-radius:50%; background:var(--sun); color:#1d1405; font-family:var(--head);
  font-weight:700; font-size:64px; line-height:96px; text-align:center; box-shadow:0 0 0 9px rgba(242,180,58,.22); }
.safe { position:absolute; inset:54px 96px; outline:1px dashed rgba(255,255,255,.0); }
`;

// deterministic star field (mulberry32)
function stars(seed, n, w = 1920, h = 1080) {
  let a = seed >>> 0;
  const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(0.5 + r() * 1.3).toFixed(2)}" fill="#fff" opacity="${(0.15 + r() * 0.5).toFixed(2)}"/>`;
  return `<svg class="stars" viewBox="0 0 ${w} ${h}">${s}</svg>`;
}

const page = (title, css, body) => `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${title}</title>
<style>${tokens}${css}</style></head><body>${body}</body></html>`;

const frames = {
  // A1: cold open, ~0:06. Paper card mid-lift into 3D; the real globe resolving behind it.
  'A1-cold-open': page('A1 cold open', `
    .persp { position:absolute; left:150px; top:120px; width:780px; height:860px; perspective:1800px; }
    #paper { width:780px; height:850px; background:var(--paper); border-radius:16px; padding:26px 40px;
      transform: rotateX(28deg) rotateY(-16deg) rotateZ(-3deg) translateZ(40px); transform-origin:50% 70%;
      box-shadow: 0 60px 90px rgba(0,0,0,.6), 0 0 0 1px rgba(0,0,0,.08); }
    #paper .pl { font-family:var(--head); font-weight:600; font-size:44px; line-height:1.1; color:#2a2622; margin-bottom:6px; }
    #paper svg { width:700px; height:700px; display:block; }
    .globe { position:absolute; left:1010px; top:160px; width:760px; height:760px; opacity:.85;
      -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 60%, transparent 72%); }
    .big { position:absolute; left:1000px; top:800px; width:840px; font-family:var(--head); font-weight:600; font-size:64px; line-height:1.1; color:#fff; }
    .big .hl { color:var(--sun); }
    .arc { position:absolute; left:860px; top:520px; }
  `, `<div class="stage"></div>${stars(7, 260)}
    <img class="globe" src="${rel('../poster/img/globe.png')}">
    <div class="persp"><div id="paper"><p class="pl">ในหนังสือเรียน · ภาพแบน 2 มิติ</p>${DIAGRAM_SVG}</div></div>
    <svg class="arc" width="220" height="140" viewBox="0 0 300 170"><path d="M 10 140 C 110 170, 220 130, 280 46" fill="none" stroke="#f2b43a" stroke-width="10" stroke-linecap="round"/><path d="M 240 44 L 284 40 L 282 86" fill="none" stroke="#f2b43a" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <p class="big">หนังสือสอนระบบ <span class="hl">3 มิติ</span><br>ด้วยภาพแบน 2 มิติ</p>`),

  // A2: period 2 app shot, ~1:12. Real capture as-is in a floating frame; period disc overlay.
  'A2-period-2': page('A2 period 2', `
    .frame { position:absolute; left:720px; top:110px; width:1100px; border-radius:22px; overflow:hidden;
      box-shadow: 0 50px 100px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.10); transform: perspective(2400px) rotateY(-5deg); }
    .frame img { width:1100px; display:block; }
    .tag { position:absolute; left:96px; top:800px; width:560px; display:flex; align-items:flex-start; gap:26px; }
    .tag .st { font-family:var(--head); font-weight:500; font-size:34px; color:var(--sun); line-height:1.1; }
    .tag .t { font-family:var(--head); font-weight:600; font-size:40px; color:#fff; line-height:1.18; white-space:nowrap; }
    .src { position:absolute; left:96px; top:1010px; font-size:24px; color:var(--cap); }
  `, `<div class="stage"></div>${stars(11, 160)}
    <div class="frame"><img src="${rel('public/captures/p2-day-008.png')}"></div>
    <div class="tag"><div class="num">2</div><div><div class="st">คาบที่ 2 · สำรวจและค้นหา</div><div class="t">ข้างขึ้นข้างแรมหนึ่งรอบเดือน</div></div></div>
    <p class="src">ภาพจาก LUNARIS · คำนวณจากข้อมูลนาซา</p>`),

  // A3: end card, ~2:41. QR to /learn, wordmark, name slots, school, AI line.
  'A3-end-card': page('A3 end card', `
    .word { position:absolute; left:120px; top:250px; font-family:var(--head); font-weight:700; font-size:210px; line-height:.92; letter-spacing:4px; color:#fff; }
    .word b { color:#c75a2a; font-weight:700; }
    .th { position:absolute; left:126px; top:470px; font-family:var(--head); font-weight:600; font-size:64px; color:#fff; }
    .free { position:absolute; left:128px; top:565px; font-size:34px; color:#dde3e9; }
    .names { position:absolute; left:128px; top:660px; display:flex; gap:22px; }
    .slot { width:330px; height:64px; border-radius:12px; background:#3a3f46; color:#c9ced4; font-size:28px; line-height:64px; text-align:center; }
    .logo { position:absolute; left:128px; top:770px; background:#fff; border-radius:16px; padding:16px 26px; }
    .logo img { height:96px; display:block; }
    .qr { position:absolute; left:1300px; top:250px; width:500px; background:var(--cream); border-radius:28px; padding:34px; text-align:center; }
    .qr img { width:432px; height:432px; display:block; }
    .qr p { font-family:var(--head); font-weight:600; font-size:44px; color:var(--rust); margin-top:14px; }
    .fine { position:absolute; left:128px; top:985px; width:1660px; font-size:24px; line-height:1.3; color:var(--cap); }
  `, `<div class="stage"></div>${stars(23, 200)}
    <div class="word">LUNAR<b>IS</b></div>
    <div class="th">ห้องเรียนภารกิจดวงจันทร์</div>
    <div class="free">ใช้ฟรีผ่านเว็บ</div>
    <div class="names"><div class="slot">[ชื่อ ผู้ประดิษฐ์ 1]</div><div class="slot">[ชื่อ ผู้ประดิษฐ์ 2]</div></div>
    <div class="logo"><img src="${rel('../assets/school-logo.png')}"></div>
    <div class="qr"><img src="${rel('../poster/img/qr.png')}"><p>ลองใช้ได้เลย</p></div>
    <p class="fine">พัฒนาโดยใช้ปัญญาประดิษฐ์ช่วยเขียนโปรแกรม ภายใต้การกำกับและตรวจสอบของคณะผู้ประดิษฐ์ · ภาพทั้งหมดจับจากแอป LUNARIS · พื้นผิวดวงจันทร์: NASA SVS · ภูมิประเทศ: NASA LRO LOLA</p>`),

  // C1: direction C (night-sky observatory) for comparison, same moment as A1.
  'C1-cold-open-observatory': page('C1 cold open, observatory', `
    .stage { background: linear-gradient(160deg, #10254a 0%, #0a1630 45%, #050912 100%); }
    .grid { position:absolute; inset:0; background-image: linear-gradient(rgba(242,180,58,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(242,180,58,.07) 1px, transparent 1px); background-size: 120px 120px; }
    .persp { position:absolute; left:560px; top:200px; width:800px; height:860px; perspective:1600px; }
    #paper { width:780px; height:850px; background:var(--paper); border-radius:6px; padding:26px 40px;
      transform: rotateX(48deg) rotateZ(-8deg); transform-origin:50% 60%; box-shadow: 0 0 0 2px rgba(242,180,58,.6), 0 80px 120px rgba(0,0,0,.7); }
    #paper .pl { font-family:var(--head); font-weight:600; font-size:44px; color:#2a2622; margin-bottom:6px; }
    #paper svg { width:700px; height:700px; display:block; }
    .lbl { position:absolute; font-family:var(--head); font-weight:300; font-size:30px; color:var(--sun); }
    .big { position:absolute; left:120px; top:170px; font-family:var(--head); font-weight:300; font-size:60px; color:#fff; }
    .big b { font-weight:600; color:var(--sun); }
  `, `<div class="stage"></div><div class="grid"></div>${stars(5, 340)}
    <div class="persp"><div id="paper"><p class="pl">ในหนังสือเรียน · ภาพแบน 2 มิติ</p>${DIAGRAM_SVG}</div></div>
    <p class="lbl" style="left:120px;top:110px">2 มิติ → 3 มิติ</p>
    <p class="big">หนังสือสอนระบบ <b>3 มิติ</b> ด้วยภาพแบน 2 มิติ</p>`),
};

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  for (const [name, html] of Object.entries(frames)) {
    const f = path.join(H, `${name}.html`);
    fs.writeFileSync(f, html);
    await p.goto('file://' + f);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    const bad = await p.evaluate(() => [...document.fonts].filter((x) => x.status === 'error').map((x) => x.family + x.weight));
    await p.screenshot({ path: path.join(H, `${name}.jpg`), type: 'jpeg', quality: 88 });
    console.log(name, bad.length ? 'FONT ERROR ' + bad : 'ok');
  }
  await b.close();
})();
