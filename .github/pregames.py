"""A link card for every game on the schedule that hasn't been played yet.

Where g/<id>/ is the card a finished game shows, pv/<id>/ is the card the week ahead shows: the two schools
with their logos and records, when they kick off, and this site's own line. Opening the link goes on to the
pregame page (/?preview=<id>), which has the predictor, the leaders and the series.

The games come from schedule.json (KPreps' statewide schedule) and the line from ratings.json, worked out the
same way the site's ourLine() does it. Run it for one week's games:

    python3 .github/pregames.py 2026-09-25               every game that Friday
    python3 .github/pregames.py 2026-09-25 --county butler
"""
import html, json, os, shutil, sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cards   # fonts, logos, colors and the slug helper

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'pv')
SITE = 'https://stats.kansasmediarankings.com'
W, H = cards.W, cards.H
INK, MUTE, LINE, BLUE = cards.INK, cards.MUTE, cards.LINE, cards.BLUE

# The ten Butler County schools, written the way KPreps writes them.
BUTLER = ['andover', 'andover-central', 'augusta', 'leon-bluestem', 'towanda-circle',
          'douglass', 'el-dorado', 'flinthills', 'whitewater-remington', 'rose-hill']
COUNTIES = {'butler': BUTLER}

read = lambda n: json.load(open(os.path.join(ROOT, n), encoding='utf-8'))


def records(games):
    """{slug: "2-1"} from every game on the schedule that has a score."""
    rec = {}
    for g in games:
        if g.get('hp') is None or g.get('ap') is None: continue
        for mine, theirs, s in ((g['hp'], g['ap'], g['h']), (g['ap'], g['hp'], g['a'])):
            r = rec.setdefault(s, [0, 0, 0])
            r[0 if mine > theirs else 1 if mine < theirs else 2] += 1
    return {s: f'{r[0]}-{r[1]}' + (f'-{r[2]}' if r[2] else '') for s, r in rec.items()}


def line_of(rat, away, home):
    """What the site's own ratings make of the game: (favorite name, points), home team's side first."""
    a, h = rat['teams'].get(away), rat['teams'].get(home)
    if not a or not h or a['group'] != h['group']: return None
    g = rat['groups'][h['group']]
    hp = g['mu'] + h['off'] + a['def'] + g['hfa'] / 2
    ap = g['mu'] + a['off'] + h['def'] - g['hfa'] / 2
    return round((hp - ap) * 2) / 2


def when_of(d):
    y, m, dy = map(int, d.split('-'))
    return date(y, m, dy).strftime('%A, %B %-d')


def draw(g, path):
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 8], fill=BLUE)
    d.text((60, 54), 'KANSAS MEDIA STATS', font=cards.font('bold', 26), fill=MUTE)
    d.text((W - 60, 54), 'GAME PREVIEW', font=cards.font('bold', 26), fill=BLUE, anchor='ra')
    d.line([(60, 120), (W - 60, 120)], fill=LINE, width=2)

    y = 178
    for name, rec in ((g['an'], g['arec']), (g['hn'], g['hrec'])):
        lg = cards.logo(name, 116)
        if lg: im.paste(lg, (60 + (116 - lg.width) // 2, y + (116 - lg.height) // 2), lg)
        d.text((210, y + 46), name, font=cards.fit(d, name, 'black', 60, 760), fill=INK, anchor='lm')
        if rec: d.text((210, y + 96), rec, font=cards.font('bold', 34), fill=MUTE, anchor='lm')
        y += 168
    d.text((118, 178 + 144), 'at', font=cards.font('reg', 30), fill=MUTE, anchor='mm')

    d.line([(60, H - 130), (W - 60, H - 130)], fill=LINE, width=2)
    foot = ' · '.join(x for x in (g['when'], '7:00 PM', g.get('line')) if x)
    d.text((60, H - 84), foot, font=cards.fit(d, foot, 'bold', 32, W - 60 - 470), fill=INK, anchor='lm')
    d.text((W - 60, H - 84), 'stats.kansasmediarankings.com', font=cards.font('reg', 26), fill=MUTE, anchor='rm')

    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)


def page(g):
    t = html.escape(f"{g['an']} at {g['hn']}", quote=True)
    bits = [g['when'], '7:00 PM'] + ([g['line']] if g.get('line') else [])
    d = html.escape(' · '.join(bits) + ' · Records, the matchup predictor and the series, on Kansas Media Stats', quote=True)
    here = f"{SITE}/pv/{g['id']}/"
    go = f"/?preview={html.escape(g['id'], quote=True)}"
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{t} · Preview · Kansas Media Stats</title>
<meta name="description" content="{d}">
<meta property="og:type" content="website">
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


def build(days, only=None, prune=True):
    """days: the dates to cover ('2026-09-25'). only: slugs at least one side must be, or None for every game."""
    sched = read('schedule.json')['games']
    rat = read('ratings.json')
    rec = records(sched)
    keep, made = set(), 0
    for g in sched:
        if g['d'] not in days: continue
        if g.get('hp') is not None and g.get('ap') is not None: continue   # already played
        if only and g['h'] not in only and g['a'] not in only: continue
        sp = line_of(rat, g['a'], g['h'])
        row = dict(g, arec=rec.get(g['a'], ''), hrec=rec.get(g['h'], ''), when=when_of(g['d']),
                   line=None if sp is None else 'Pick ’em' if sp == 0 else
                        f"{g['hn'] if sp > 0 else g['an']} by {abs(sp):g}")
        folder = os.path.join(OUT, g['id'])
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(page(row))
        draw(row, os.path.join(folder, 'card.png'))
        keep.add(g['id']); made += 1
    # Last week's previews come down, so the folder is only ever the week ahead.
    if prune and os.path.isdir(OUT):
        for name in os.listdir(OUT):
            if name not in keep and os.path.isdir(os.path.join(OUT, name)):
                shutil.rmtree(os.path.join(OUT, name), ignore_errors=True)
    print(f'{made} preview pages')
    return sorted(keep)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    only = None
    if '--county' in sys.argv:
        only = COUNTIES[sys.argv[sys.argv.index('--county') + 1].lower()]
    build(args, only, prune='--keep' not in sys.argv)
