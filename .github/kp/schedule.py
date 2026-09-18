#!/usr/bin/env python3
"""Every 2026 game for the schools we have a logo for, from the KPreps crawl.

The site shows a school's full schedule from this file: games already on the site (tracked, scored by
hand, or entered from the county schedule) take precedence, and anything else fills in from here. A
game against a school with no logo still belongs on the logo school's schedule, so it's kept; a game
between two schools without logos is left out.

    {"built": ms, "season": 2026, "games": [{"id","d","h","a","hn","an","hp"?,"ap"?,"ot"?}]}

Names are the site's own (logos/teams.json) wherever a school matches one, so pages and records line up.
"""
import json, re, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
YEAR = 2026
slug = lambda s: re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', (s or '').lower().strip()))


def logo_index():
    """Every way a logo school is written — name, slug, aliases — plus each half of a hyphenated name."""
    L = json.loads((ROOT / 'logos' / 'teams.json').read_text())
    L = L['list'] if isinstance(L, dict) else L
    idx = {}
    for t in L:
        if not t.get('file'):
            continue
        for n in [t['name'], t.get('slug', '')] + t.get('aliases', []):
            if n:
                idx.setdefault(slug(n), t['name'])
    return idx


def tidy(n):
    """KPreps' way of writing a school, brought toward ours: "Co." is County, Blue Valley is BV."""
    n = re.sub(r'\bCo\.?(?=\s|-|$)', 'County', n)
    return re.sub(r'\bBlue Valley\b', 'BV', n)


def our_name(kp_slug, kp_name, idx):
    """The logo school this KPreps school is, or None. Tried from the most exact to the loosest."""
    full = tidy(kp_name)
    tries = [kp_slug, full]
    # The slug never carries the mascot, so it's the surest short form when a mascot runs to two words.
    for base in (full, tidy(kp_slug.replace('-', ' ').title())):
        city = re.sub(r'^(KC|Kc|Topeka|Wichita|Hutchinson|Salina|Lawrence|Olathe|Shawnee Mission)\s+', '', base)
        if city != base:
            tries.append(city)                                     # "KC Turner" is Turner, "Topeka Seaman" is Seaman
        for b in (base, city):
            bare = re.sub(r'\s+Academy$', '', b)
            if bare != b:
                tries.append(bare)                                 # "Maranatha Academy" is Maranatha, "KC Sumner Academy" KC Sumner
    parts = [p.strip() for p in re.split(r'-', full) if p.strip()]
    if len(parts) == 2:
        tries += [f'{parts[1]}-{parts[0]}', parts[1], parts[0]]   # "Argonia-Attica" is Attica-Argonia; "Pratt-Skyline" is Skyline
    for t in tries:
        hit = idx.get(slug(t))
        if hit:
            return hit
    # a co-op that has since taken on another name: "Winona-Triplains" is Triplains-Brewster
    for p in parts:
        for k, v in idx.items():
            if len(p) > 5 and k.startswith(slug(p) + '-'):
                return v
    return None


def short(name):
    n = re.sub(r'^\d{4}\s+', '', (name or '').strip())
    return re.sub(r'\s+\S+$', '', n) if len(n.split()) > 1 else n


def main():
    idx = logo_index()
    kpname, ours = {}, {}
    files = sorted((HERE / 'seasons').glob('*.json'))
    for f in files:
        d = json.loads(f.read_text())
        n = next((v.get('name') for y, v in sorted(d.items(), reverse=True) if v.get('name')), f.stem)
        kpname[f.stem] = short(n)
        ours[f.stem] = our_name(f.stem, short(n), idx)
    games = {}
    for f in files:
        me = f.stem
        s = json.loads(f.read_text()).get(str(YEAR))
        if not s:
            continue
        for g in s.get('games', []):
            other = g.get('oppSlug') or slug(g.get('opp'))
            if other not in kpname:
                kpname[other] = short(g.get('opp')) or other
                ours[other] = our_name(other, kpname[other], idx)
            if not ours.get(me) and not ours.get(other):
                continue                                          # neither school has a logo
            home, away = (me, other) if g.get('at') != 'away' else (other, me)
            m = re.match(r'(\d{1,2})/(\d{1,2})', g.get('date', '') or '')
            if not m:
                continue
            d = f'{YEAR}-{int(m.group(1)):02d}-{int(m.group(2)):02d}'
            hn, an = ours.get(home) or kpname[home], ours.get(away) or kpname[away]
            key = (d, *sorted([home, away]))
            row = games.get(key) or {'id': f'kps26-{d}-{slug(an)}-{slug(hn)}', 'd': d, 'h': home, 'a': away, 'hn': hn, 'an': an}
            if g.get('neutral') or g.get('at') == 'neutral':
                row['n'] = 1
            if g.get('us') is not None and g.get('them') is not None:
                hp, ap = (g['us'], g['them']) if home == me else (g['them'], g['us'])
                row.update({'hp': hp, 'ap': ap, **({'ot': 1} if g.get('ot') else {})})
            games[key] = row
    rows = sorted(games.values(), key=lambda r: (r['d'], r['hn']))
    (ROOT / 'schedule.json').write_text(json.dumps({'built': int(time.time() * 1000), 'season': YEAR, 'games': rows}, separators=(',', ':')))
    matched = sum(1 for v in ours.values() if v)
    print(f'{len(rows)} games for {matched} logo schools -> schedule.json')
    missing = sorted(n for s_, n in kpname.items() if not ours.get(s_) and (HERE / 'seasons' / f'{s_}.json').exists())
    print('KPreps schools with no logo:', ', '.join(missing))


main()
