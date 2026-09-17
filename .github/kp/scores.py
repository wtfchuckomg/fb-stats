#!/usr/bin/env python3
"""This season's finals as KPreps has them, for the games nobody kept stats on.

`crawl.py` already reads every school's KPreps page into kp/seasons/<slug>.json. This turns the
current season's finished games into one small file the site reads:

    {"built": ms, "season": 2026, "games": [{"d":"2026-09-18","h":"andale","a":"wellington","hp":42,"ap":7,
                                             "hn":"Andale","an":"Wellington"}]}

Both schools carry the same game, so each is written once, keyed by the pair and the date.
"""
import json, re, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
YEAR = 2026
OUT = HERE.parent.parent / 'kpscores.json'


def short(name):
    """"Abilene Cowboys" -> "Abilene"; the mascot is the last word and only the school is wanted."""
    n = (name or '').strip()
    return re.sub(r'\s+\S+$', '', n) if len(n.split()) > 1 else n


def main():
    names, games = {}, {}
    # A school's own page gives its real name ("Circle Thunderbirds" -> Circle); the way an opponent writes
    # it ("Towanda-Circle") is only a fallback, so every school's own name is read first.
    for f in sorted((HERE / 'seasons').glob('*.json')):
        d = json.loads(f.read_text())
        s = d.get(str(YEAR)) or next((v for k, v in sorted(d.items(), reverse=True) if v.get('name')), None)
        if s and s.get('name'):
            names[f.stem] = short(s['name'])
    for f in sorted((HERE / 'seasons').glob('*.json')):
        me = f.stem
        d = json.loads(f.read_text())
        s = d.get(str(YEAR))
        if not s:
            continue
        names.setdefault(me, short(s.get('name')) or me.replace('-', ' ').title())
        for g in s.get('games', []):
            if g.get('us') is None or g.get('them') is None or not g.get('oppSlug'):
                continue
            other = g['oppSlug']
            home, away = (me, other) if g['at'] == 'home' else (other, me)
            hp, ap = (g['us'], g['them']) if home == me else (g['them'], g['us'])
            m = re.match(r'(\d{1,2})/(\d{1,2})', g.get('date', '') or '')
            date = f'{YEAR}-{int(m.group(1)):02d}-{int(m.group(2)):02d}' if m else ''
            key = (date, *sorted([home, away]))
            games[key] = {'d': date, 'h': home, 'a': away, 'hp': hp, 'ap': ap}
            names.setdefault(other, short(g.get('opp')) or other.replace('-', ' ').title())
    rows = sorted(games.values(), key=lambda r: (r['d'], r['h']))
    for r in rows:
        r['hn'], r['an'] = names.get(r['h'], r['h']), names.get(r['a'], r['a'])
    OUT.write_text(json.dumps({'built': int(time.time() * 1000), 'season': YEAR, 'games': rows}, separators=(',', ':')))
    print(f'{len(rows)} finals from KPreps -> {OUT.name}')


main()
