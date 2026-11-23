# Video design spec, part 3: shot mapping and storyboard

Checkpoints 3 and 4 of the co-creation flow, sent together as the TD asked on 22 Nov.
Status: **waiting for the TD**. Contact sheet: `design/storyboard-contact-sheet.jpg` (one frame per
shot, time range under each, captions shown where planned). Frame-level timing lives in
`timeline.json`; this file explains the choices.

## TD decisions at checkpoint 2 (recorded)

Direction A. Rust `#c75a2a` on the dark stage only; the poster's `#a0461e` wherever paper or
cream is behind it. End card gains a third grey slot `[ครูที่ปรึกษา]`. The NASA SVS credit stays in
the `/learn/2` crop. P2: slow push on the Moon while the day advances, with the `% ส่วนสว่าง`
readout and the slider kept readable.

## Function → shot mapping

Cards come from the skill's Gallery index (`gallery/api/library.json`), read in full, with the
demo source named in each card's "参考实现". Where no card fits, the move is the skill's
`assets/lib/PageCam.tsx` camera (flat mode) on a real capture.

| Function | Shot | Card · style | Demo source | Why this one | Alternative considered |
|---|---|---|---|---|---|
| Claim line, hook text, titles, end card text | 1a, 3a, 3b, 6, period labels | `blur-slide` | `demos/typography/blur-slide/BlurSlide.tsx` | The card is the low-energy default title reveal; the film has no other text hero | `letterspace-materialize` for the wordmark: needs hand-drawn skeleton glyphs and 0.6 em tracking, which would change the poster's Kanit wordmark |
| 2D page becomes 3D | 1b | `overhead-camera-moves · tilt-reveal` | `demos/camera/overhead-camera-moves/TiltReveal.tsx` | The page's pitch angle tells the 2D→3D story; same 43 f out-cubic move and ≤ 3° overshoot, run toward the tilt | `space-camera-moves` (high energy, "big move" budget) |
| Real app views (P2, P4 chart, P5 table) and the terrain/globe holds | 1c, 3a, p2, p4b, p5a/c | PageCam (assets/lib) | `assets/lib/PageCam.tsx` | Real captures with a slow, eased 2.5D push: the app's own pixels carry the shot | `spotlight-sweep-moves`: its identity is a purple edge glow, off-palette |
| "Every number shows where it came from" | p5b | `speed-ramp-freeze · freeze-annotate` | `demos/rhythm/speed-ramp-freeze/FreezeAnnotateReal.tsx` | The card is meant for teaching: stop, circle the number, thaw. Circle 8 f with feTurbulence scale 7, arrow 6 f, 8 f fade, as in the demo | A plain zoom: doesn't say "tap here" |
| Proof numbers and limits | 5a, 5b | `paper-title-card` | `demos/typography/paper-title-card/PaperTitleCard.tsx` | Paper ties back to the textbook page of the cold open; 1.28 → 1 press, one accent, underline, DigitRoll on "49" | `odometer-digit-roll`: too loud for an honesty beat |

Deviations from the demos, kept as small as the material allows:
- blur-slide: Thai has no spaces, so words are split by meaning by hand (as the card says). The
  offset and blur scale with font size from the demo's design space.
- paper-title-card: Kanit has no italic and slanted Thai reads badly, so the accent is colour only;
  each card holds 5 s instead of 1.8 s because the voice runs over it and muted viewers need the
  reading time (aesthetic rule R3).
- tilt-reveal: reversed direction (toward the tilt), overshoot pattern kept.
- Aesthetic rule Q8 (outro as an energy peak) is deliberately not followed: the brief asks for a
  calm film that backs the students.

## Storyboard

| # | Time | Shot | What is on screen | Source of the imagery | Voice / caption | SFX cue |
|---|---|---|---|---|---|---|
| 1a | 0:00.0–0:05.5 | Paper flat to camera | Poster's textbook diagram on its paper card; "หนังสือสอนระบบ 3 มิติ / ด้วยภาพแบน 2 มิติ" blurs in | `poster.html` #paper SVG, verbatim (sha256 `df6eea32…`) | music only | — |
| 1b | 0:05.5–0:09.5 | Page lifts into 3D | Card tilts back 28° / −16°, recedes; globe rises behind | same SVG; `poster/img/globe.png` (LUNARIS, NASA SVS) | music only | paper-move-quick 5.5 s |
| 1c | 0:09.5–0:15.0 | Globe holds | Arc arrow page → globe; slow push | same | music only | light-aura 9.6 s |
| s2 | 0:15.0–0:40.0 | TEAM `02-intro.mp4` | Grey slate | team | B, A (4 captions) | — |
| 3a | 0:40.0–0:50.5 | Hook | Chip, "ฉางเอ๋อ 7 / เลื่อนไปปี 2570", two lines, "ที่มา: สดร. 24 ส.ค. 2569" over the terrain | `poster/img/terrain.jpg` (LUNARIS Pole terrain, LRO LOLA) | B (2) | air-woosh-quick 40.2 s |
| 3b | 0:50.5–0:58.0 | Title | Terrain dims; LUNARIS lands on A's word at 54.8 s, then ห้องเรียนภารกิจดวงจันทร์; 3 s hold | same | A (2) | — |
| P1 | 0:58.0–1:06.0 | TEAM `p1-lamp-ball.mp4` + disc 1 | Slate; "คาบที่ 1 · สร้างความสนใจ" | team | B | — |
| P2 | 1:06.0–1:20.0 | `/learn/2` | Days 1→16 (0 % → 100 %), one day per 19 f; push keeps % and slider in frame | `captures/p2-day-000…015.png` | A (2) | — |
| P3 | 1:20.0–1:26.0 | TEAM `p3-worksheet.mp4` + disc 3 | Slate | team | B | — |
| P4a | 1:26.0–1:32.0 | Globe toward the pole | Real orbit, 41 mouse-drag frames from South polar, HUD hidden | `captures/globe-orbit-000…040.png` (from `/`) | A | — |
| P4b | 1:32.0–1:42.0 | Sky chart | Chart in a frame; Thai heading, stand point, legend in poster style; slow pan along the Sun line | `captures/sky-chart.png` (`/learn/4`, Thai axis labels are the app's) | A | — |
| P5a | 1:42.0–1:46.0 | Table | Three-site table, slow push | `captures/p5-page-before.png` | B | — |
| P5b | 1:46.0–1:48.0 | Tap + freeze | Cursor taps 88.3 %, rust marker circle and arrow | same + drawn cursor and circle | B: "ทุกตัวเลขกดดูได้ว่ามาจากไหน" | — |
| P5c | 1:48.0–1:58.0 | Evidence | Evidence panel opens (real), hold, ease back to the three columns | `captures/p5-page-after.png` | B | — |
| P6 | 1:58.0–2:08.0 | TEAM `p6-present.mp4` + disc 6 | Slate | team | A | — |
| s5 | 2:08.0–2:12.0 | TEAM `05-proof.mp4` | Slate | team | A | — |
| 5a | 2:12.0–2:17.0 | Proof card 1 | "เวลาข้างขึ้นข้างแรม ต่างจาก JPL Horizons ของนาซา / ไม่เกิน 2 วินาที / ตรวจเทียบเวลาข้างขึ้นข้างแรมหลัก 49 ครั้ง" | drawn (text only) | A continues | — |
| s5 | 2:17.0–2:25.0 | TEAM `05-proof.mp4` | Slate (AI line on camera) | team | A, B | music out 142–143 s |
| 5b | 2:25.0–2:30.0 | Proof card 2 | "ยังไม่จำลองน้ำขึ้นน้ำลง / ยังไม่ได้ทดลองกับนักเรียน / ซึ่งเป็นขั้นต่อไปของเรา" | drawn (text only) | B continues | — |
| s5 | 2:30.0–2:33.0 | TEAM `05-proof.mp4` | Slate | team | B | — |
| s6 | 2:33.0–2:39.0 | TEAM `06-close.mp4` + QR tile | QR tile slides in at 2:35 | `poster/img/qr.png` (→ `/learn`) | A, A+B | — |
| 6 | 2:39.0–2:45.0 | End card | Wordmark, ห้องเรียนภารกิจดวงจันทร์, ใช้ฟรีผ่านเว็บ, `[ชื่อ]` ×2, `[ครูที่ปรึกษา]`, school logo, QR, AI line and credits; fade from 2:44.4 | `assets/school-logo.png`, `qr.png` | music | paper-page-turn 159.0 s |

Holds: wordmark 3 s (≥ 1 s), end card ≥ 4 s, proof cards 5 s, every period label ≥ 5 s.
On-screen text: labels ≥ 34 px, fine print 32 px (≥ 3 % of frame height, rule Q11); captions in the
animatic 54 px (≥ 5 %).

## Things for you to look at

1. **P5 evidence panel shows English.** The app labels it "ข้อความด้านล่างสร้างโดยแกนคำนวณ
   จึงเป็นภาษาอังกฤษ" (the engine writes it in English). The panel title, the value and "ชนิด:
   การคำนวณ" are Thai and readable; the English lines are small. Your P4 rule was "no English UI";
   I've treated P5 as the honest view of the app. Say if you want the camera to stop above the
   English lines instead.
2. **Overlays on team footage.** The period discs and the QR tile also ride over the team's clips.
   I'll render an `Overlays` layer on transparency (the composition exists) as WebM with alpha on the
   renders branch, so you can composite them with ffmpeg.
3. **Survey line.** If B adds the survey sentence in §5, the slot 2:17–2:25 grows; `timeline.json`
   will need the later segments shifted. I've left it out until there is a real number.
4. **Thai line breaks in captions** are mine, at phrase boundaries; the team may word lines
   differently, so you re-time from their takes anyway.

## After approval

Production: full `Graphics` render (H.264, CRF 20), `Animatic` at 720p with captions, the overlay
layer, frame extraction QA, then the renders branch and the draft PR. Animatic first.

## Change, 23 Nov (TD, from the team)

- No team live-action slots any more. Three graphics replace them, made only from the project's
  own material:
  - **P1 0:58–1:06, lamp-ball model.** Drawn in the poster's period-1 style and colours. A lamp
    (Sun) on the left, the head (observer) in the middle facing the ball, and the ball (Moon)
    circling once from new Moon. The ball's lit hemisphere always faces the lamp (vector ball →
    lamp, finite distance). The inset shows what the observer sees: lit fraction (1 + cos α)/2,
    with α the angle between ball → lamp and ball → head. The lit limb sits on the observer's
    right when the lamp is to the right of the line of sight.
    - Note: the poster's own drawing shows the ball between the bulb and the head as a full white
      disc. Seen from above, only its lamp-facing half is lit, so the video draws that half. The
      poster may want the same fix.
  - **P3 1:20–1:26, worksheet.** The top of `docs/classroom/kit/worksheet-1.md`, rendered as a
    printed A4 page by `scripts/render-worksheet.js`. Slow push-in; abstract scribble lines draw
    into three answer cells of the first table. Nothing readable is written.
  - **P6 1:58–2:08, C/E/R then poster.** The poster's C/E/R list built as three cards. Then a slow
    pan over `poster/lunaris-poster-A0-preview.jpg`, cropped at y = 2150, above the placeholder
    footer, which starts at about 2160.
- Face clips are one person per file:
  - §2: `02-intro-B.mp4` 0:15–0:23, then `02-intro-A.mp4` 0:23–0:40.
  - §5: `05-proof-A.mp4` 2:08–2:23, with card 1 at 2:12–2:17; then `05-proof-B.mp4` 2:23–2:33,
    with card 2 at 2:25–2:30.
  - §6: `06-close-A.mp4` 2:33–2:37, with the QR tile from 2:34.6; then the 2-up slot `06-close-AB`
    2:37–2:39; then the end card.
- B's §5 line now ends "…และยังไม่ได้ทดลองกับนักเรียนในห้องเรียนจริง ซึ่งเป็นขั้นต่อไปของเราครับ"
  (script commit 46fa79b). Card 2 reads "ยังไม่จำลองน้ำขึ้นน้ำลง / ยังไม่ได้ทดลองกับนักเรียนในห้องเรียนจริง".
- Captions for §2 and §5 are re-timed to the new clip boundaries. The total is still 2:45.
