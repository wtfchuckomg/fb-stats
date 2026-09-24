#!/usr/bin/env python3
"""Every 2026 game for every Kansas school KPreps covers, logo or not.

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


def candidates(kp_slug, kp_name):
    """The ways this KPreps school might be written on our list: exact spellings, then looser rules."""
    full = tidy(kp_name)
    # KPreps writes a county as "-co" in the slug ("oberlin-decatur-co"): with it, without it, and spelled out.
    exact = [kp_slug, full, re.sub(r'-co$', '', kp_slug), re.sub(r'-co$', '-county', kp_slug)]
    # A school from another state (Kansas City Northeast is "kc-northeast-mo") is only ever itself.
    if re.search(r'-(mo|ok|ne|ia|ar|tx|nm)$', kp_slug):
        return exact[:2], []
    loose = []
    # The slug never carries the mascot, so it's the surest short form when a mascot runs to two words.
    for base in (full, tidy(kp_slug.replace('-', ' ').title())):
        city = re.sub(r'^(KC|Kc|Topeka|Wichita|Hutchinson|Salina|Lawrence|Olathe|Shawnee Mission)\s+', '', base)
        if city != base:
            loose.append(city)                                     # "KC Turner" is Turner, "Topeka Seaman" is Seaman
        for b in (base, city):
            bare = re.sub(r'\s+Academy$', '', b)
            if bare != b:
                loose.append(bare)                                 # "Maranatha Academy" is Maranatha
    parts = [p.strip() for p in re.split(r'-', full) if p.strip()]
    if len(parts) == 2:
        loose += [f'{parts[1]}-{parts[0]}', parts[1], parts[0]]   # "Argonia-Attica" is Attica-Argonia; "Pratt-Skyline" is Skyline
    return exact, loose


def resolve(schools, idx):
    """KPreps slug -> our school name. A school written exactly as one of ours claims it first; a looser rule
    only gets a name nobody claimed exactly, and only if no other school's loose rule reached it too. That's
    what keeps the Manhattan Eagles off Manhattan High and St. Mary's Academy off St. Marys."""
    out, claimed = {}, set()
    for s_, n in schools.items():
        hit = next((idx[slug(t)] for t in candidates(s_, n)[0] if slug(t) in idx), None)
        if hit:
            out[s_] = hit; claimed.add(hit)
    loose = {}
    for s_, n in schools.items():
        if s_ in out:
            continue
        hit = next((idx[slug(t)] for t in candidates(s_, n)[1] if slug(t) in idx), None)
        if hit and hit not in claimed:
            loose.setdefault(hit, []).append(s_)
    for hit, ss in loose.items():
        if len(ss) == 1:
            out[ss[0]] = hit
    return out


def short(name):
    n = re.sub(r'^\d{4}\s+', '', (name or '').strip())
    return re.sub(r'\s+\S+$', '', n) if len(n.split()) > 1 else n


def main():
    idx = logo_index()
    kpname = {}
    files = sorted((HERE / 'seasons').glob('*.json'))
    for f in files:
        d = json.loads(f.read_text())
        kpname[f.stem] = short(next((v.get('name') for y, v in sorted(d.items(), reverse=True) if v.get('name')), f.stem))
    raw = []
    for f in files:
        s_ = json.loads(f.read_text()).get(str(YEAR))
        for g in (s_ or {}).get('games', []):
            other = g.get('oppSlug') or slug(g.get('opp'))
            # An opponent is written without its mascot, so its name is used whole: cutting the last word would
            # turn the Manhattan Eagles into Manhattan and St. Mary's Academy into St. Mary's.
            kpname.setdefault(other, re.sub(r'^(at|vs\.?)\s+', '', (g.get('opp') or other).strip()))   # a stray "at KC East"
            raw.append((f.stem, other, g))
    ours = resolve(kpname, idx)
    # A school with no logo keeps KPreps' name, unless that name is already one of ours ("Manhattan" for the
    # Manhattan Eagles): then it keeps its full name from the slug.
    taken = {slug(v) for v in idx.values()}
    def name_of(s_):
        if ours.get(s_):
            return ours[s_]
        n = kpname.get(s_) or s_
        return n if slug(n) not in taken else s_.replace('-', ' ').title()
    games = {}
    for me, other, g in raw:
        home, away = (me, other) if g.get('at') != 'away' else (other, me)
        m = re.match(r'(\d{1,2})/(\d{1,2})', g.get('date', '') or '')
        if not m:
            continue
        d = f'{YEAR}-{int(m.group(1)):02d}-{int(m.group(2)):02d}'
        hn, an = name_of(home), name_of(away)
        key = (d, *sorted([home, away]))
        row = games.get(key) or {'id': f'kps26-{d}-{slug(an)}-{slug(hn)}', 'd': d, 'h': home, 'a': away, 'hn': hn, 'an': an}
        if g.get('us') is not None and g.get('them') is not None:
            hp, ap = (g['us'], g['them']) if home == me else (g['them'], g['us'])
            row.update({'hp': hp, 'ap': ap, **({'ot': 1} if g.get('ot') else {})})
        games[key] = row
    rows = sorted(games.values(), key=lambda r: (r['d'], r['hn']))
    (ROOT / 'schedule.json').write_text(json.dumps({'built': int(time.time() * 1000), 'season': YEAR, 'games': rows}, separators=(',', ':')))
    crawled = [f.stem for f in files]
    print(f'{len(rows)} games for {len(crawled)} KPreps schools -> schedule.json')
    print('No logo, kept by name:', ', '.join(sorted(name_of(s_) for s_ in crawled if not ours.get(s_))))

if __name__ == '__main__':
    main()
