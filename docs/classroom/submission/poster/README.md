# Poster (A0, visual first)

The A0 poster for the Chulalongkorn University Innovative Award 2570, laid out on the
organisers' student template (`../poster-template-students.pdf`).

- `lunaris-poster-A0.pdf`: the A0 file (841 × 1189 mm, one page), **with placeholders**.
- `lunaris-poster-A0-preview.jpg`: a preview of the same file.
- `poster.html`: the source. Coordinates are template raster pixels (3889 × 5500); the sheet
  is scaled to A0 when printed.

## Fill in before submitting

The names and contacts are placeholders and must not be committed: `{{INVENTORS}}`,
`{{ADVISOR}}`, `{{PHONE}}`, `{{EMAIL}}`. The student line under
the headline is the team lead's own words, translated (`docs/classroom/submission/team-story.md`
on branch `claude/laughing-einstein-jc00pz`), as supplied by the TD. Replace them in a local copy of `poster.html`, run
`render.js`, and upload that PDF. Scan the QR code with two phones first.

## Rebuild

```sh
node docs/classroom/submission/poster/capture.js   # live app -> captures/ (the API can take ~1 min to wake)
python3 docs/classroom/submission/poster/prep.py   # captures/ -> img/, QR code (needs Pillow, qrcode)
node docs/classroom/submission/poster/render.js    # -> PDF + preview; prints checks
```

`render.js` downloads the fonts (Kanit, Noto Sans Thai; SIL Open Font License) from Google
Fonts and extracts the template raster from the organisers' PDF. It prints anything outside
the white panel, any box whose content overflows, and a word count.

## Visuals and where they come from

| Visual                         | Source                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Moon globe (hero, top right)   | LUNARIS Overview page, "South polar" view, labels, sites and grid off; NASA SVS surface         |
| Pole terrain (hero background) | LUNARIS Overview page, "Pole terrain" view; NASA LRO LOLA relief                                |
| Eight Moon phases (step 2)     | `/learn/2`, Moon canvas at days 1, 5, 8, 12, 16, 19, 23, 27; the % is the app's own readout     |
| Sky chart (step 4)             | `/learn/4`, the chart itself; the app's axis text is cropped and re-labelled at a readable size |
| Sunlight bars (step 5)         | drawn from `apps/web/public/lesson-pack/v1/compare/default.json` (`sun_illuminated_fraction`)   |
| "Textbook" phase diagram       | drawn: flat 2D diagram in textbook style (the poster's 2D → 3D idea); phases checked by hand    |
| Bulb-and-ball model (step 1)   | drawn                                                                                           |
| Lit-half diagram (step 3)      | drawn: each Moon lit on the Sun side; the "Earth's shadow" idea crossed out                     |
| Icons, star dots               | drawn (stars are decoration only)                                                               |
| School logo                    | `../assets/school-logo.png`                                                                     |
| QR code                        | generated locally (`prep.py`, python `qrcode`) for `https://lunaris-demo.onrender.com/learn`    |

All app captures were taken from https://lunaris-demo.onrender.com on 22 November 2026 with
Playwright at device scale factor 3 (the Overview page at 2). No stock or AI-generated images.

## Pre-print checks

`render.js` also prints the effective resolution of every image at A0 (lowest: terrain at about
150 PPI; the template raster itself is about 117 PPI). Text contrast (WCAG) is at least 4.5:1
everywhere and at least 6:1 for body text.

## Claims and numbers

| On the poster                                                    | Source                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Chang'e 7 postponed to 2570; lighting at the landing site (สดร.) | `../entry-form-part2.md` section 1 (NARIT, 24 Aug 2026)                |
| Background, objectives                                           | `../entry-form-part2.md` sections 1–2, `../poster-content.md`          |
| 6 periods, 5E stages, what students do                           | `docs/classroom/kit/README.md`                                         |
| 3 worksheets, 20-item two-tier test, CER rubric, teacher guide   | `docs/classroom/kit/README.md`                                         |
| Phase % 0, 14, 39, 81, 100, 85, 46, 13                           | the app's readout on `/learn/2` (lesson pack ephemeris)                |
| Sunlit 88 % / 74 % / 46 % over 2570                              | `compare/default.json`: 0.883, 0.735, 0.464 (2027-01-01 to 2028-01-01) |
| Sky chart: Peak near Shackleton, one month                       | `/learn/4` (7 Jan – 6 Feb 2570)                                        |
| ≤ 2 s on 49 principal phases                                     | `docs/SCIENCE.md`, phase validation table (max 1.98 s)                 |
| ≤ 0.002″ Sun and Earth direction                                 | `docs/SCIENCE.md` §5.2 (Earth 0.0017″; one site, 25 samples)           |
| No tides; phases geocentric; not yet tried with students         | `docs/classroom/kit/README.md`, `../poster-content.md`                 |
| "ภาพจาก LUNARIS คำนวณจากข้อมูลนาซา" (renders, not photographs)     | the app renders the Moon from NASA SVS texture and SPICE geometry |
| "Light is 1 of 7 criteria; no site is best on every count"       | `/learn/5` table (7 rows), `kit/teacher-guide.md` ("ค่าทั้ง 7 ค่า"); `compare/default.json` leaders differ by criterion |
| "Textbooks teach a 3D system with flat 2D pictures"               | the students' account, via the TD (22 Nov 2026)                |
| Highlights 1–4, users, use and benefits                          | `../entry-form-part2.md` sections 5–7                                  |
