# Video design spec, part 2: visual direction and styleframes

Checkpoint 2 of the co-creation flow. Status: **waiting for the TD**.

## Design tokens (from `poster/poster.html`, used as is)

| Token | Value | Use in the video |
|---|---|---|
| space | `#06080b` | stage base |
| navy | `#0d1626` | radial glow on the stage (the brief's "dark navy"; a deepened tint of the poster's card colour `rgba(13,17,23)`) |
| sun | `#f2b43a` | period discs, the 2D→3D arrow, the highlighted words, the sky chart's own Sun line |
| rust | `#a0461e` on cream; `#c75a2a` on dark | "IS" of the wordmark, QR caption. On the dark stage the poster's rust reaches only about 3.2:1 contrast; `#c75a2a` reaches about 4.7:1 and is the only new colour |
| paper | `#f4eddd` | the textbook card (the poster's `#paper`) |
| cream | `#f6f1e7` | QR tile, school logo tile |
| text / cap | `#e9edf2` / `#aab4bf` | body and source lines |
| Heads | Kanit 600–700 | titles, numerals, wordmark |
| Body | Noto Sans Thai 400–500 | source lines, fine print |
| Period disc | 96 px sun disc, dark numeral, 9 px glow ring | the poster's `.num`, scaled for 1080p |

Rules I'm holding to: **no letter-spacing on Thai** (it splits vowels and tone marks from
their consonants; seen in C1's first render and removed); on-screen Thai at least 34 px for
labels and 24 px for fine print; nothing inside 54 px top and bottom or 96 px left and right of
the frame edge (title-safe).

## Three written directions

**A. Poster hero, in motion (recommended).** The poster's dark hero panel becomes the stage:
near-black with a faint navy glow and a sparse, fixed star field; cream paper; sun-gold accents;
Kanit. Camera: slow 2.5D drifts and push-ins, one move per shot, long holds. Why: the judges will
have seen the poster; the film then reads as the same project, not a separate promo. Trade-off:
quiet and dark, so the real app's light UI and the students' faces carry the colour.

**B. Textbook page.** Cream paper as the stage, dark ink, rust accents; the app shots sit flush on
the page and only the globe and the sky go dark. Why it could work: it matches the app's own
light UI. Why not: it drops the brief's navy and rust look, and the cold open loses its contrast
(flat paper lifting off a paper background). No styleframe made.

**C. Night-sky observatory.** Saturated navy gradient, a fine sun-gold grid, thin Kanit 300
headings, the paper tilted steeply as if lying on a chart table. More cinematic and cooler.
Trade-off: the grid and thin type drift away from the poster, and thin Thai at 300 weight reads
less well for a muted audience. One styleframe made for comparison.

## Styleframes (1920×1080, HTML/CSS, Playwright screenshots)

| File | Moment | What it shows |
|---|---|---|
| `styleframes/A1-cold-open.jpg` | 0:06 | The poster's diagram, verbatim (sha256 `df6eea32…` of the `<svg>` in `#paper`, checked by `scripts/extract-diagram.js --check`), mid-lift in 3D; the real globe (`poster/img/globe.png`, from the app) behind it; the claim line |
| `styleframes/A2-period-2.jpg` | 1:12 | Real `/learn/2` capture (day 9, 50 %, 2x) cropped to the Moon, readout and slider, in a floating frame with a slight 5° turn; period disc with the app's own tab text "คาบที่ 2 · สำรวจและค้นหา" and the page title |
| `styleframes/A3-end-card.jpg` | 2:41 | Wordmark, ห้องเรียนภารกิจดวงจันทร์, "ใช้ฟรีผ่านเว็บ", two grey `[ชื่อ]` slots, school logo on a white tile, QR (→ `/learn`) on cream with "ลองใช้ได้เลย", the poster's AI line and image credits |
| `styleframes/C1-cold-open-observatory.jpg` | 0:06 | Direction C at the same moment as A1 |

Rebuild: `node scripts/fetch-fonts.js && node scripts/capture.js stills && node design/styleframes/build.js`
(from `docs/classroom/submission/video/`, or with those paths from the repo root).

Notes from the captures:
- The `/learn/2` crop keeps the app's NASA SVS credit line (English, small). It is a source
  credit, not UI chrome, so I'd keep it; say if you want it cropped.
- The `/learn/4` chart's axis labels are Thai in the app, so no overlay is needed.
- The globe canvas from `/` has a faint background grid even with "Grid" off. In the film it sits
  under a radial vignette, as in A1.

## Questions for the TD

1. Direction A? (B and C are there for contrast; I'd not mix them.)
2. The single extra colour, rust lifted to `#c75a2a` on dark backgrounds: OK?
3. End card: anything to add or drop? It holds for 4 s or more and the QR is 432 px, which
   scans from a laptop screen at arm's length.

Next, after your answers: function-to-shot mapping from the skill's shot cards (Gallery names,
exact demo sources), then the full storyboard with frame timings.
