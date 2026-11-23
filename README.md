# LUNARIS video renders (not for merging)

Renders of the graphics timeline from `docs/classroom/submission/video/` on `claude/video-source`.
This branch only carries output files and is never merged.

| File | What | Built from |
|---|---|---|
| `graphics-1080p.mp4` | 1920×1080, 30 fps, 4950 frames (2:45.0), H.264 High CRF 20, 31 MB, no audio, no captions. Grey labelled slates in the team slots (face clips only, one person per file; 06-close-AB is 2-up); period numbers, name slots and QR tile composited. | e8faac4 |
| `overlays-alpha.webm` | 1920×1080, 30 fps, 2:45, VP9 with alpha (yuva420p), 1.4 MB. Period numbers 1–6, grey [ชื่อ] lower thirds (0:15–0:19 B, 0:23–0:27 A) and the QR tile (2:31–2:34), on transparency, aligned to 0:00. Decode with `-c:v libvpx-vp9` to keep the alpha. | e8faac4 |
| `animatic-720p.mp4` | 1280×720, 30 fps, 2:45, H.264 CRF 26, 8 MB, Thai captions burned in, no audio. For the team to rehearse against. | e8faac4 |

Timing, captions and audio cues: `timeline.json`, `captions-th.srt`, `audio-cues.json` in the source folder.

Example overlay at assembly:

```sh
ffmpeg -i assembled.mp4 -c:v libvpx-vp9 -i overlays-alpha.webm -filter_complex "[0][1]overlay=format=auto" -c:a copy out.mp4
```

Timeline of 23 Nov 2026 (TD's final beats): lamp-ball model, worksheet and C/E/R + poster replace the live-action period clips; face clips split per person.
