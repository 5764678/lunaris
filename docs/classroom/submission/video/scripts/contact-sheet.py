"""Contact sheet: one frame per shot (graphics shots and team slots) with its time range.
Run from video/: python3 scripts/contact-sheet.py   (renders stills via scripts/stills.mjs first)"""
import json, subprocess, os
from PIL import Image, ImageDraw, ImageFont
tl = json.load(open('timeline.json'))
rows = []
for s in tl['segments']:
    if s['type'] == 'graphics':
        for sh in s['shots']:
            pick = sh.get('pick', sh['start'] + 0.62 * (sh['end'] - sh['start']))
            rows.append((sh['id'], sh['start'], sh['end'], pick, sh['what']))
    else:
        rows.append((s['id'], s['start'], s['end'], s['start'] + 0.6 * (s['end'] - s['start']), 'TEAM: ' + s['file']))
frames = [round(r[3] * 30) for r in rows]
subprocess.run(['node', 'scripts/stills.mjs', 'Animatic', 'out/sheet'] + [str(f) for f in frames], check=True, stdout=subprocess.DEVNULL)
font = ImageFont.truetype('fonts/NotoSansThai-500.ttf', 22)
fontb = ImageFont.truetype('fonts/Kanit-600.ttf', 26)
W, H, PAD, LAB, COLS = 480, 270, 16, 74, 4
n = len(rows); R = (n + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * (W + PAD) + PAD, 90 + R * (H + LAB + PAD) + PAD), '#101317')
d = ImageDraw.Draw(sheet)
d.text((PAD, 24), 'LUNARIS · storyboard contact sheet · one frame per shot · 2:45 · captions shown as planned', font=fontb, fill='#f2b43a')
fmt = lambda t: f"{int(t // 60)}:{t % 60:04.1f}"
for i, (sid, a, b, pick, what) in enumerate(rows):
    x = PAD + (i % COLS) * (W + PAD); y = 90 + (i // COLS) * (H + LAB + PAD)
    im = Image.open(f"out/sheet/Animatic-{round(pick * 30):05d}.jpg").resize((W, H))
    sheet.paste(im, (x, y))
    d.text((x, y + H + 6), f"{sid}   {fmt(a)}–{fmt(b)}", font=fontb, fill='#ffffff')
    t = what
    while font.getlength(t) > W and len(t) > 4: t = t[:-2]
    if t != what: t = t[:-1] + '…'
    d.text((x, y + H + 40), t, font=font, fill='#aab4bf')
os.makedirs('design', exist_ok=True)
sheet.save('design/storyboard-contact-sheet.jpg', quality=86)
print('design/storyboard-contact-sheet.jpg', sheet.size, n, 'shots')
