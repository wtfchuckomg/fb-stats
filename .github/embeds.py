#!/usr/bin/env python3
"""Make the embed/<page>/ links a newspaper can paste into WordPress.

WordPress strips <iframe> from posts, but turns a plain link into an embed when
the linked page names an oEmbed file (<link rel="alternate"
type="application/json+oembed">). Each page here is that link: WordPress reads
oembed.json and frames the real page with ?embed=1. A person who opens the
link is sent on to the page itself.

    python3 .github/embeds.py      writes embed/ — run again after season.json is rebuilt,
                                   so new games get their own link too
"""
import html
import json
from pathlib import Path

SITE = 'https://stats.kansasmediarankings.com'
PAGES = [  # slug, title, the page's address, starting height
    ('buco-scoreboard', 'BUCO Scoreboard', '?scores', 900),
    ('buco-stats', 'BUCO Player Stats', '?stats', 1000),
    ('buco-team-stats', 'BUCO Team Stats', '?stats=team', 1000),
    ('avctl-scoreboard', 'AVCTL Scoreboard', '?avctl', 900),
    ('avctl-standings', 'AVCTL Standings', '?standings', 1000),
    ('avctl-stats', 'AVCTL Player Stats', '?avstats', 1000),
    ('avctl-team-stats', 'AVCTL Team Stats', '?avstats=team', 1000),
    ('state-scoreboard', 'State Scoreboard', '?state', 900),
]

REPO = Path(__file__).resolve().parent.parent
root = REPO / 'embed'
pages = [(slug, title, q, height) for slug, title, q, height in PAGES]

# Every school's gamecast: whatever game it's playing that week, live once someone keeps stats on it.
for t in json.loads((REPO / 'logos' / 'teams.json').read_text()):
    if t.get('name') and t.get('slug'):
        pages.append((f"gamecast/{t['slug']}", f"{t['name']} Gamecast", f"?gamecast={t['slug']}", 1000))
# And each game already on the site with a gamecast (stats kept, or a box score pasted).
for x in json.loads((REPO / 'season.json').read_text()).get('games', []):
    if x.get('id') and (x.get('stats') or x.get('box')):
        pages.append((f"game/{x['id']}", f"{x['a']['name']} at {x['h']['name']}", f"?game={x['id']}", 1000))

for slug, title, q, height in pages:
    d = root / slug
    d.mkdir(parents=True, exist_ok=True)
    page, frame, oembed = f'{SITE}/{q}', f'{SITE}/{q}&embed=1', f'{SITE}/embed/{slug}/oembed.json'
    (d / 'oembed.json').write_text(json.dumps({
        'version': '1.0', 'type': 'rich', 'provider_name': 'Kansas Media Stats', 'provider_url': SITE,
        'title': title, 'width': 700, 'height': height, 'cache_age': 86400,
        'html': f'<iframe src="{html.escape(frame)}" width="700" height="{height}" frameborder="0" scrolling="yes" title="{html.escape(title)} - Kansas Media Stats"></iframe>',
    }, indent=2) + '\n')
    (d / 'index.html').write_text(f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{html.escape(title)} · Kansas Media Stats</title>
<link rel="alternate" type="application/json+oembed" href="{oembed}" title="{html.escape(title)}">
<link rel="canonical" href="{html.escape(page)}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url={html.escape(page)}">
</head><body><p><a href="{html.escape(page)}">{html.escape(title)} at Kansas Media Stats</a></p></body></html>
''')
print(f'{len(pages)} embed links in embed/')
