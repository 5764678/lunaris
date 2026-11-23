// Counts the globe-orbit frames and writes src/generated/orbit.json (P4 reads it).
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../public/captures');
const n = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^globe-orbit-\d{3}\.png$/.test(f)).length : 0;
fs.writeFileSync(path.join(__dirname, '../src/generated/orbit.json'), JSON.stringify({ frames: n }) + '\n');
console.log('orbit frames:', n);
