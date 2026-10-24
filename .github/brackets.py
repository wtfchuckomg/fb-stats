"""The link card for the playoff brackets (Chuck, 2026-10-23: "give it a preview card thing" — "just do one for them
all, '2026 playoff brackets'").

po/ is a page that carries the card (og: tags and card.png) and sends the visitor on to the bracket, the way g/<id>/
does for a game. The bracket page switches its address to po/?c=<class>, so the link people copy shows the card and
still opens the class they were looking at.

    python3 .github/brackets.py        writes po/index.html and po/card.png      needs: pip install Pillow
"""
import html, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cards
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'po')
SITE = 'https://stats.kansasmediarankings.com'
YEAR = 2026
TITLE = f'{YEAR} Playoff Brackets'
CLASSES = ['6A', '5A', '4A', '3A', '2A', '1A', '8-Man I', '8-Man II', '6-Man']
W, H = cards.W, cards.H
INK, MUTE, LINE, BLUE = cards.INK, cards.MUTE, cards.LINE, cards.BLUE


def draw(path):
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 8], fill=BLUE)
    d.text((60, 54), 'KANSAS MEDIA STATS', font=cards.font('bold', 26), fill=MUTE)
    d.text((W - 60, 54), 'KANSAS HIGH SCHOOL FOOTBALL', font=cards.font('bold', 26), fill=BLUE, anchor='ra')
    d.line([(60, 120), (W - 60, 120)], fill=LINE, width=2)
    # A bracket's shape on each side, eight lines meeting in the middle.
    def side(x0, step):
        ys = [190 + i * 36 for i in range(8)]
        for r in range(3):
            nxt = []
            for i in range(0, len(ys), 2):
                a, b = ys[i], ys[i + 1]
                x, w = x0 + step * r * 52, step * 40
                d.line([(x, a), (x + w, a), (x + w, b), (x, b)], fill=LINE, width=4)
                d.line([(x + w, (a + b) / 2), (x + w + step * 12, (a + b) / 2)], fill=LINE, width=4)
                nxt.append((a + b) / 2)
            ys = nxt
    side(60, 1); side(W - 60, -1)
    d.text((W / 2, 318), TITLE, font=cards.fit(d, TITLE, 'black', 74, W - 520), fill=INK, anchor='mm')
    row = '  ·  '.join(CLASSES)
    d.text((W / 2, 520), row, font=cards.fit(d, row, 'bold', 28, W - 120), fill=BLUE, anchor='mm')
    im.save(path, optimize=True)


def page():
    t = html.escape(TITLE, quote=True)
    desc = html.escape('Kansas high school football · Kansas Media Stats', quote=True)
    url = f'{SITE}/po/'
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{t} · Kansas Media Stats</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kansas Media Stats">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{url}card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{url}card.png">
<link rel="canonical" href="{url}">
<meta http-equiv="refresh" content="0; url=/?bracket=6A">
<script>(function(){{ var c = (new URLSearchParams(location.search).get('c') || '6A').replace(/[^0-9A-Za-z-]/g, '');
  location.replace('/?bracket=' + encodeURIComponent(c)); }})();</script>
</head><body><p><a href="/?bracket=6A">{t}</a></p></body></html>
'''


def main():
    os.makedirs(OUT, exist_ok=True)
    draw(os.path.join(OUT, 'card.png'))
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(page())
    print('po/index.html and po/card.png')


if __name__ == '__main__':
    main()
