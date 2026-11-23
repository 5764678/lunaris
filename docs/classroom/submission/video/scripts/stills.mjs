// Renders single frames of a composition with one bundle. Used for QA and the contact sheet.
// Run from video/: node scripts/stills.mjs <Composition> <outDir> <frame> [frame...]
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
const [comp, outDir, ...frames] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public') });
const browserExecutable = process.env.REMOTION_BROWSER || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const composition = await selectComposition({ serveUrl, id: comp, browserExecutable });
for (const fr of frames.map(Number)) {
  const output = path.join(outDir, `${comp}-${String(fr).padStart(5, '0')}.jpg`);
  await renderStill({ serveUrl, composition, frame: fr, output, imageFormat: 'jpeg', jpegQuality: 88, browserExecutable });
  console.log(output);
}
