// Copies the poster's committed images into public/ (copies are not committed).
const fs = require('fs'), path = require('path');
const sub = path.join(__dirname, '../..');
const pub = path.join(__dirname, '../public');
fs.mkdirSync(pub, { recursive: true });
for (const [from, to] of [['poster/img/globe.png', 'globe.png'], ['poster/img/terrain.jpg', 'terrain.jpg'], ['poster/img/qr.png', 'qr.png'], ['assets/school-logo.png', 'school-logo.png']]) {
  fs.copyFileSync(path.join(sub, from), path.join(pub, to));
}
console.log('copied poster assets to public/');
// p5 camera keys read this layout (written by capture.js p5); committed copy lives in src/generated.
const lay = path.join(pub, 'captures/p5-layout.json');
if (fs.existsSync(lay)) fs.copyFileSync(lay, path.join(__dirname, '../src/generated/p5-layout.json'));
