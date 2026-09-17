#!/usr/bin/env python3
"""Head-to-head results from before the seasons we hold ourselves, one file a school.

The preview's Past meetings card reads the five seasons we crawl from KPreps. Two schools that play
every year fill that up fast, so anything older comes from here: kansashsfootballhistory.com's
season pages, matched to our own slugs and written as /meetings/<slug>.json —

    {"name": "El Dorado", "opp": {"clearwater": [[2017, 25, 21], [2016, 14, 28, "ot"]], ...}}

Only seasons before FROM are kept; the rest we already have, with dates and sides.
"""
import json, re, sys
from difflib import SequenceMatcher
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW = HERE / 'raw'
OUT = HERE.parent.parent / 'meetings'
FROM = 2021                      # KPreps covers this season and after
DROP = re.compile(r'\b(high school|high|hs|co|county)\b')
# Two schools the archive knows by a name that shares no words with ours.
ALIAS = {'field-kindley': 'coffeyville', 'wichita-county': 'leoti-wichita-co'}
slug = lambda s: re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', (s or '').lower().strip()))


def words(name):
    return [w for w in DROP.sub(' ', (name or '').lower().replace('.', ' ').replace('-', ' ')).split() if w]


def likeness(a, b):
    """Their name against ours. Kansas writes the same school both ways round — Circle-Towanda and
    Towanda Circle — so the words are compared as a set before anything else."""
    wa, wb = words(a), words(b)
    if not wa or not wb:
        return 0.0
    sa, sb = set(wa), set(wb)
    if sa == sb:
        return 1.0
    if sa <= sb or sb <= sa:                        # one is the other plus a town or a saint
        return .9 - .04 * abs(len(sa) - len(sb))
    share = len(sa & sb) / max(len(sa), len(sb))
    close = SequenceMatcher(None, ' '.join(sorted(sa)), ' '.join(sorted(sb))).ratio()
    return max(share * .85, close * .92 if close > .82 else 0)


def our_teams():
    """Our slugs, with the name KPreps prints for each ("Abilene Cowboys" -> "Abilene")."""
    out = {}
    for t in json.loads((HERE.parent / 'kp' / 'teams.json').read_text()):
        s = t['slug']
        f = HERE.parent / 'kp' / 'seasons' / f'{s}.json'
        name = s.replace('-', ' ')
        if f.exists():
            d = json.loads(f.read_text())
            for y in sorted(d, reverse=True):
                n = d[y].get('name')
                if n:
                    name = re.sub(r'\s+\S+$', '', n) if len(n.split()) > 1 else n   # drop the mascot
                    break
        out[s] = name
    return out


def main():
    ours = our_teams()
    by_slug = {slug(v): k for k, v in ours.items()}
    cache = {}

    def match(name):
        """A name from their archive -> our slug, or None if nothing is close enough."""
        if name in cache:
            return cache[name]
        k = slug(name)
        hit = ALIAS.get(k) or by_slug.get(k) or (k if k in ours else None)
        if not hit:
            best, score = None, 0.0
            for s, n in ours.items():
                v = max(likeness(name, n), likeness(name, s.replace('-', ' ')))
                if v > score:
                    best, score = s, v
            hit = best if score >= .8 else None
        cache[name] = hit
        return hit

    files = sorted(RAW.glob('*.json'))
    print(f'{len(files)} schools crawled')
    books, missed = {}, {}
    for f in files:
        d = json.loads(f.read_text())
        me = match(d['name'])
        if not me:
            missed[d['name']] = missed.get(d['name'], 0) + 1
            continue
        book = books.setdefault(me, {'name': ours[me], 'opp': {}})
        for year, s in d['seasons'].items():
            if int(year) >= FROM:
                continue
            for g in s.get('games', []):
                if g.get('us') is None or g.get('them') is None:
                    continue
                them = match(g['opp'])
                if not them or them == me:
                    continue
                row = [int(year), g['us'], g['them']]
                if g.get('note'):
                    row.append(g['note'])
                book['opp'].setdefault(them, []).append(row)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.json'):
        old.unlink()
    n = 0
    for s, book in books.items():
        for k in book['opp']:
            book['opp'][k].sort(key=lambda r: -r[0])
        n += sum(len(v) for v in book['opp'].values())
        (OUT / f'{s}.json').write_text(json.dumps(book, separators=(',', ':')))
    print(f'{len(books)} of our schools matched, {n} old results, {len(missed)} of their schools unmatched')
    if '--misses' in sys.argv:
        for name in sorted(missed):
            print('   no match:', name)


main()
