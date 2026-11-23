// Kanit + Noto Sans Thai (SIL OFL) from Google Fonts into video/fonts and public/fonts (neither committed).
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
for (const d of ['fonts', 'public/fonts']) fs.mkdirSync(path.join(root, d), { recursive: true });
for (const spec of ['Kanit:wght@300;500;600;700', 'Noto+Sans+Thai:wght@400;500;700']) {
  const css = execFileSync('curl', ['-sS', `https://fonts.googleapis.com/css2?family=${spec}`]).toString();
  for (const m of css.matchAll(/font-family: '([^']+)';[\s\S]*?font-weight: (\d+);[\s\S]*?url\((\S+?)\)/g)) {
    const f = path.join(root, 'fonts', `${m[1].replace(/ /g, '')}-${m[2]}.ttf`);
    if (!fs.existsSync(f)) execFileSync('curl', ['-sS', '-o', f, m[3]]);
    fs.copyFileSync(f, path.join(root, 'public/fonts', path.basename(f)));
  }
}
console.log(fs.readdirSync(path.join(root, 'fonts')).join(' '));
