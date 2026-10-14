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
        'Stanley-Blue Valley': 'Blue Valley-Stanley', 'Midway': 'Midway-Denton', 'MDCV': 'Marais des Cygnes', 'Marais des Cygnes Valley': 'Marais des Cygnes'}
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


def write_years(games, out, order):
    """playoffs/years/<year>.json: each class's bracket, its games laid out the way a bracket is drawn — worked back
    from the final, each game sits over the two that sent its teams there (an empty slot where a team had a bye).
    playoffs/years/index.json lists the classes each year has."""
    key = lambda n: site(n) or norm(n).lower()
    def same(a, b):
        if key(a) == key(b): return True
        x, y = norm(a).lower().replace('-', ' ').replace('.', '').split(), norm(b).lower().replace('-', ' ').replace('.', '').split()
        if not x or not y: return False
        if len(x) == len(y) and all(p == q or near(p, q) for p, q in zip(x, y)): return True   # one letter off: a typo
        short, long_ = sorted((x, y), key=len)
        # "Kapaun" / "Wichita Kapaun", "Colgan" / "Pittsburg Colgan", and "Wichita" cut short of "Wichita Collegiate"
        # ... and "St. Joseph" for Shawnee-St. Joseph, "Trinity" for Hutch Trinity: the end of the longer name
        return ((x[-1] == y[-1] and (x[0] == y[0] or len(short) == 1)) or (len(short) == 1 and long_[0] == short[0])
                or (len(short) > 1 and long_[-len(short):] == short))
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
            names = sorted({g['r'] for g in gs}, key=lambda r: order.get(r, 9))
            rounds = [[g for g in gs if g['r'] == r] for r in names]
            levels, extra = [rounds[-1][:1]], rounds[-1][1:]
            for r in range(len(rounds) - 2, -1, -1):
                pool, prev = list(rounds[r]), []
                for g in levels[0]:
                    for t in ((g['w'], g['l']) if g else (None, None)):
                        # the same name first; a short form or a typo only when nothing matches outright
                        m = next((x for x in pool if t and key(x['w']) == key(t)), None) or next((x for x in pool if t and same(x['w'], t)), None)
                        if m: pool.remove(m)
                        prev.append(m)
                lost += len(pool); extra += pool
                levels.insert(0, prev)
            doc[c] = {'rounds': [{'name': names[i], 'games': [None if g is None else
                       {'a': team(g['w'], g['ws']), 'b': team(g['l'], g['ls']), **({'ot': 1} if g['ot'] else {})} for g in lv]}
                      for i, lv in enumerate(levels)],
                      # a game the archive printed that no slot leads to (a name spelled two ways, a missing round)
                      **({'extra': [{'r': g['r'], 'a': team(g['w'], g['ws']), 'b': team(g['l'], g['ls']), **({'ot': 1} if g['ot'] else {})}
                                    for g in extra]} if extra else {})}
        (ydir / f'{y}.json').write_text(json.dumps({'y': y, 'classes': doc}, separators=(',', ':')))
        index[y] = sorted(doc, key=lambda c: CLASS_ORDER.index(c) if c in CLASS_ORDER else 99)
    (ydir / 'index.json').write_text(json.dumps({str(y): index[y] for y in sorted(index, reverse=True)}, separators=(',', ':')))
    print(len(index), 'years;', lost, 'games that fit no bracket slot')


CLASS_ORDER = ['6A', '5A', '4A', '4A-I', '4A-II', '3A', '2-1A', '2A', '1A', '8M', '8M-I', '8M-II', '6M']


if __name__ == '__main__':
    main()
