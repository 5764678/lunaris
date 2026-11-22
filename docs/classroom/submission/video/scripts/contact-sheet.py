"""Storyboard contact sheet: one frame per shot (graphics shots and team slots) with its time range.

Run from video/:  python3 scripts/contact-sheet.py   (renders the frames via scripts/stills.mjs)
"""

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FPS = 30
W, H, PAD, LAB, COLS = 480, 270, 16, 74, 4
MIN_CHARS = 4
OUT = Path("design/storyboard-contact-sheet.jpg")


def fmt(t: float) -> str:
    return f"{int(t // 60)}:{t % 60:04.1f}"


def shot_rows(tl: dict) -> list[tuple[str, float, float, float, str]]:
    rows = []
    for s in tl["segments"]:
        if s["type"] == "graphics":
            for sh in s["shots"]:
                pick = sh.get("pick", sh["start"] + 0.62 * (sh["end"] - sh["start"]))
                rows.append((sh["id"], sh["start"], sh["end"], pick, sh["what"]))
        else:
            pick = s["start"] + 0.6 * (s["end"] - s["start"])
            rows.append((s["id"], s["start"], s["end"], pick, "TEAM: " + s["file"]))
    return rows


def fit(text: str, font: ImageFont.FreeTypeFont, width: int) -> str:
    t = text
    while font.getlength(t) > width and len(t) > MIN_CHARS:
        t = t[:-2]
    return t if t == text else t[:-1] + "…"


def main() -> None:
    tl = json.loads(Path("timeline.json").read_text(encoding="utf-8"))
    rows = shot_rows(tl)
    frames = [str(round(r[3] * FPS)) for r in rows]
    # fixed argv, no shell: renders the listed frames of the Animatic composition
    subprocess.run(  # noqa: S603
        ["node", "scripts/stills.mjs", "Animatic", "out/sheet", *frames],  # noqa: S607
        check=True,
        stdout=subprocess.DEVNULL,
    )
    font = ImageFont.truetype("fonts/NotoSansThai-500.ttf", 22)
    fontb = ImageFont.truetype("fonts/Kanit-600.ttf", 26)
    n_rows = (len(rows) + COLS - 1) // COLS
    size = (COLS * (W + PAD) + PAD, 90 + n_rows * (H + LAB + PAD) + PAD)
    sheet = Image.new("RGB", size, "#101317")
    d = ImageDraw.Draw(sheet)
    title = "LUNARIS · storyboard contact sheet · one frame per shot · 2:45 · captions as planned"
    d.text((PAD, 24), title, font=fontb, fill="#f2b43a")
    for i, (sid, a, b, pick, what) in enumerate(rows):
        x = PAD + (i % COLS) * (W + PAD)
        y = 90 + (i // COLS) * (H + LAB + PAD)
        im = Image.open(f"out/sheet/Animatic-{round(pick * FPS):05d}.jpg").resize((W, H))
        sheet.paste(im, (x, y))
        d.text((x, y + H + 6), f"{sid}   {fmt(a)}–{fmt(b)}", font=fontb, fill="#ffffff")
        d.text((x, y + H + 40), fit(what, font, W), font=font, fill="#aab4bf")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, quality=86)
    print(OUT, sheet.size, len(rows), "shots")


if __name__ == "__main__":
    main()
