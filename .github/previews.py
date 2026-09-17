"""A small preview page for every shared game, so a link to a game shows that game on social media.

Runs in GitHub Actions (.github/workflows/previews.yml) every 10 minutes. It reads the shared games from the
site's database (the same public read the site itself does) and writes g/<game id>/index.html for each. It
removes the pages of games that are no longer shared and leaves everything else alone. Someone who opens a
link goes straight on to the game (/?game=<id>); link previews read the page's tags.

A game's title and status come from the "card" the site saves with it, like "Independence 14, Augusta 28" and
"Final · Fri, Sep 11". Games saved before cards existed use .github/cards-seed.json, or failing that, the two
schools' names.
"""
import html, json, os, re, shutil, sys, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cards   # draws g/<id>/card.png

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'g')
SITE = 'https://stats.kansasmediarankings.com'
KEY = 'AIzaSyBnIdA4E1hhAOCIR51bjXHJKoAQ4kBIr3Q'   # the site's own public web key, already in index.html
URL = f'https://firestore.googleapis.com/v1/projects/fb-stats-dc058/databases/(default)/documents:runQuery?key={KEY}'
QUERY = {'structuredQuery': {'from': [{'collectionId': 'pressbox'}],
         'where': {'fieldFilter': {'field': {'fieldPath': 'public'}, 'op': 'EQUAL', 'value': {'booleanValue': True}}}}}
NOT_GAMES = {'score', 'roster', 'teams', 'hidden', 'records'}   # quick scores and the site's own lists


def fetch():
    req = urllib.request.Request(URL, data=json.dumps(QUERY).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def card_of(doc_id, f, seed):
    c = f.get('card', {}).get('mapValue', {}).get('fields')
    if c and c.get('t', {}).get('stringValue'):
        return c['t']['stringValue'], c.get('s', {}).get('stringValue', '')
    if doc_id in seed:
        return seed[doc_id]['t'], seed[doc_id].get('s', '')
    try:
        g = json.loads(f['json']['stringValue'])
        if not (g.get('plays') or g.get('box')): return None, None   # nothing to watch yet
        return f"{g['teams']['A']['name']} at {g['teams']['H']['name']}", ''
    except Exception:
        return None, None


def page(doc_id, title, sub):
    t = html.escape(title, quote=True)
    d = html.escape(f"{sub + ' · ' if sub else ''}Play-by-play, box score and stats on Kansas Media Stats", quote=True)
    here, go = f'{SITE}/g/{doc_id}/', f'/?game={doc_id}'
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{t} · Kansas Media Stats</title>
<meta name="description" content="{d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kansas Media Stats">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{here}">
<meta property="og:image" content="{SITE}/g/{doc_id}/card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{t}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{SITE}/g/{doc_id}/card.png">
<link rel="canonical" href="{here}">
<meta http-equiv="refresh" content="0; url={go}">
<script>location.replace('{go}' + (location.search ? '&' + location.search.slice(1) : ''));</script>
</head><body><p><a href="{go}">{t}</a> · Kansas Media Stats</p></body></html>
'''


def main():
    seed_path = os.path.join(ROOT, '.github', 'cards-seed.json')
    seed = json.load(open(seed_path, encoding='utf-8')) if os.path.exists(seed_path) else {}
    keep = set()
    for row in fetch():
        d = row.get('document')
        if not d: continue
        doc_id, f = d['name'].rsplit('/', 1)[-1], d.get('fields', {})
        if not re.fullmatch(r'[A-Za-z0-9_-]+', doc_id): continue
        if f.get('deleted', {}).get('booleanValue') or f.get('kind', {}).get('stringValue') in NOT_GAMES or 'json' not in f: continue
        title, sub = card_of(doc_id, f, seed)
        if not title: continue
        keep.add(doc_id)
        # The score card. A game whose card can't be read keeps whatever picture it already had.
        try: cards.draw_card(title, sub, os.path.join(OUT, doc_id, 'card.png'))
        except Exception as e: print(f'{doc_id}: no card ({e})')
        path = os.path.join(OUT, doc_id, 'index.html')
        new = page(doc_id, title, sub)
        if not os.path.exists(path) or open(path, encoding='utf-8').read() != new:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            open(path, 'w', encoding='utf-8').write(new)
    # Games no longer shared lose their page, but never all at once: an empty answer is more likely a hiccup.
    if keep and os.path.isdir(OUT):
        for name in os.listdir(OUT):
            if name not in keep: shutil.rmtree(os.path.join(OUT, name), ignore_errors=True)
    print(f'{len(keep)} game previews')


main()
