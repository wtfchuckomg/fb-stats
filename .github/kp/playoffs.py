#!/usr/bin/env python3
"""Every Kansas playoff game a school has played, for the Playoff History card on its team page.

Chuck, 2026-10-13: "For each team page I'd like a playoff history" — Prep Power Index's archived pages for 2019 and
before, KPreps for 2020 on.

  1969-2015 and 2019  Prep Power Index (web.archive.org copies of preppowerindex.com/stateplayoffs.html and its decade
                      pages), parsed once into kp/playoffs-ppi.json. Its 2010s page was last archived in 2017 and stops
                      at 2015.
  2016-2018, 2020-    KPreps' brackets (kpreps.com/kansas/playoffs/<year>/?class=<class>), kept in kp/playoffs-kpreps.json.
                      Those three earlier years fill the gap the archive leaves.

Writes playoffs/<school>.json, one file per school with a page on the site, named the way its history/ file is
(the slug of the site's own name).

    python3 playoffs.py           fetches this season's brackets (once they exist), then writes every file
    python3 playoffs.py --all     fetches every KPreps year again first
"""
import json, re, sys, time, urllib.request, html as H
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from schedule import HERE, logo_index, slug   # the same name matching the schedules use

ROOT = HERE.parent.parent
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'}
KP_YEARS = [2016, 2017, 2018] + list(range(2020, date.today().year + 1))
SKIP_CLASSES = {'KCAA', 'KASC'}   # the Kansas Christian Athletic Association's own playoffs, not the KSHSAA's

IDX = logo_index()
# The archive and KPreps write some schools another way. Renames and spellings of one school only: a school that
# merged into another keeps its own name, so Claflin's titles aren't handed to Central Plains on a guess.
SAME = {
    'Aquinas': 'St Thomas Aquinas', 'Carroll': 'Bishop Carroll', 'Kapaun': 'Kapaun Mt Carmel', 'Wichita Kapaun': 'Kapaun Mt Carmel',
    'Topeka Seaman': 'Seaman', 'Topeka Hayden': 'Hayden', 'Colgan': "St Mary's Colgan", 'Pittsburg Colgan': "St Mary's Colgan",
    'KC Ward': 'Bishop Ward', 'Ward': 'Bishop Ward', 'Miege': 'Bishop Miege', 'SE-Saline': 'Southeast of Saline',
    'Southeast-Saline': 'Southeast of Saline', 'SE-Cherokee': 'Southeast (Cherokee)', 'Southeast-Cherokee': 'Southeast (Cherokee)',
    'Clifton-Cylde': 'Clifton-Clyde', 'LaCrosse': 'La Crosse', 'Lacrosse': 'La Crosse', 'Free State': 'Lawrence Free State',
    'Wichita North': 'North', 'TMP': 'Thomas More Prep', 'Hays TMP': 'Thomas More Prep', 'TMP-Marian': 'Thomas More Prep',
    'Salina Sacred Heart': 'Sacred Heart', 'Hutchinson Trinity': 'Hutch Trinity', 'Collegiate': 'Wichita Collegiate',
    'Maur Hill': 'Maur Hill-Mount', 'Maur Hill-Mount Academy': 'Maur Hill-Mount', 'St James Academy': 'St James',
    'Blue Valley SW': 'Blue Valley Southwest', 'Blue Valley NW': 'Blue Valley Northwest', 'Olathe NW': 'Olathe Northwest',
    'Wichita SE': 'Wichita Southeast', 'Wichita NW': 'Wichita Northwest', 'DeSoto': 'De Soto', 'KC Harmon': 'Harmon',
    'Pratt-Skyline': 'Skyline', 'Sharon Springs': 'Wallace County', 'Sharon Springs-Wallace Co.': 'Wallace County',
    'Atwood': 'Rawlins County', 'Atwood-Rawlins Co.': 'Rawlins County', 'Oberlin': 'Decatur', 'Oberlin-Decatur Co.': 'Decatur',
    'Tribune': 'Greeley County', 'Tribune-Greeley Co.': 'Greeley County', 'Western Plains-Healy': 'Western Plains',
    "St. John's-Beloit": "St John's", "St. John's-Tipton": "St John's", 'Mankato-Rock Hills': 'Rock Hills',
    'NE-Arma': 'Northeast-Arma', 'Lakeside-Downs': 'Lakeside', 'Centre-Lost Springs': 'Centre', 'SW Heights': 'Southwestern Heights',
    'Saint Francis': 'St Francis', 'Southern Coffey': 'Southern Coffey County', 'Jeff North': 'Jefferson County North',
    'Jeff Co. North': 'Jefferson County North', 'Jeff Co. West': 'Jefferson West', 'Lousiburg': 'Louisburg',
    'Saliina Central': 'Salina Central', 'Sylvan-Lucas': 'Sylvan-Lucas Unified', 'Minneola-Fowler': 'Minneola',
    'Crest': 'Colony-Crest', 'Jetmore': 'Hodgeman County', 'WaKeeney': 'WaKeeney-Trego', 'Trego': 'WaKeeney-Trego',
    'Peabody': 'Peabody-Burns', 'Topeka-Cornerstone Family': 'Topeka Cornerstone Family', 'Shawnee-St. Joseph': 'St Joseph',
    # the archive's typos
    'Clifton-Clye': 'Clifton-Clyde', 'M arysville': 'Marysville', 'Maryville': 'Marysville', 'Coglan': "St Mary's Colgan",
    'Pittsburg-Colgan': "St Mary's Colgan", 'Stocktion': 'Stockton', 'Lawrence Free': 'Lawrence Free State', 'Andover High': 'Andover',
    "Beloit-St. John's": "St John's", 'Dodge': 'Dodge City', 'Wichita Kapun': 'Kapaun Mt Carmel', 'Aqunas': 'St Thomas Aquinas',
    'Biship Miege': 'Bishop Miege', 'Lawence': 'Lawrence', 'Centrailia': 'Centralia', 'Frankforst': 'Frankfort',
    'Hays-TMP-Marian': 'Thomas More Prep', 'Blue Valley Randolph': 'BV Randolph', 'Logan-Palco': 'Logan', 'Basehor': 'Basehor-Linwood',
    'Gardner': 'Gardner-Edgerton', 'Conway': 'Conway Springs', 'Caney': 'Caney Valley', 'Hutch-Trinity': 'Hutch Trinity',
    'Pasons': 'Parsons', 'Anderson Counity': 'Anderson County', 'Pretty Praire': 'Pretty Prairie', 'Pretty Prarie': 'Pretty Prairie',
    'So. Coffey Co.': 'Southern Coffey County', 'Wichita Carroll': 'Bishop Carroll', 'Desoto': 'De Soto', 'LaCross': 'La Crosse',
    'Centrallia': 'Centralia', "St. John's Beloit-Tipton": "St John's", 'Brewster-Triplains': 'Triplains-Brewster', 'N Valley': 'Northern Valley',
}
# Typos of schools that have no page here, so the same school reads the same way in every round.
TYPO = {'Greesnsburg': 'Greensburg', 'Lurary': 'Luray', 'Lucus-Luray': 'Lucas-Luray', 'Waconada East': 'Waconda East',
        'Mdiway-Denton': 'Midway-Denton', 'Quenomo': 'Quenemo', 'Marias des Cygnes': 'Marais des Cygnes',
        'Stanley-Blue Valley': 'Blue Valley', 'Blue Valley-Stanley': 'Blue Valley', 'North Center': 'North Central',
        'School for Deaf': 'Kansas School for the Deaf', 'School for the Deaf': 'Kansas School for the Deaf', 'KSD': 'Kansas School for the Deaf', 'Midway': 'Midway-Denton', 'MDCV': 'Marais des Cygnes', 'Marais des Cygnes Valley': 'Marais des Cygnes'}
# Headings and notes the archive ran into a team's name: "Semfinals Olathe North", "Sedgwick had bye Meade".
JUNK = re.compile(r'^(?:sem\w*|champ\w*|quarter\w*|top bracke\s*t|bottom bracke\s*t|ot\)|\w+ had bye)\s+', re.I)


def norm(n):
    n = n.replace('’', "'").strip().rstrip('.')
    n = re.sub(r'\s*\((?:Mo|Neb|Okla|Colo|Iowa)\.?\)$', '', n)
    for a, b in [(r'^SM\b', 'Shawnee Mission'), (r'\bNW$', 'Northwest'), (r'\bSE$', 'Southeast'), (r'\bSW$', 'Southwest'),
                 (r'\bNE$', 'Northeast'), (r'\bCo\.?(?=\s|$)', 'County'), (r'^Jeff\b', 'Jefferson'), (r'^St\.\s*', 'St ')]:
        n = re.sub(a, b, n)
    return n


def site(n):
    """The site's name for a school, or None for one it has no page for (closed, merged, out of state)."""
    n = JUNK.sub('', n.replace('’', "'").strip())
    for c in (SAME.get(n), n, norm(n), SAME.get(norm(n))):
        if c and slug(c) in IDX:
            return IDX[slug(c)]
    return None


def get(u):
    for _ in range(3):
        try:
            return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=45).read().decode('utf-8', 'replace')
        except Exception:
            time.sleep(3)
    return ''


def fetch_kpreps(years, games):
    """KPreps' brackets for these years, in place of whatever was kept for them."""
    games = [g for g in games if g['y'] not in years]
    for y in years:
        first = get(f'https://kpreps.com/kansas/playoffs/{y}/?class=6A')
        for c in sorted(set(re.findall(rf'playoffs/{y}/\?class=([^"&]+)', first)) - SKIP_CLASSES):
            s = first if c == '6A' else get(f'https://kpreps.com/kansas/playoffs/{y}/?class={c}')
            parts = re.split(r'<div class="round(\d)Container">', s[s.find('bracketContainer'):])
            for i in range(1, len(parts), 2):
                for m in re.finditer(r'class="top\dTeam">(.*?)</div>\s*<div class="game\dContent">(.*?)</div>\s*<div class="bottom\dTeam">(.*?)</div>',
                                     parts[i + 1], re.S):
                    name = lambda x: H.unescape(re.sub(r'<[^>]+>', '', x)).strip()
                    sc = re.search(r'(\d+)\s*-\s*(\d+)', name(m.group(2)))
                    a, b = name(m.group(1)), name(m.group(3))
                    if sc and a and b:
                        games.append({'y': y, 'c': c, 'rd': int(parts[i]), 'a': a, 'ap': int(sc.group(1)), 'b': b, 'bp': int(sc.group(2)),
                                      'ot': 'OT' in m.group(2)})
            time.sleep(1)
    return games


# KSHSAA names for the rounds, counted back from the final (its manual's "playoff round designations").
MODERN = ['State', 'Sub-State', 'Sectional', 'Regional', 'Round 1', 'Round 0']
# Chuck, 2026-10-14: the archive's Semifinals are Sub-State, every year.
OLD = {'First Round': 'First Round', 'Second Round': 'Second Round', 'Quarterfinals': 'Quarterfinals', 'Semifinals': 'Sub-State',
       'Championship': 'State'}


def main():
    kp_file = HERE / 'playoffs-kpreps.json'
    kp = json.loads(kp_file.read_text()) if kp_file.exists() else []
    now = date.today().year
    want = KP_YEARS if '--all' in sys.argv else [y for y in KP_YEARS if y == now or not any(g['y'] == y for g in kp)]
    if date.today() < date(now, 10, 25):
        want = [y for y in want if y != now]   # no brackets before the season's last week
    if want:
        kp = fetch_kpreps(want, kp)
        kp_file.write_text(json.dumps(kp, separators=(',', ':')))
    kp = [g for g in kp if g['c'] not in SKIP_CLASSES]
    ppi = json.loads((HERE / 'playoffs-ppi.json').read_text())
    games = []   # (year, class, round, winner, winner's points, loser, loser's points, overtime)
    # The archive prints the winner first; a few of its games have no score for the loser (them: null).
    # 2019 already had today's five rounds; the archive just named them its own way.
    Y2019 = {'First Round': 'Round 1', 'Second Round': 'Regional', 'Quarterfinals': 'Sectional', 'Semifinals': 'Sub-State', 'Championship': 'State'}
    for g in ppi:
        rnd = Y2019.get(g['r'], g['r']) if g['y'] == 2019 else OLD.get(g['r'], g['r'])
        games.append((g['y'], g['c'], rnd, TYPO.get(g['w'], g['w']), g['ws'], TYPO.get(g['l'], g['l']), g['ls'], g['ot']))
    last = {}
    for g in kp:
        last[(g['y'], g['c'])] = max(last.get((g['y'], g['c']), 0), g['rd'])
    for g in kp:
        rnd = MODERN[last[(g['y'], g['c'])] - g['rd']]
        a, b = (g['a'], g['ap']), (g['b'], g['bp'])
        (w, ws), (l, ls) = (a, b) if g['ap'] >= g['bp'] else (b, a)
        games.append((g['y'], g['c'], rnd, w, ws, l, ls, g['ot']))
    # In 8-man, "Blue Valley" is the Randolph school (BV Randolph), not Blue Valley High in Overland Park.
    games = [(y, c, rnd, *[('BV Randolph' if c.startswith('8M') and n == 'Blue Valley' else n) for n in (w,)], ws,
              *[('BV Randolph' if c.startswith('8M') and n == 'Blue Valley' else n) for n in (l,)], ls, ot) for y, c, rnd, w, ws, l, ls, ot in games]
    games = one_name(games)
    per = {}
    for y, c, rnd, w, ws, l, ls, ot in games:
        # 1969-70 Class 5A was the Wichita City League champion against the KC league's, not a playoff run: it stays off
        # the schools' own playoff histories (Chuck, 2026-10-14), but the year's brackets still show that title game.
        if c == '5A' and y in (1969, 1970):
            continue
        for me, us, opp, them, won in ((w, ws, l, ls, True), (l, ls, w, ws, False)):
            s = site(me)
            if not s:
                continue
            o = site(opp)
            per.setdefault(s, {}).setdefault((y, c), []).append({'r': rnd, 'o': o or opp, 'p': 1 if o else 0, 'us': us, 'them': them,
                                                                   'w': 1 if won else 0, **({'ot': 1} if ot else {})})
    out = ROOT / 'playoffs'
    out.mkdir(exist_ok=True)
    order = {'Round 0': 0, 'Round 1': 1, 'First Round': 1, 'Regional': 2, 'Second Round': 2, 'Sectional': 3, 'Quarterfinals': 3,
             'Sub-State': 4, 'Semifinals': 4, 'State': 5}
    for s, seasons in per.items():
        rows = [{'y': y, 'c': c, 'g': sorted(gs, key=lambda x: order.get(x['r'], 9))} for (y, c), gs in sorted(seasons.items(), reverse=True)]
        (out / f'{slug(s)}.json').write_text(json.dumps({'school': s, 'seasons': rows}, separators=(',', ':')))
    write_years(games, out, order)
    print(len(per), 'schools,', len(games), 'games')


def near(a, b):
    """One letter added, dropped, changed or two swapped, in words of five letters or more."""
    if a == b: return True
    if min(len(a), len(b)) < 5 or abs(len(a) - len(b)) > 1: return False
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]: i += 1
    return a[i + 1:] == b[i + 1:] or a[i + 1:] == b[i:] or a[i:] == b[i + 1:] or (a[i + 2:] == b[i + 2:] and a[i:i + 2] == b[i:i + 2][::-1])


key = lambda n: site(n) or norm(n).lower()
def same(a, b):
    if key(a) == key(b): return True
    if site(a) and site(b): return False   # two schools this site knows apart (Andover and Andover Central)
    x, y = norm(a).lower().replace('-', ' ').replace('.', '').split(), norm(b).lower().replace('-', ' ').replace('.', '').split()
    if not x or not y: return False
    if len(x) == len(y) and all(p == q or near(p, q) for p, q in zip(x, y)): return True   # one letter off: a typo
    short, long_ = sorted((x, y), key=len)
    # "Kapaun" / "Wichita Kapaun", "Colgan" / "Pittsburg Colgan", and "Wichita" cut short of "Wichita Collegiate"
    # ... and "St. Joseph" for Shawnee-St. Joseph, "Trinity" for Hutch Trinity: the end of the longer name
    return ((x[-1] == y[-1] and (x[0] == y[0] or len(short) == 1)) or (len(short) == 1 and long_[0] == short[0])
            or (len(short) > 1 and long_[-len(short):] == short))


def one_name(games):
    """Within one year and class, a school printed two ways ("Hutch Trinity" in the first round, "Trinity" after it)
    gets one name everywhere: the one this site knows, else the longer. Only when the short form fits that one school."""
    names = {}
    for y, c, rnd, w, ws, l, ls, ot in games:
        names.setdefault((y, c), set()).update((w, l))
    fix = {}
    for yc, ns in names.items():
        for a in ns:
            # spellings of one school count once ("Hutchinson Trinity" and "Hutch Trinity" are both Hutch Trinity)
            like = list({key(b): b for b in sorted(ns, key=lambda n: (not site(n), -len(n))) if b != a and key(b) != key(a) and same(a, b)}.values())
            if len(like) != 1: continue
            b = like[0]
            if len({key(x) for x in ns if x != b and key(x) != key(b) and same(b, x)}) != 1: continue
            keep = max((a, b), key=lambda n: (bool(site(n)), len(n)))
            if keep != a: fix[(yc, a)] = keep
    return [(y, c, rnd, fix.get(((y, c), w), w), ws, fix.get(((y, c), l), l), ls, ot) for y, c, rnd, w, ws, l, ls, ot in games]


def write_years(games, out, order):
    """playoffs/years/<year>.json: each class's bracket, its games laid out the way a bracket is drawn — worked back
    from the final, each game sits over the two that sent its teams there (an empty slot where a team had a bye).
    playoffs/years/index.json lists the classes each year has."""
    team = lambda n, sc: {'n': site(n) or n, 's': sc, **({'p': 1} if site(n) else {})}
    by = {}
    for y, c, rnd, w, ws, l, ls, ot in games:
        by.setdefault(y, {}).setdefault(c, []).append({'r': rnd, 'w': w, 'ws': ws, 'l': l, 'ls': ls, 'ot': ot})
    ydir = out / 'years'
    ydir.mkdir(exist_ok=True)
    index, lost = {}, 0
    for y, classes in by.items():
        doc = {}
        for c, gs in classes.items():
            # The bracket comes from the games themselves, not from the round each was printed under (the archive swaps
            # some: 1974 8-Man lists McCracken beating Scandia a round after Luray beat McCracken). From the final back,
            # each team's slot is filled with the last game it won before that one.
            names = sorted({g['r'] for g in gs}, key=lambda r: order.get(r, 9))
            top = [g for g in gs if g['r'] == names[-1]]
            wins = lambda t: sum(1 for x in gs if key(x['w']) == key(t))
            final = max(top, key=lambda g: wins(g['w']) + wins(g['l']))   # the final, not a game for third place
            pool, levels = [g for g in gs if g is not final], [[final]]
            while True:
                prev = []
                for g in levels[0]:
                    for t in ((g['w'], g['l']) if g else (None, None)):
                        # the same name first; a short form or a typo only when nothing matches outright
                        cand = [x for x in pool if t and key(x['w']) == key(t)] or [x for x in pool if t and same(x['w'], t)]
                        # KPreps' rounds are right: there a team's earlier win has to come from an earlier round
                        if y in KP_YEARS: cand = [x for x in cand if order.get(x['r'], 0) < order.get(g['r'], 0)]
                        # the latest earlier win: by round, then by the order the source printed them in
                        m = max(cand, key=lambda x: (order.get(x['r'], 0), gs.index(x))) if cand else None
                        if m: pool.remove(m)
                        prev.append(m)
                if not any(prev): break
                levels.insert(0, prev)
            # Left over: a game for third place, played the week of the final by the two semifinal losers.
            third = [x for x in pool if x['r'] == final['r']]
            extra = [x for x in pool if x not in third]; lost += len(extra)
            # Each column is named for its games' own round, unless the source gave two columns one name (1985 8-Man I
            # printed its quarterfinals as "Semifinals"): then the column gets the name for its distance from the final.
            names, used = [], set()
            for d, lv in enumerate(reversed(levels)):
                said = [g['r'] for g in lv if g]
                n = max(set(said), key=said.count) if said else ''
                if not n or n in used: n = PAD[min(d, len(PAD) - 1)]
                used.add(n); names.insert(0, n)
            doc[c] = {'rounds': [{'name': names[i], 'games': [None if g is None else
                       {'a': team(g['w'], g['ws']), 'b': team(g['l'], g['ls']), **({'ot': 1} if g['ot'] else {})} for g in lv]}
                      for i, lv in enumerate(levels)],
                      **({'third': [{'a': team(g['w'], g['ws']), 'b': team(g['l'], g['ls']), **({'ot': 1} if g['ot'] else {})} for g in third]}
                         if third else {}),
                      # a game the archive printed that no slot leads to (a name spelled two ways, a missing round)
                      **({'extra': [{'r': g['r'], 'a': team(g['w'], g['ws']), 'b': team(g['l'], g['ls']), **({'ot': 1} if g['ot'] else {})}
                                    for g in extra]} if extra else {})}
        (ydir / f'{y}.json').write_text(json.dumps({'y': y, 'classes': doc}, separators=(',', ':')))
        index[y] = sorted(doc, key=lambda c: CLASS_ORDER.index(c) if c in CLASS_ORDER else 99)
    (ydir / 'index.json').write_text(json.dumps({str(y): index[y] for y in sorted(index, reverse=True)}, separators=(',', ':')))
    print(len(index), 'years;', lost, 'games that fit no bracket slot')


PAD = ['State', 'Sub-State', 'Quarterfinals', 'Second Round', 'First Round']
CLASS_ORDER = ['6A', '5A', '4A', '4A-I', '4A-II', '3A', '2-1A', '2A', '1A', '8M', '8M-I', '8M-II', '6M']


if __name__ == '__main__':
    main()
