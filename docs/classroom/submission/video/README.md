# LUNARIS presentation video: graphics timeline (Remotion)

The graphics, timing and captions for the 2:45 presentation video
(`../video-script.md` v2). The students' clips and voices are recorded by the team and assembled
by the TD; this project renders grey labelled slates in those slots and never contains a face,
a name or a voice. **No audio is rendered here** (no AI voice, no TTS, no music files); the TD
mixes from `audio-cues.json`.

## Files

| Path | What |
|---|---|
| `timeline.json` | The single source of timing: every segment (id, start, end, type `graphics` or `team`, the team's expected file name), the shots inside graphics segments, the overlays and the captions. |
| `captions-th.srt` | Every Thai line from the script at its planned time. Generated from `timeline.json` by `scripts/build-data.js`; the TD burns it in at assembly. |
| `audio-cues.json` | Music bed cues (gain relative to the voice bus, fades) and 4 SFX cues with their Mixkit source URLs. |
| `AUDIO.md` | Audio sources and licences. |
| `design/` | Design spec: `01-brief.md`, `02-direction.md`, `03-storyboard.md`, styleframes, the storyboard contact sheet. |
| `src/` | Remotion compositions: `Graphics` (1080p, no captions), `Animatic` (captions burned in), `Overlays` (period numbers and QR tile on transparency). |
| `src/generated/diagram.ts` | The poster's textbook diagram, copied verbatim from `../poster/poster.html` (`#paper` svg). |
| `scripts/` | Capture, fonts, asset copy, data build, stills and contact sheet. |

Renders live only on the branch `claude/video-renders` (never merged). `node_modules/`, `out/`,
fonts and captures are gitignored.

## Build

Needs Node 22, the preinstalled Playwright Chromium, ffmpeg (for QA only) and network access to
Google Fonts and the live app.

```sh
cd docs/classroom/submission/video
npm ci
npm run prep          # fonts (Kanit, Noto Sans Thai; SIL OFL), poster assets, diagram copy,
                      # timeline check + SRT, live-app captures (the free host can take ~1 min to wake)
node scripts/capture.js orbit      # included in prep; re-run alone if the globe frames look wrong
node scripts/orbit-count.js
npm run check-diagram # fails if the diagram copy differs from poster.html
```

Rendering uses the machine's Chromium headless shell instead of downloading one:

```sh
export REMOTION_BROWSER=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
npm run animatic      # out/animatic-720p.mp4  1280x720, captions burned in
npm run render        # out/graphics-1080p.mp4 1920x1080, H.264 CRF 20, no captions
npx remotion render src/index.ts Overlays out/overlays-alpha.webm --codec vp9 --image-format png --pixel-format yuva420p --muted --concurrency 1
npm run studio        # interactive preview
```

`npm run render` and `npm run animatic` call `scripts/render-chunks.sh`: 900-frame chunks, each in
a fresh process at `--concurrency 1` with up to 3 retries, joined with ffmpeg's concat demuxer
(no re-encode). A single long render stalls when Remotion recycles its tab mid-render (around
frame 1800 here) and the new tab's font load never returns.

QA: `node scripts/stills.mjs Graphics out/qa <frame> ...` renders single frames;
`python3 scripts/contact-sheet.py` rebuilds `design/storyboard-contact-sheet.jpg`.

## Assembly notes for the TD

- Times in `timeline.json` are seconds at 30 fps; segments tile 0–165 s with no gaps.
- `overlays-alpha.webm` is full length and aligned to 0:00: lay it over the assembled picture
  (`-c:v libvpx-vp9` decoder for the alpha), for example
  `ffmpeg -i assembled.mp4 -c:v libvpx-vp9 -i overlays-alpha.webm -filter_complex "[0][1]overlay" ...`.
- Team slots keep their planned length; if a take differs, trim inside the slot or shift later
  segments and re-time `captions-th.srt` from the same file.
