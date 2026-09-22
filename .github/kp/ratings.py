#!/usr/bin/env python3
"""Our own ratings, from every Kansas result: a point spread, a total and a predicted score.

One least-squares fit over every team-game: the points a team scored are explained by
    mu + offense(team) + defense(opponent) + (home field / 2, minus it on the road)
with a ridge pull toward the middle so a two-game season can't run away, blowouts capped, and older seasons
counted less. A team's strength is offense minus defense; the spread is the difference in expected points.

    python3 ratings.py            reads kp/seasons/*.json, writes kp/ratings.json
    python3 ratings.py --check    holds back the last two weeks and reports how close it came
"""
import json, math, re, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
YEAR_NOW = 2026
# Settings chosen by walking through 2023, 2024 and 2025 week by week and scoring games the fit had not seen.
CAP = 99          # blowouts carry real information: capping them made the fit worse
RIDGE = 0.10      # how hard a team is pulled toward its class's level once it has played a few games
EARLY = 3.0       # and how much harder before that: a team with no games starts at its class's level
CLASS_PRIOR = 1.5 # points per class step (6A highest), where a team starts before it has played
# Schools Chuck says play above what the numbers alone show. Their strength is lifted by this much at the end;
# 0.15 is a 15% bump. Keyed by KPreps slug.
BUMP = {'kapaun-mt-carmel': .15, 'st-thomas-aquinas': .15, 'st-james-academy': .15, 'andale': .15, 'bishop-miege': .15}
# How much the past counts. Walked forward through 2025 and 2026 — fit on everything before a week, then score
# that week's games, 1,091 of them in 11-man — the old settings leaned far too hard on seasons already over:
# they missed the margin by 13.93 points and called 81.6% of winners, against 13.36 and 82.7% at these.
PREV = .50        # last season's weight in week 1...
PREV_DROP = .40   # ...falling by this much a week as this season fills in
PREV_FLOOR = .15  # but never below this
OLDER = .3        # each season before that counts this much again
# What a team has done lately, against what the fit expected of it. Worth 8 points a win above expectation:
# 13.23 and 83.1% in 11-man, and it helps 8-man and 6-man a little too. An explicit strength-of-schedule term
# was tried here as well and made every group worse — the fit already prices the schedule in, because each
# team's rating is worked out alongside its opponents'.
FORM = 8.0
W_YEAR = None     # worked out per season below
slug = lambda s: re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', (s or '').lower().strip()))


def day(year, d):
    """'9/11' in 2026 -> 20260911, so games sort by when they were played, not by text."""
    m = re.match(r'(\d{1,2})/(\d{1,2})', d or '')
    return int(year) * 10000 + (int(m.group(1)) * 100 + int(m.group(2)) if m else 0)


GROUP = {'6A':'11-man', '5A':'11-man', '4A':'11-man', '3A':'11-man', '2A':'11-man', '1A':'11-man',
         '8M-I':'8-man', '8M-II':'8-man', '6M':'6-man'}


def groups():
    """11-man, 8-man and 6-man are different games on different fields, so each gets its own fit."""
    return {t['slug']: GROUP.get(t['class'], '11-man') for t in json.loads((HERE / 'teams.json').read_text())}


def load():
    """Every game, once, as (year, week-ish date, home slug, away slug, home pts, away pts, neutral)."""
    teams, games, seen = {}, [], set()
    for f in sorted((HERE / 'seasons').glob('*.json')):
        me = f.stem
        for year, s in json.loads(f.read_text()).items():
            teams.setdefault(me, s.get('name') or me)
            for g in s.get('games', []):
                if g.get('us') is None or not g.get('oppSlug'):
                    continue
                other = g['oppSlug']
                home, away = (me, other) if g['at'] == 'home' else (other, me) if g['at'] == 'away' else (me, other)
                hp, ap = (g['us'], g['them']) if home == me else (g['them'], g['us'])
                key = (year, g.get('date', ''), *sorted([home, away]))
                if key in seen:
                    continue
                seen.add(key)
                games.append({'year': int(year), 'date': g.get('date', ''), 'day': day(year, g.get('date', '')),
                              'home': home, 'away': away, 'hp': hp, 'ap': ap, 'neutral': g['at'] == 'neutral'})
    return teams, games


def weights(season, played_weeks):
    prev = max(PREV_FLOOR, PREV - PREV_DROP * played_weeks)
    return {season: 1.0, season - 1: prev, season - 2: prev * OLDER, season - 3: prev * OLDER ** 2,
            season - 4: prev * OLDER ** 3, season - 5: prev * OLDER ** 4}


def fit(games, ignore=None, season=YEAR_NOW, played_weeks=0, cls=None):
    """Ridge least squares by coordinate descent: average points, each team's offense and defense, home field."""
    ig = ignore or (lambda g: False)
    wy = weights(season, played_weeks)
    rows = []
    for g in games:
        w = wy.get(g['year'], 0)
        if w <= .01 or ig(g):
            continue
        hp, ap = g['hp'], g['ap']
        if abs(hp - ap) > CAP:
            mid = (hp + ap) / 2
            hp, ap = (mid + CAP / 2, mid - CAP / 2) if hp > ap else (mid - CAP / 2, mid + CAP / 2)
        h = 0 if g['neutral'] else 1
        rows.append((g['home'], g['away'], hp, .5 * h, w))
        rows.append((g['away'], g['home'], ap, -.5 * h, w))
    names = sorted({r[0] for r in rows} | {r[1] for r in rows})
    off = {n: 0.0 for n in names}
    dfn = {n: 0.0 for n in names}
    order = ['6A', '5A', '4A', '3A', '2A', '1A']
    cls = cls or {}
    def step(n):
        c = cls.get(n)
        return CLASS_PRIOR * ((len(order) - 1) / 2 - order.index(c)) if c in order else 0.0
    prior = {n: step(n) for n in names}
    mu = sum(r[2] * r[4] for r in rows) / max(1e-9, sum(r[4] for r in rows))
    hfa = 2.0
    by_t, by_o = {}, {}
    for r in rows:
        by_t.setdefault(r[0], []).append(r)
        by_o.setdefault(r[1], []).append(r)
    for _ in range(60):
        num = den = 0.0
        for t, o, pts, hs, w in rows:
            if hs:
                num += w * hs * (pts - mu - off[t] - dfn[o]); den += w * hs * hs
        if den: hfa = num / den
        num = den = 0.0
        for t, o, pts, hs, w in rows:
            num += w * (pts - off[t] - dfn[o] - hs * hfa); den += w
        mu = num / den if den else mu
        for n in names:
            num = den = 0.0
            for t, o, pts, hs, w in by_t.get(n, []):
                num += w * (pts - mu - dfn[o] - hs * hfa); den += w
            k = RIDGE + EARLY * max(0.0, 1 - den / 4)
            off[n] = (num + k * prior[n] / 2) / (den + k)
        for n in names:
            num = den = 0.0
            for t, o, pts, hs, w in by_o.get(n, []):
                num += w * (pts - mu - off[t] - hs * hfa); den += w
            k = RIDGE + EARLY * max(0.0, 1 - den / 4)
            dfn[n] = (num - k * prior[n] / 2) / (den + k)
    gp = {}
    for t, o, *_ in rows:
        gp[t] = gp.get(t, 0) + 1
    return {'mu': mu, 'hfa': hfa, 'off': off, 'def': dfn, 'gp': gp}


def form_of(model, season_games):
    """Wins above what the fit expected, per game, for each team this season. A team beating schedules it was
    supposed to lose is telling us something the ratings haven't caught up with yet."""
    rate = lambda t: model['off'].get(t, 0) - model['def'].get(t, 0)
    out = {}
    for g in season_games:
        for me, you, pts, theirs, home in ((g['home'], g['away'], g['hp'], g['ap'], True),
                                           (g['away'], g['home'], g['ap'], g['hp'], False)):
            edge = rate(me) - rate(you) + (0 if g['neutral'] else (model['hfa'] if home else -model['hfa']))
            p = 1 / (1 + math.exp(-edge / 14))
            got = 1 if pts > theirs else .5 if pts == theirs else 0
            out.setdefault(me, []).append(got - p)
    return {t: sum(v) / len(v) for t, v in out.items()}


def predict(m, home, away, neutral=False):
    h = 0 if neutral else 1
    hp = m['mu'] + m['off'].get(home, 0) + m['def'].get(away, 0) + .5 * h * m['hfa']
    ap = m['mu'] + m['off'].get(away, 0) + m['def'].get(home, 0) - .5 * h * m['hfa']
    return hp, ap


def main():
    teams, games = load()
    grp = groups()
    print(f'{len(teams)} teams, {len(games)} games')
    def same(g):   # a game between two of the same kind of football
        a, b = grp.get(g['home']), grp.get(g['away'])
        return a and a == b
    if '--check' in sys.argv:
        for name in ('11-man', '8-man', '6-man'):
            mine = [g for g in games if same(g) and grp.get(g['home']) == name]
            cur = [g for g in mine if g['year'] == YEAR_NOW]
            dates = sorted({g['day'] for g in cur})
            held = set(dates[-2:])
            m = fit(mine, ignore=lambda g: g['year'] == YEAR_NOW and g['day'] in held)
            errs, terrs, right, n = [], [], 0, 0
            for g in cur:
                if g['day'] not in held: continue
                hp, ap = predict(m, g['home'], g['away'], g['neutral'])
                errs.append(abs((hp - ap) - (g['hp'] - g['ap'])))
                terrs.append(abs((hp + ap) - (g['hp'] + g['ap'])))
                right += (hp - ap > 0) == (g['hp'] - g['ap'] > 0); n += 1
            if n: print(f'{name}: {n} held-back games · margin off {sum(errs)/n:.1f} · total off {sum(terrs)/n:.1f} · winner right {right}/{n} ({100*right/n:.0f}%) · home field {m["hfa"]:.1f}')
        return
    if '--old' in sys.argv:
        cur = [g for g in games if g['year'] == YEAR_NOW]
        dates = sorted({g['date'] for g in cur})
        held = set(dates[-2:])
        print('holding back', held)
        m = fit(games, ignore=lambda g: g['year'] == YEAR_NOW and g['date'] in held)
        errs, terrs, right = [], [], 0
        for g in cur:
            if g['date'] not in held:
                continue
            hp, ap = predict(m, g['home'], g['away'], g['neutral'])
            errs.append(abs((hp - ap) - (g['hp'] - g['ap'])))
            terrs.append(abs((hp + ap) - (g['hp'] + g['ap'])))
            right += (hp - ap > 0) == (g['hp'] - g['ap'] > 0)
        n = len(errs)
        print(f'{n} games held back · margin off by {sum(errs)/n:.1f} on average · total off by {sum(terrs)/n:.1f} · winner right {right}/{n}')
        return
    out = {'built': 0, 'groups': {}, 'teams': {}}
    cls = {t['slug']: t['class'] for t in json.loads((HERE / 'teams.json').read_text())}
    weeks_in = len({g['day'] // 7 for g in games if g['year'] == YEAR_NOW})
    for name in ('11-man', '8-man', '6-man'):
        mine = [g for g in games if same(g) and grp.get(g['home']) == name]
        m = fit(mine, season=YEAR_NOW, played_weeks=weeks_in, cls=cls)
        form = form_of(m, [g for g in mine if g['year'] == YEAR_NOW])
        out['groups'][name] = {'mu': round(m['mu'], 2), 'hfa': round(m['hfa'], 2), 'games': len(mine)}
        for n in m['off']:
            off, dfn = m['off'][n], m['def'][n]
            f = form.get(n)
            if f:   # how it has gone this season against what the fit expected, half on each side of the ball
                off, dfn = off + FORM * f / 2, dfn - FORM * f / 2
            b = BUMP.get(n)
            if b:   # lift the school's strength, half from its offense and half from its defense
                lift = (off - dfn) * b / 2
                off, dfn = off + lift, dfn - lift
            out['teams'][n] = {'name': teams.get(n, n), 'group': name, 'off': round(off, 2), 'def': round(dfn, 2),
                               'rating': round(off - dfn, 2), 'gp': m['gp'].get(n, 0), **({'bump': b} if b else {})}
        top = sorted([r for r in out['teams'].values() if r['group'] == name], key=lambda r: -r['rating'])[:8]
        print(f"{name}: {len(mine)} games · home field {m['hfa']:.2f} · average points {m['mu']:.1f}")
        for r in top:
            print(f"   {r['rating']:6.1f}  {r['name']}")
    out['built'] = int(time.time() * 1000)
    out['slugs'] = sorted(out['teams'])
    (HERE / 'ratings.json').write_text(json.dumps(out, separators=(',', ':')))
    # the site reads this copy
    (HERE.parent.parent / 'ratings.json').write_text(json.dumps(out, separators=(',', ':')))


main()
