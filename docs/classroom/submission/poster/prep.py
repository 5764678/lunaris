"""Turn raw captures (captures/, not committed) into poster assets (img/), and make the QR code."""

from pathlib import Path

import qrcode
from PIL import Image, ImageDraw

H = Path(__file__).parent
CAP, OUT = H / "captures", H / "img"
OUT.mkdir(exist_ok=True)

# Globe (Overview page, "South polar" preset, labels/sites/grid off):
# square crop around the disc, round alpha mask
g = Image.open(CAP / "globe-southpolar.png").convert("RGB")
cx, cy, r = 2640, 1422, 1160
sq = g.crop((cx - r, cy - r, cx + r, cy + r)).resize((1800, 1800), Image.LANCZOS)
m = Image.new("L", sq.size, 0)
ImageDraw.Draw(m).ellipse((40, 40, 1760, 1760), fill=255)
sq.putalpha(m)
sq.save(OUT / "globe.png", optimize=True)

# Pole terrain (LRO LOLA relief), resized
t = Image.open(CAP / "terrain.png").convert("RGB")
t = t.resize((4200, round(4200 * t.height / t.width)), Image.LANCZOS)
t.save(OUT / "terrain.jpg", quality=88)

# Sky chart from /learn/4: keep the plot, drop the app's axis text
# (too small at A0; the poster re-labels it)
sky = Image.open(CAP / "sky.png").convert("RGB").crop((140, 20, 2922, 760))
sky.save(OUT / "sky.jpg", quality=92)

# Phase strip from /learn/2: crop the disc, round mask
for p in sorted(CAP.glob("phase-*.png")):
    im = Image.open(p).convert("RGB").resize((640, 640), Image.LANCZOS)
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).ellipse((28, 28, 612, 612), fill=255)
    im.putalpha(m)
    im.save(OUT / p.name, optimize=True)

# QR code (local generation, no external API)
q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0, box_size=24)
q.add_data("https://lunaris-demo.onrender.com/learn")
q.make(fit=True)
q.make_image(fill_color="#1c1a17", back_color="white").save(OUT / "qr.png")
print("ok")
