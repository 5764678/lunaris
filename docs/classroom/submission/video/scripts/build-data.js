// Validates timeline.json and writes captions-th.srt from it.
// Run: node docs/classroom/submission/video/scripts/build-data.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const tl = JSON.parse(fs.readFileSync(path.join(root, 'timeline.json'), 'utf8'));
const errs = [];
let t = 0;
for (const s of tl.segments) {
  if (Math.abs(s.start - t) > 1e-6) errs.push(`gap/overlap before ${s.id}: ${t} -> ${s.start}`);
  if (!(s.end > s.start)) errs.push(`bad length ${s.id}`);
  if (s.type === 'team' && !s.file) errs.push(`team slot without file: ${s.id}`);
  for (const sh of s.shots || []) if (sh.start < s.start || sh.end > s.end) errs.push(`shot ${sh.id} outside ${s.id}`);
  t = s.end;
}
if (Math.abs(t - tl.duration_s) > 1e-6) errs.push(`segments end at ${t}, not ${tl.duration_s}`);
let prev = 0;
for (const c of tl.captions) {
  if (c.start < prev) errs.push(`caption overlap at ${c.start}`);
  if (c.end - c.start < 1.2) errs.push(`caption too short at ${c.start}`);
  if (c.text.split('\n').length > 2) errs.push(`caption > 2 lines at ${c.start}`);
  prev = c.end;
}
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
const ts = (x) => {
  const ms = Math.round(x * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const srt = tl.captions.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n');
fs.writeFileSync(path.join(root, 'captions-th.srt'), srt);
console.log(`ok: ${tl.segments.length} segments, ${tl.captions.length} captions, ${t} s`);
