"""Draws the picture a game's link shows on social media: the two schools, their logos and the score.

previews.py calls draw_card() with the one-line card the site saves with each game — "Augusta 28,
Independence 14" and "Final · Fri, Sep 11" — which is all a score card needs. Logos come from the repo's own
logos folder; a school without one simply has no logo on its card.
"""
import json, os, re, unicodedata
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGOS = os.path.join(ROOT, 'logos')
W, H = 1200, 630
INK, MUTE, LINE, WIN, BLUE = (29, 29, 31), (110, 110, 118), (226, 228, 233), (13, 116, 63), (31, 78, 156)

# Arial on a Mac, DejaVu on the Ubuntu runner; whichever is there.
FACES = {
    'bold': ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'],
    'black': ['/System/Library/Fonts/Supplemental/Arial Black.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'],
    'reg': ['/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'],
}

def font(kind, size):
    for p in FACES[kind]:
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def slug(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

_idx = None
def logo_file(name):
    global _idx
    if _idx is None:
        _idx = {}
        path = os.path.join(LOGOS, 'teams.json')
        rows = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else []
        for t in rows:
            for key in [t.get('name'), t.get('slug'), *(t.get('aliases') or [])]:
                if key: _idx.setdefault(slug(key), t.get('file'))
    f = _idx.get(slug(name))
    p = os.path.join(LOGOS, f) if f else None
    return p if p and os.path.exists(p) else None

def logo(name, box):
    p = logo_file(name)
    if not p: return None
    im = Image.open(p).convert('RGBA')
    im.thumbnail((box, box), Image.LANCZOS)
    return im

def fit(d, text, kind, size, width):
    while size > 20:
        f = font(kind, size)
        if d.textlength(text, font=f) <= width: return f
        size -= 2
    return font(kind, size)

# "Augusta 28, Independence 14" -> [("Augusta", 28), ("Independence", 14)], the winner first.
def sides_of(title):
    out = []
    for part in str(title).split(','):
        m = re.match(r'^\s*(.+?)\s+(\d{1,3})\s*$', part)
        if m: out.append((m.group(1).strip(), int(m.group(2))))
    return out if len(out) == 2 else None

def draw_card(title, sub, out_path):
    sides = sides_of(title)
    if not sides: return False
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 8], fill=BLUE)
    d.text((60, 54), 'KANSAS MEDIA STATS', font=font('bold', 26), fill=MUTE)
    top = sides[0][1] > sides[1][1]
    y = 170
    for i, (name, score) in enumerate(sides):
        won = top and i == 0
        lg = logo(name, 96)
        if lg: im.paste(lg, (60 + (96 - lg.width) // 2, y + (96 - lg.height) // 2), lg)
        d.text((190, y + 48), name, font=fit(d, name, 'bold', 58, 620), fill=INK if won else MUTE, anchor='lm')
        d.text((W - 70, y + 48), str(score), font=font('black', 76), fill=INK if won else MUTE, anchor='rm')
        if won: d.polygon([(W - 46, y + 38), (W - 46, y + 58), (W - 30, y + 48)], fill=WIN)
        y += 150
    d.line([(60, 152), (W - 60, 152)], fill=LINE, width=2)
    d.line([(60, y - 22), (W - 60, y - 22)], fill=LINE, width=2)
    if sub: d.text((60, H - 70), sub, font=font('bold', 32), fill=INK)
    d.text((W - 60, H - 66), 'stats.kansasmediarankings.com', font=font('reg', 26), fill=MUTE, anchor='rm')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    im.save(out_path, optimize=True)
    return True
