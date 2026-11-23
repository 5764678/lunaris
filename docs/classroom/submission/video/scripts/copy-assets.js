// Copies the poster's committed images into public/ (copies are not committed).
const fs = require('fs'), path = require('path');
const sub = path.join(__dirname, '../..');
const pub = path.join(__dirname, '../public');
fs.mkdirSync(pub, { recursive: true });
for (const [from, to] of [['poster/img/globe.png', 'globe.png'], ['poster/img/terrain.jpg', 'terrain.jpg'], ['poster/img/qr.png', 'qr.png'], ['assets/school-logo.png', 'school-logo.png']]) {
  fs.copyFileSync(path.join(sub, from), path.join(pub, to));
}
// The P6 pan uses the poster preview at a fixed commit: 21530d1 (claude/laughing-einstein-jc00pz) corrects the
// period-1 drawing. Read from git so this branch does not carry a copy of the poster; fall back to the working tree.
const POSTER_REF = process.env.POSTER_REF || '21530d1';
const { execFileSync } = require('child_process');
try {
  const buf = execFileSync('git', ['show', `${POSTER_REF}:docs/classroom/submission/poster/lunaris-poster-A0-preview.jpg`], { cwd: sub, maxBuffer: 64 << 20 });
  fs.writeFileSync(path.join(pub, 'poster-preview.jpg'), buf);
  console.log('poster preview from', POSTER_REF);
} catch (e) {
  console.warn(`poster ref ${POSTER_REF} not available (git fetch origin claude/laughing-einstein-jc00pz); using the working tree`);
  fs.copyFileSync(path.join(sub, 'poster/lunaris-poster-A0-preview.jpg'), path.join(pub, 'poster-preview.jpg'));
}
console.log('copied poster assets to public/');
// p5 camera keys read this layout (written by capture.js p5); committed copy lives in src/generated.
const lay = path.join(pub, 'captures/p5-layout.json');
if (fs.existsSync(lay)) fs.copyFileSync(lay, path.join(__dirname, '../src/generated/p5-layout.json'));
