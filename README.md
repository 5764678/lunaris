# LUNARIS video renders (not for merging)

Renders of the graphics timeline from `docs/classroom/submission/video/` on `claude/video-source`.
This branch only carries output files and is never merged.

| File | What | Built from |
|---|---|---|
| `graphics-1080p.mp4` | 1920×1080, 30 fps, 4950 frames (2:45.0), H.264 High CRF 20, 22 MB, no audio, no captions. Grey labelled slates in the team slots; period numbers and QR tile already composited over the slates. | b85b4e3 |
| `overlays-alpha.webm` | 1920×1080, 30 fps, 2:45, VP9 with alpha (yuva420p), 1.3 MB. Only the period numbers 1–6 and the QR tile, on transparency, aligned to 0:00, for compositing over the team's clips. Decode with `-c:v libvpx-vp9` to keep the alpha. | a3979c6 |
| `animatic-720p.mp4` | 1280×720, 30 fps, 2:45, H.264 CRF 26, Thai captions burned in, no audio. For the team to rehearse against. | 3dfe1a5 |

Timing, captions and audio cues: `timeline.json`, `captions-th.srt`, `audio-cues.json` in the source folder.

Example overlay at assembly:

```sh
ffmpeg -i assembled.mp4 -c:v libvpx-vp9 -i overlays-alpha.webm -filter_complex "[0][1]overlay=format=auto" -c:a copy out.mp4
```
