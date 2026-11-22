# Video design spec, part 1: product brief and decisions

Checkpoint 1 of the co-creation flow (video-shotcraft, `references/guided-free-creation.md` §1–2).
Status: **waiting for the TD**. Plan of record: `docs/classroom/submission/video-script.md` v2
(commit 8567738, on `claude/laughing-einstein-jc00pz`; `main` still has the v1 draft).

What I looked at, read-only: the v2 script, `poster/poster.html` and its preview, `poster/README.md`,
`poster/prep.py` (QR target), `docs/SCIENCE.md` (49 events, max 1.98 s), the skill's
`assets/audio/ATTRIBUTION.md`, and the live app at 1920×1080 (`/`, `/learn/2`, `/learn/4`, `/learn/5`).
Nothing was captured for production yet.

## 1. Product brief

| Item | My read or recommendation | Evidence |
|---|---|---|
| What it is | A 6-period 5E lesson kit for M.3 on Moon phases and the lunar south pole, run in a free web app that computes the Moon from NASA data | poster subtitle; `/learn/1–6` tabs |
| Audience of the video | Education faculty judging a secondary-level student entry; they watch muted often | script, "Why the video looks like this" |
| Job of the video | Back the students, not replace them. Graphics only where they explain better than a person: 2D→3D, the Chang'e 7 hook, three app views, two number cards, the end card | script, "Who makes what" |
| Core idea on screen | **หนังสือสอนระบบ 3 มิติ ด้วยภาพแบน 2 มิติ** → LUNARIS lets you rebuild it and turn it | poster hero, script §1 |
| Must show (mine) | §1 cold open; §3 hook + title; app shots P2, P4, P5; number overlays 1–6; §5 two proof cards; §6 end card | brief |
| Usable app states | `/learn/2`: Moon canvas, day slider 1–30 (Jan 2027 lunation), "เดินหน้าหนึ่งวัน" button, % readout. `/learn/4`: dark sky chart, Sun (orange) skimming the LOLA horizon, Earth (blue) loop, Thai axis labels. `/learn/5`: 3-site table (Connecting ridge, Malapert massif, Peak near Shackleton), each number a button that opens its evidence. `/`: globe with "South polar" / "Pole" presets and "Pole terrain" | live app, 22 Nov |
| Opening claim | The textbook problem, in the poster's own words and drawing | claims list row 2 |
| Length / frame / language | 2:45 (165.0 s), 1920×1080, 30 fps, Thai on screen; captions as a separate SRT | brief |
| Music / voice | Students' own voices only, recorded by the team. **No AI voice, no TTS.** One quiet music bed 18–20 dB under the voices, mixed by the TD. I render no audio; I write `audio-cues.json` | brief; TD message 22 Nov |
| Data | All on-screen data is the app's public demo data and the poster's NASA/NARIT-sourced figures. No personal data. Students' names never in the repo: grey `[ชื่อ]` slots | brief |
| Visual cues | Poster tokens: space `#06080b`, rust `#a0461e`, sun `#f2b43a`, earth `#7db3ff`, cream `#f6f1e7`, caption grey `#aab4bf`; Kanit 500–700 for heads, Noto Sans Thai 400–500 for body; numbered rust/sun discs for periods; dotted sun-gold path lines | `poster.html` lines 26–29, 80–135 |

## 2. Requirement → execution decisions

| Confirmed need | Evidence | What it drives | My recommendation | Open? |
|---|---|---|---|---|
| Purpose: back two students | script | Graphics stay calm; nothing competes with faces | Low-energy motion: slow 2.5D push-ins, one hero move per shot, long holds. No slams, no glitch type, no whooshes over voices | no |
| Audience: education faculty, often muted | script | Caption load, reading time | Every on-screen card holds ≥ 2.5 s after it lands; on-screen text ≤ 2 lines; captions as SRT, burned by the TD | no |
| Cold open, 2D → 3D | poster `#paper` SVG, TD-verified geometry | The signature shot | Re-use the poster SVG **byte-for-byte** (same viewBox 0 0 800 800, same circles and paths). The paper card lifts and tilts in 3D (CSS 3D on the whole card, no redraw), then dissolves into the real globe capture from `/` | no |
| Hook card §3 | poster `#hook`, NARIT 24 Aug 2026 | Text and source line | Chip "โจทย์จริงจากอวกาศ", "ฉางเอ๋อ 7 → เลื่อนไปปี 2570", source "ที่มา: สดร. 24 ส.ค. 2569", over the poster's own `terrain.jpg` (LOLA relief from the app). Then title LUNARIS + ห้องเรียนภารกิจดวงจันทร์ | no |
| App shots P2, P4, P5 | live app | Capture plan | Real captures only, 1920×1080 @2x, Playwright. P2: `recordVideo` or a frame sequence of the day slider 1 → 15 (new → full), then a slow push-in on the Moon canvas. P4 and P5 below | **Q2** |
| Number overlays 1–6 | poster `.card .n` discs | Overlay style | Rust disc with white Kanit 700 numeral + "คาบ N · stage" label, bottom-left, the same on live-action (P1, P3, P6) and app shots | no |
| Proof cards §5 | claims list | Exact wording | Card 1 "≤ 2 วินาที" big + "เทียบ JPL Horizons ของนาซา · 49 เหตุการณ์". Card 2 "ยังไม่จำลองน้ำขึ้นน้ำลง · ยังไม่ได้ทดลองกับนักเรียน". Nothing else | no |
| End card §6 | poster `#qr`, `#foot` | Content | QR (`poster/img/qr.png`, → `/learn`), LUNARIS wordmark, ห้องเรียนภารกิจดวงจันทร์, two grey `[ชื่อ]` slots, school logo (`submission/assets/school-logo.png`), AI line as on the poster: "พัฒนาโดยใช้ปัญญาประดิษฐ์ช่วยเขียนโปรแกรม ภายใต้การกำกับและตรวจสอบของคณะผู้ประดิษฐ์". Hold ≥ 4 s, scannable | no |
| Team slots | recording guide | Placeholders | Grey slate (#3a3f46) with the expected file name, section and line count; no faces, no stock | no |
| Music and SFX | ATTRIBUTION.md; TD 22 Nov | `audio-cues.json` only | See **Q1**. SFX: at most 4 soft cues in the whole film (paper lift, title land, end card), all from ATTRIBUTION entries with URLs, none under speech | **Q1** |
| Beat sync | skill §5 | Cut timing | Voice-led, not beat-led: cuts sit on line ends from the script. If a bed is chosen I give its BPM from ATTRIBUTION and align only the 3 graphic-section starts to bars | follows Q1 |
| Data safety | live app | Capture hygiene | Crop out the app's header clock and "API Waking up" chip; wait for the API before capturing; no site added or user data typed | no |
| Visual direction | poster | Styleframes next | Poster hero look: near-black space, sun-gold accents, rust numerals, Kanit. The app's light cream UI stays **as captured** inside a floating, softly shadowed frame on that dark stage; I don't recolour the app | **Q3** |

## 3. Questions for the TD

**Q1. Music bed.** The only ATTRIBUTION BGM entries with URLs are `cat-walk` (house, ~129 BPM),
`house-vibez` (house, ~123) and `tonight-hiphop` (hip-hop, ~103). None is a "quiet track"; a
house beat under two M.4 students talking about a lesson will read as a promo.
Recommendation: you pick a quiet ambient or piano track with a written free licence (Mixkit's
own catalogue has many) and I write its cues by duration only. Fallback if you prefer to stay
inside ATTRIBUTION: `tonight-hiphop` at −22 dB with the drums low-passed, under §1, §3 and §6 only,
silent under §2, §4 and §5. Third option: no music at all, SFX only.

**Q2. Period 4 "3D globe turning to the south pole".** `/learn/4` has no globe, only the sky chart.
The globe is on the Overview page `/` (presets "South polar" → "Pole"), whose chrome is English.
Recommendation: capture the canvas only from `/` with the HUD hidden (the poster's own method in
`capture.js`), ease from "South polar" to "Pole" (about 6 s), then cut to the `/learn/4` chart
cropped to the plot with its Thai labels (about 10 s). OK?

**Q3. App UI inside the dark film.** Recommended as above: real light UI, cropped to the main
column (no header clock, no sidebar), in a frame on the dark stage. Alternative: full-bleed app
captures, which look like a screen recording and break the poster look. OK to go with the frame?

## 4. Next, after your answers

Visual direction: up to 3 written directions, then 2–3 HTML styleframes at 1920×1080 (cold open
mid-tilt, the P2 app shot with overlay, end card), screenshotted with Playwright, committed under
`video/design/styleframes/`.

## 5. TD decisions, 22 Nov (checkpoint 1 closed)

- Everything listed as decided is approved.
- **Q1:** no bundled track. A quiet ambient or piano bed, supplied by the team with a written free
  licence at assembly, is cued by duration only: in at §1, under §3, low under §4 (about −24 dB
  relative to the voice), out before §5's honesty line, back for §6 and the end card. If no track
  arrives, the video ships with SFX only. At most 4 soft SFX, from ATTRIBUTION entries with URLs.
- **Q2:** approved. The globe canvas from `/` with the HUD hidden, South polar → Pole over about
  6 s, then the `/learn/4` chart cropped to the plot for about 10 s. No English UI text in either.
  The chart's axis labels are already Thai in the app (checked in the 22 Nov capture).
- **Q3:** approved. Light app UI kept exactly as captured, in a floating frame, no recolouring.
