"""A small page and a link card for every player the site has stats on.

Written by the nightly rebuild (nightly.py), which hands over the players it worked out from the games: name,
school, jersey number and season totals. Each one gets p/<school>-<name>/index.html, whose tags are what
Facebook, X and a text message read, and card.png, the picture they show: the school's logo, his number and his
name. Opening the link goes straight on to his page (/?player=<name>&team=<school>).
"""
import html, json, os, re, shutil, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cards   # fonts, logos and the slug helper

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'p')
SITE = 'https://stats.kansasmediarankings.com'
W, H = cards.W, cards.H
INK, MUTE, LINE, BLUE = cards.INK, cards.MUTE, cards.LINE, cards.BLUE

slug = cards.slug
key_of = lambda p: f"{slug(p['team'])}-{slug(p['name'])}"


# "43 CAR, 569 YDS, 9 TD": the one thing he did most of, in yards.
def stat_line(p):
    out = []
    if p.get('pa'): out.append((p.get('py', 0), f"{p.get('pc', 0)}/{p['pa']}, {p.get('py', 0)} PASS YDS" + (f", {p['ptd']} TD" if p.get('ptd') else '')))
    if p.get('ru'): out.append((p.get('ry', 0), f"{p['ru']} CAR, {p.get('ry', 0)} YDS" + (f", {p['rtd']} TD" if p.get('rtd') else '')))
    if p.get('re'): out.append((p.get('rey', 0), f"{p['re']} REC, {p.get('rey', 0)} YDS" + (f", {p['retd']} TD" if p.get('retd') else '')))
    out.sort(key=lambda o: -o[0])
    return out[0][1] if out else ''


def draw(p, path):
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 8], fill=BLUE)
    d.text((60, 54), 'KANSAS MEDIA STATS', font=cards.font('bold', 26), fill=MUTE)
    d.line([(60, 120), (W - 60, 120)], fill=LINE, width=2)

    lg = cards.logo(p['team'], 230)
    if lg: im.paste(lg, (60 + (230 - lg.width) // 2, 200 + (230 - lg.height) // 2), lg)
    x = 330 if lg else 60

    no = str(p.get('no') or '').strip()
    if no:
        f = cards.font('black', 120)
        d.text((x, 236), f'#{no}', font=f, fill=BLUE)
        x += int(d.textlength(f'#{no}', font=f)) + 34

    name = str(p['name']).upper()
    room = W - 60 - x
    f = cards.fit(d, name, 'black', 86, room)
    d.text((x, 250), name, font=f, fill=INK, anchor='lm')
    d.text((x, 330), str(p['team']).upper(), font=cards.font('bold', 40), fill=MUTE, anchor='lm')

    line = stat_line(p)
    d.line([(60, H - 130), (W - 60, H - 130)], fill=LINE, width=2)
    if line: d.text((60, H - 84), line, font=cards.fit(d, line, 'bold', 32, W - 60 - 470), fill=INK, anchor='lm')
    d.text((W - 60, H - 84), 'stats.kansasmediarankings.com', font=cards.font('reg', 26), fill=MUTE, anchor='rm')

    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)


def page(p):
    k = key_of(p)
    t = html.escape(f"{p['name']} · {p['team']}", quote=True)
    line = stat_line(p)
    d = html.escape(f"{line + ' · ' if line else ''}Season and career stats, and a game log, on Kansas Media Stats", quote=True)
    here = f'{SITE}/p/{k}/'
    go = f"/?player={html.escape(p['name'].replace(' ', '%20'), quote=True)}&team={html.escape(p['team'].replace(' ', '%20'), quote=True)}"
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{t} · Kansas Media Stats</title>
<meta name="description" content="{d}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Kansas Media Stats">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{here}">
<meta property="og:image" content="{here}card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{here}card.png">
<link rel="canonical" href="{here}">
<meta http-equiv="refresh" content="0; url={go}">
<script>location.replace({json.dumps(go)});</script>
</head><body><p><a href="{go}">{t}</a></p></body></html>
'''


def build(players):
    """players: [{name, team, no, pc, pa, py, ptd, ru, ry, rtd, re, rey, retd}]"""
    keep, made = set(), 0
    for p in players:
        if not p.get('name') or not p.get('team') or str(p['name']).startswith('#'): continue
        k = key_of(p)
        if not k or k in keep: continue
        keep.add(k)
        folder = os.path.join(OUT, k)
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(page(p))
        draw(p, os.path.join(folder, 'card.png'))
        made += 1
    # Anyone no longer in the stats (a name fixed, a game taken down) loses his page.
    if os.path.isdir(OUT):
        for name in os.listdir(OUT):
            if name not in keep and os.path.isdir(os.path.join(OUT, name)):
                shutil.rmtree(os.path.join(OUT, name), ignore_errors=True)
    print(f'{made} player pages')


if __name__ == '__main__':
    build(json.load(open(sys.argv[1], encoding='utf-8')))
