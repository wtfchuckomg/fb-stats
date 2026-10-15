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
KP_YEARS = list(range(2010, date.today().year + 1))   # KPreps' brackets, each team where it really sat (Chuck, 2026-10-14)
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
    'TMP': 'Thomas More Prep', 'Hays TMP': 'Thomas More Prep', 'TMP-Marian': 'Thomas More Prep',
    'Salina Sacred Heart': 'Sacred Heart', 'Hutchinson Trinity': 'Hutch Trinity', 'Collegiate': 'Wichita Collegiate',
    'Maur Hill': 'Maur Hill-Mount', 'Maur Hill-Mount Academy': 'Maur Hill-Mount', 'St James Academy': 'St James',
    'Blue Valley SW': 'Blue Valley Southwest', 'Blue Valley NW': 'Blue Valley Northwest', 'Olathe NW': 'Olathe Northwest',
    'Wichita SE': 'Wichita Southeast', 'Wichita NW': 'Wichita Northwest', 'DeSoto': 'De Soto', 'KC Harmon': 'Harmon',
    'Pratt-Skyline': 'Skyline', 'Sharon Springs': 'Wallace County', 'Sharon Springs-Wallace Co.': 'Wallace County', 'Sharon Springs - Wallace Co.': 'Wallace County',
    'Atwood': 'Rawlins County', 'Atwood-Rawlins Co.': 'Rawlins County', 'Oberlin': 'Decatur', 'Oberlin-Decatur Co.': 'Decatur',
    'Tribune': 'Greeley County', 'Tribune-Greeley Co.': 'Greeley County', 'Western Plains-Healy': 'Western Plains',
    "St. John's-Beloit": "St John's", "St. John's-Tipton": "St John's", 'Mankato-Rock Hills': 'Rock Hills',
    'NE-Arma': 'Northeast-Arma', 'Lakeside-Downs': 'Lakeside', 'Centre-Lost Springs': 'Centre', 'SW Heights': 'Southwestern Heights',
    'Saint Francis': 'St Francis', 'Southern Coffey': 'Southern Coffey County', 'Jeff North': 'Jefferson County North',
    'Jeff Co. North': 'Jefferson County North', 'Jeff Co. West': 'Jefferson West', 'Lousiburg': 'Louisburg',
    'Saliina Central': 'Salina Central', 'Sylvan-Lucas': 'Sylvan-Lucas Unified', 'Minneola-Fowler': 'Minneola',
    # Basehor and Linwood merged in 1987: the archive's "Basehor" (1979) stays its own school (Chuck).
    # Gardner became Gardner-Edgerton in 1979: the archive's "Gardner" (1975, 1978) stays its own school (Chuck).
    'Crest': 'Colony-Crest', 'WaKeeney': 'WaKeeney-Trego', 'Trego': 'WaKeeney-Trego',
    'Peabody': 'Peabody-Burns', 'Topeka-Cornerstone Family': 'Topeka Cornerstone Family', 'Shawnee-St. Joseph': 'St Joseph',
    # the archive's typos
    'Clifton-Clye': 'Clifton-Clyde', 'M arysville': 'Marysville', 'Maryville': 'Marysville', 'Coglan': "St Mary's Colgan",
    'Pittsburg-Colgan': "St Mary's Colgan", 'Stocktion': 'Stockton', 'Lawrence Free': 'Lawrence Free State', 'Andover High': 'Andover',
    "Beloit-St. John's": "St John's", 'Dodge': 'Dodge City', 'Wichita Kapun': 'Kapaun Mt Carmel', 'Aqunas': 'St Thomas Aquinas',
    'Biship Miege': 'Bishop Miege', 'Lawence': 'Lawrence', 'Centrailia': 'Centralia', 'Frankforst': 'Frankfort',
    'Hays-TMP-Marian': 'Thomas More Prep', 'Blue Valley Randolph': 'BV Randolph', 'Logan-Palco': 'Logan',
    'Conway': 'Conway Springs', 'Caney': 'Caney Valley', 'Hutch-Trinity': 'Hutch Trinity',
    'Pasons': 'Parsons', 'Anderson Counity': 'Anderson County', 'Pretty Praire': 'Pretty Prairie', 'Pretty Prarie': 'Pretty Prairie',
    'So. Coffey Co.': 'Southern Coffey County', 'Wichita Carroll': 'Bishop Carroll', 'Desoto': 'De Soto', 'LaCross': 'La Crosse',
    'Centrallia': 'Centralia', "St. John's Beloit-Tipton": "St John's", 'Brewster-Triplains': 'Triplains-Brewster', 'N Valley': 'Northern Valley',
}
# Typos of schools that have no page here, so the same school reads the same way in every round.
TYPO = {'Sylvan': 'Sylvan Grove', 'Shawnee - St. Joe': 'Shawnee-St. Joseph', 'Shawnee-St. Joe': 'Shawnee-St. Joseph', 'Greesnsburg': 'Greensburg', 'Lurary': 'Luray', 'Lucus-Luray': 'Lucas-Luray', 'Waconada East': 'Waconda East',
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
        base = f'https://kpreps.com/kansas/history/playoff-brackets/{y}/' if y <= 2012 else f'https://kpreps.com/kansas/playoffs/{y}/'
        first = get(base + '?class=6A')
        for c in sorted(set(re.findall(rf'(?:playoffs|playoff-brackets)/{y}/\?class=([^"&]+)', first)) - SKIP_CLASSES):
            s = first if c == '6A' else get(base + f'?class={c}')
            parts = re.split(r'<div class="round(\d)Container">', s[s.find('bracketContainer'):])
            for i in range(1, len(parts), 2):
                for m in re.finditer(r'class="top\dTeam">(.*?)</div>\s*<div class="game\dContent">(.*?)</div>\s*<div class="bottom\dTeam">(.*?)</div>',
                                     parts[i + 1], re.S):
                    # 2010-12 write "Olathe East vs", and "Frankfort @" for the team on the road
                    raw = lambda x: re.sub(r'\s+vs\.?$', '', H.unescape(re.sub(r'<[^>]+>', '', x)).strip())
                    name = lambda x: re.sub(r'\s*@$', '', raw(x)).strip()
                    sc = re.search(r'(\d+)\s*-\s*(\d+)', name(m.group(2)))
                    a, b = name(m.group(1)), name(m.group(3))
                    if sc and a and b:
                        away = 'a' if raw(m.group(1)).endswith('@') else 'b' if raw(m.group(3)).endswith('@') else None
                        games.append({'y': y, 'c': c, 'rd': int(parts[i]), 'a': a, 'ap': int(sc.group(1)), 'b': b, 'bp': int(sc.group(2)),
                                      'ot': 'OT' in m.group(2), **({'away': away} if away else {})})
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
    # (year, class, round, winner, winner's points, loser, loser's points, overtime, which side won: 0 the top team, 1 the bottom)
    # From 2010 on KPreps' brackets are used, so each team keeps the spot it had; the archive prints the winner first.
    games = []
    # The archive prints the winner first; a few of its games have no score for the loser (them: null).
    # 2019 already had today's five rounds; the archive just named them its own way.
    Y2019 = {'First Round': 'Round 1', 'Second Round': 'Regional', 'Quarterfinals': 'Sectional', 'Semifinals': 'Sub-State', 'Championship': 'State'}
    for g in ppi:
        rnd = Y2019.get(g['r'], g['r']) if g['y'] == 2019 else OLD.get(g['r'], g['r'])
        if g['y'] >= KP_YEARS[0]: continue
        games.append((g['y'], g['c'], rnd, TYPO.get(g['w'], g['w']), g['ws'], TYPO.get(g['l'], g['l']), g['ls'], g['ot'], 0, None))
    last = {}
    for g in kp:
        last[(g['y'], g['c'])] = max(last.get((g['y'], g['c']), 0), g['rd'])
    for g in kp:
        rnd = MODERN[last[(g['y'], g['c'])] - g['rd']]
        a, b = (g['a'], g['ap']), (g['b'], g['bp'])
        (w, ws), (l, ls) = (a, b) if g['ap'] >= g['bp'] else (b, a)
        # Who was at home: KPreps puts the home team on top (every first-round game 2013-2025 checked against the
        # schools' schedules), and 2010-12 mark a top team on the road with "@".
        games.append((g['y'], g['c'], rnd, w, ws, l, ls, g['ot'], 0 if g['ap'] >= g['bp'] else 1, 1 if g.get('away') == 'a' else 0))
    # In 8-man, "Blue Valley" is the Randolph school (BV Randolph), not Blue Valley High in Overland Park.
    bv = lambda c, n: 'BV Randolph' if c.startswith('8M') and n == 'Blue Valley' else n
    games = [(y, c, rnd, bv(c, w), ws, bv(c, l), ls, ot, top, home) for y, c, rnd, w, ws, l, ls, ot, top, home in games]
    games = one_name(games)
    out = ROOT / 'playoffs'
    out.mkdir(exist_ok=True)
    order = {'Round 0': 0, 'Round 1': 1, 'First Round': 1, 'Regional': 2, 'Second Round': 2, 'Sectional': 3, 'Quarterfinals': 3,
             'Sub-State': 4, 'Semifinals': 4, 'Region': 4, 'State': 5}
    # Each game under the name of its column on the year's bracket, so a school's own history says what the bracket
    # says (Finals, Semifinals... from 1975; the names Chuck gave for 1969-74; KPreps' own from 2010).
    named = write_years(games, out, order)
    per = {}
    for i, (y, c, rnd, w, ws, l, ls, ot, *_) in enumerate(games):
        # 1969-70 Class 5A was the Wichita City League champion against the KC league's, not a playoff run: it stays off
        # the schools' own playoff histories (Chuck, 2026-10-14), but the year's brackets still show that title game.
        if c == '5A' and y in (1969, 1970):
            continue
        r, depth = named.get(i, (rnd, order.get(rnd, 9)))
        for me, us, opp, them, won in ((w, ws, l, ls, True), (l, ls, w, ws, False)):
            s = site(me)
            if not s:
                continue
            o = site(opp)
            per.setdefault(s, {}).setdefault((y, c), []).append({'r': r, 'o': o or opp, 'p': 1 if o else 0, 'us': us, 'them': them,
                                                                   'w': 1 if won else 0, **({'ot': 1} if ot else {}), '_d': depth})
    for s, seasons in per.items():
        rows = [{'y': y, 'c': c, 'g': [{k: v for k, v in g.items() if k != '_d'} for g in sorted(gs, key=lambda x: x['_d'])]}
                for (y, c), gs in sorted(seasons.items(), reverse=True)]
        (out / f'{slug(s)}.json').write_text(json.dumps({'school': s, 'seasons': rows}, separators=(',', ':')))
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
    for y, c, rnd, w, ws, l, ls, ot, *_ in games:
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
    return [(y, c, rnd, fix.get(((y, c), w), w), ws, fix.get(((y, c), l), l), ls, ot, *rest) for y, c, rnd, w, ws, l, ls, ot, *rest in games]


def write_years(games, out, order):
    """playoffs/years/<year>.json: each class's bracket, its games laid out the way a bracket is drawn — worked back
    from the final, each game sits over the two that sent its teams there (an empty slot where a team had a bye).
    playoffs/years/index.json lists the classes each year has."""
    team = lambda n, sc: {'n': site(n) or n, 's': sc, **({'p': 1} if site(n) else {})}
    by = {}
    named = {}   # game number → (its column's name, how far it is from the first column)
    for i, (y, c, rnd, w, ws, l, ls, ot, top, home) in enumerate(games):
        by.setdefault(y, {}).setdefault(c, []).append({'r': rnd, 'w': w, 'ws': ws, 'l': l, 'ls': ls, 'ot': ot, 'top': top, 'home': home, 'i': i})
    firsts = read_firsts()
    f = HERE / 'playoffs-firsts.json'
    sites = json.loads(f.read_text()).get('sites', {}) if f.exists() else {}
    notes = json.loads(f.read_text()).get('notes', {}) if f.exists() else {}
    called = json.loads(f.read_text()).get('rounds', {}) if f.exists() else {}
    labels = json.loads(f.read_text()).get('labels', {}) if f.exists() else {}
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
                    for t in (((g['w'], g['l']) if not g['top'] else (g['l'], g['w'])) if g else (None, None)):
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
                n = max(said, key=said.count) if said else ''
                if not n or n in used: n = PAD[min(d, len(PAD) - 1)]
                used.add(n); names.insert(0, n)
            # what the rounds were called at the time, where Chuck has said (1971: District, Regional, State)
            if len(called.get(str(y), {}).get(c, [])) == len(levels): names = called[str(y)][c]
            # 1976 on, until KPreps' own names (Chuck, 2026-10-15): Play-in, First Round, (Second Round,) Quarterfinals,
            # Sub-State (first called that in 1976), State — counted back from the final; rounds before the first full
            # one are play-ins.
            # 1975 and before (Chuck, 2026-10-16): District, Regional, Semifinals, State, counted back from the final;
            # games before the first full round are District Qualifying, or Regional Qualifying with no districts.
            # The same through 1980, the years Chuck has gone through, with the semifinal called Sub-State from 1976.
            elif y <= 1980:
                main = next((j for j, lv in enumerate(levels) if all(lv)), 0)
                back = ['State', 'Semifinals' if y <= 1975 else 'Sub-State', 'Regional', 'District'][:len(levels) - main][::-1]
                names = [('District' if 'District' in back else 'Regional') + ' Qualifying'] * main + back
            elif y < KP_YEARS[0]:
                main = next((j for j, lv in enumerate(levels) if all(lv)), 0)
                # 1976 is the first year the semifinal was called Sub-State (Chuck)
                back = ['State', 'Sub-State', 'Quarterfinals']
                rest = len(levels) - main - len(back)
                names = ['Play-in'] * main + ['First Round', 'Second Round', 'Third Round'][:max(rest, 0)] + back[:len(levels) - main][::-1]
            # a name over a first-round game (1969-70 5A: Region I, the Wichita game; Region II, Kansas City's)
            for t, lbl in labels.get(str(y), {}).get(c, {}).items():
                for g in levels[0]:
                    if g and (key(g['w']) == key(t) or key(g['l']) == key(t)): g['lbl'] = lbl
            # where a later round was played (Chuck's list: 1969's title games)
            for n, lv in zip(names, levels):
                here = sites.get(str(y), {}).get(c, {})
                at = here.get(n) or (here.get('State') if lv is levels[-1] else None)   # "State" means the title game
                for g in lv:
                    if g and at: g['at'] = at
            if y in firsts: levels = place(levels, firsts[y])
            # Seeds, where the bracket is the manual's seeded one: 6A-4A since 2019 (East, then West, eight games a side
            # paired 1-16, 8-9, 4-13, 5-12, 2-15, 7-10, 3-14, 6-11) and 3A-1A since 2024. The higher seed sits on top
            # and is at home in the first round.
            seeds = {}
            first = levels[0]
            if ((c in ('6A', '5A', '4A') and y >= 2019) or (c in ('3A', '2A', '1A') and y >= 2024)) and len(first) == 16 and all(first):
                for i, g in enumerate(first):
                    hi, lo = PAIRS[i % 8]
                    t, b = (g['w'], g['l']) if not g['top'] else (g['l'], g['w'])
                    seeds[key(t)], seeds[key(b)] = hi, lo
            def show(g, lead=False):
                W, L = team(g['w'], g['ws']), team(g['l'], g['ls'])
                for t, n in ((W, g['w']), (L, g['l'])):
                    if seeds.get(key(n)): t['sd'] = seeds[key(n)]
                # "PEN": a tie decided on penetrations (1969 SM North over SM South), else overtime
                ot = {'ot': g['ot'] if isinstance(g['ot'], str) else 1} if g['ot'] else {}
                out = {'a': L, 'b': W, 'w': 1, **ot} if g['top'] else {'a': W, 'b': L, **ot}   # w: the bottom team won
                if lead and g['home'] is not None: out['b' if g['home'] else 'a']['h'] = 1   # at home in the first round
                if g.get('hn'): (W if key(g['w']) == key(g['hn']) or same(g['w'], g['hn']) else L)['h'] = 1   # Chuck's lists
                if g.get('at'): out['at'] = g['at']
                if g.get('lbl'): out['lbl'] = g['lbl']   # where it was played, when Chuck has said
                return out
            for d, lv in enumerate(levels):
                for g in lv:
                    if g: named[g['i']] = (names[d], d)
            for g in third: named[g['i']] = ('Third place', len(levels))
            doc[c] = {'rounds': [{'name': names[i], 'games': [None if g is None else show(g, i == 0) for g in lv]}
                      for i, lv in enumerate(levels)],
                      **({'note': notes[str(y)][c]} if c in notes.get(str(y), {}) else {}),
                      **({'third': [show(g) for g in third]}
                         if third else {}),
                      # a game the archive printed that no slot leads to (a name spelled two ways, a missing round)
                      **({'extra': [{'r': g['r'], 'a': team(g['w'], g['ws']), 'b': team(g['l'], g['ls']), **({'ot': 1} if g['ot'] else {})}
                                    for g in extra]} if extra else {})}
        (ydir / f'{y}.json').write_text(json.dumps({'y': y, 'classes': doc}, separators=(',', ':')))
        index[y] = sorted(doc, key=lambda c: CLASS_ORDER.index(c) if c in CLASS_ORDER else 99)
    (ydir / 'index.json').write_text(json.dumps({str(y): index[y] for y in sorted(index, reverse=True)}, separators=(',', ':')))
    print(len(index), 'years;', lost, 'games that fit no bracket slot')
    return named


def read_firsts():
    """.github/kp/playoffs-firsts.json: first-round games Chuck has sent for years before KPreps, by year, each
    "A at B" (B at home), "A vs. B" (A at home) or "A vs. B at C" (at C), in bracket order. The class headings don't matter: a game is found
    in whichever of that year's brackets it was played (1969's "Class 1A" list carries the 8-man games too)."""
    f = HERE / 'playoffs-firsts.json'
    if not f.exists(): return {}
    out = {}
    for y, classes in json.loads(f.read_text()).items():
        if not y.isdigit(): continue
        rows = []
        for line in (l for ls in classes.values() for l in ls):
            m = re.match(r'(.+?)\s+vs\.?\s+(.+?)(?:\s+at\s+(.+))?$', line.strip(), re.I)
            # "A vs. B": A was at home (Chuck); with "at C" it was played at C
            if m:
                a, b = m[1], m[2]
                # At a neutral site named like one of the teams' towns (Dodge City vs. Wichita Southeast at Wichita
                # South HS), that team goes on top of its half (Chuck, 2026-10-16).
                if m[3] and near_site(b, m[3]) and not near_site(a, m[3]): a, b = b, a
                rows.append({'top': a, 'bot': b, 'at': m[3], 'home': None if m[3] else 0})
            elif re.match(r'(.+?)\s+at\s+(.+?)\s+at\s+(.+)$', line.strip(), re.I):   # "A at B at C": B's home game, played at C
                m = re.match(r'(.+?)\s+at\s+(.+?)\s+at\s+(.+)$', line.strip(), re.I)
                rows.append({'top': m[2], 'bot': m[1], 'at': m[3], 'home': 0})
            else:
                m = re.match(r'(.+?)\s+at\s+(.+)$', line.strip(), re.I)
                if m: rows.append({'top': m[2], 'bot': m[1], 'at': None, 'home': 0})   # the home team on top, as KPreps draws it
                elif re.match(r'(.+?)\s+[-–]\s+(.+)$', line.strip()):   # "A - B": only where they sat
                    m = re.match(r'(.+?)\s+[-–]\s+(.+)$', line.strip())
                    rows.append({'top': m[1], 'bot': m[2], 'at': None, 'home': None, 'place': True})
                else: print('playoffs-firsts.json: no game in', repr(line))
        out[int(y)] = rows
    return out


SITE_WORDS = {'high', 'school', 'stadium', 'college', 'state', 'university', 'field', 'community', 'memorial', 'bowl',
              # a school's side of town isn't its town: "SM South" isn't from "Wichita South HS"
              'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'central'}
def near_site(team, at):
    """Whether a neutral site carries a team's town in its name: a word of four letters or more they share."""
    words = lambda n: {w for w in re.findall(r'[a-z]+', n.lower()) if len(w) >= 4 and w not in SITE_WORDS}
    # the other ways the school is written count too ("St. John's-Beloit" is St John's, at Beloit HS)
    also = ' '.join(k for k, v in SAME.items() if site(team) and site(v) == site(team))
    return bool(words(at) & (words(team) | words(site(team) or '') | words(also)))


def place(levels, rows):
    """Turn a winner-on-top bracket into the one that was drawn: the games Chuck listed in his order, each listed
    team where he put it, and every later game with the team from the upper half on top."""
    def node(j, i):
        return {'j': j, 'g': levels[j][i] if i < len(levels[j]) else None, 'kids': [node(j - 1, 2 * i), node(j - 1, 2 * i + 1)] if j else []}
    # The round every team played in: the first one with no empty slots. Games before it are play-ins for teams
    # without a bye (1974 3A Shawnee-St. Joseph at Bonner Springs) and don't decide the order.
    main = next((j for j, lv in enumerate(levels) if all(lv)), 0)
    def is_(a, b): return key(a) == key(b) or same(a, b)
    def came_from(n, t):   # 0 or 1: the half a team came out of (the empty slot, for a team with a bye), else None
        k = [x['g'] for x in n['kids']]
        for i in (0, 1):
            if k[i] and is_(k[i]['w'], t): return i
        for i in (0, 1):
            if not k[i] and k[1 - i]: return i
        return None
    def walk(n):
        g, rank = n['g'], 10 ** 6
        for x in n['kids']: rank = min(rank, walk(x))
        k, r = n['kids'], None
        if g:
            hits = [r for r in rows if (is_(g['w'], r['top']) and is_(g['l'], r['bot']))
                    or (is_(g['w'], r['bot']) and is_(g['l'], r['top']))]
            # Where a bracket from the time placed the game ("A - B", 1981 on), that decides the order; a home-and-away
            # line for the same game then only marks who was home and where.
            r = next((r for r in hits if r.get('place')), hits[0] if hits else None)
            info = next((r for r in hits if not r.get('place')), None)
            if r:
                g['home'] = None
                if info and info['at']: g['at'] = info['at']
                g['hn'] = (info['top'] if info['home'] == 0 else None) if info else None   # the team at home
        # A team's first game (nothing feeds it): drawn the way Chuck listed it, home team on top. A later game stays
        # where the bracket puts it, the team from the upper half on top; the listing only says who was home.
        first = g and r and n['j'] <= main
        if n['j'] < main: rank = 10 ** 6
        if first:
            if n['j'] == main: rank = rows.index(r)
            g['top'] = 0 if is_(g['w'], r['top']) else 1
        if k:
            if k[1]['rank'] < k[0]['rank']: k.reverse()   # the half holding the earlier-listed game goes up
            if first:
                if came_from(n, g['l'] if g['top'] else g['w']) == 1: k.reverse()   # its listed top team's game goes up
            elif g and any(x['g'] for x in k): g['top'] = 1 if came_from(n, g['w']) == 1 else 0
        n['rank'] = rank
        return rank
    root = node(len(levels) - 1, 0)
    walk(root)
    out = [[] for _ in levels]
    def flat(n, j):
        out[j].append(n['g'])
        for x in n['kids']: flat(x, j - 1)
    flat(root, len(levels) - 1)
    return out


PAIRS = [(1, 16), (8, 9), (4, 13), (5, 12), (2, 15), (7, 10), (3, 14), (6, 11)]
PAD = ['State', 'Sub-State', 'Quarterfinals', 'Second Round', 'First Round']
CLASS_ORDER = ['6A', '5A', '4A', '4A-I', '4A-II', '3A', '2-1A', '2A', '1A', '8M', '8M-I', '8M-II', '6M']


if __name__ == '__main__':
    main()
