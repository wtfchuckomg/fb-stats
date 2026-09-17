#!/usr/bin/env python3
"""Every Kansas school's season-by-season results from kansashsfootballhistory.com.

That archive goes back to the 1890s, which is how a preview can show meetings from before the five
seasons we hold ourselves. One page a school, a second apart; their robots.txt asks nothing of us but
a crawl delay for bingbot, and this is gentler than that.

    python3 crawl.py           writes .github/khsfh/raw/<id>.json for all 503 schools
    python3 crawl.py 281 14    just those ids
"""
import json, re, sys, time, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW = HERE / 'raw'
SITE = 'https://www.kansashsfootballhistory.com'
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) kansasmediarankings.com preview history'}


def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:
            if i == tries - 1:
                print('  failed', url, e)
                return ''
            time.sleep(3 * (i + 1))


def schools():
    h = get(f'{SITE}/teams.cfm')
    return [(int(i), re.sub(r'\s*\([^)]*\)$', '', n).strip()) for i, n in
            re.findall(r'teams\.cfm\?id=(\d+)">([^<]+)</option>', h)]


def parse(html):
    """Each <article class="season-card"> is one season: the year, the record, and the games in order."""
    out = {}
    for card in html.split('<article class="season-card">')[1:]:
        y = re.search(r'season-year">(\d{4})<', card)
        if not y:
            continue
        rec = re.search(r'season-record">([^<]*)<', card)
        coach = re.search(r'<strong>Head Coach:</strong>\s*([^<]*)<', card)
        league = re.search(r'<strong>League:</strong>\s*([^<]*)<', card)
        games = []
        for row in card.split('<div class="game-row">')[1:]:
            res = re.search(r'result-chip (\w+)"', row)
            sc = re.search(r'game-score">\s*([\d]+)\s*-\s*([\d]+)\s*<', row)
            opp = re.search(r'game-opponent-prefix">[^<]*</span>\s*([^<]+?)\s*(?:<span class="game-opponent-note">([^<]*)</span>)?\s*</span>', row)
            if not opp:
                continue
            g = {'opp': re.sub(r'\s+', ' ', opp.group(1)).strip()}
            if sc:
                g['us'], g['them'] = int(sc.group(1)), int(sc.group(2))
            if res:
                g['res'] = res.group(1)[0].upper()
            note = (opp.group(2) or '').strip('() ').lower()
            if note:
                g['note'] = note
            games.append(g)
        out[y.group(1)] = {'record': rec.group(1).strip() if rec else '', 'games': games,
                           **({'coach': coach.group(1).strip()} if coach else {}),
                           **({'league': league.group(1).strip()} if league else {})}
    return out


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    want = [int(a) for a in sys.argv[1:] if a.isdigit()]
    all_schools = schools()
    print(f'{len(all_schools)} schools listed')
    (HERE / 'schools.json').write_text(json.dumps([{'id': i, 'name': n} for i, n in all_schools], indent=0))
    for n, (sid, name) in enumerate(all_schools, 1):
        if want and sid not in want:
            continue
        f = RAW / f'{sid}.json'
        if f.exists() and '--force' not in sys.argv:      # picking up where a stopped run left off
            continue
        html = get(f'{SITE}/teams.cfm?id={sid}')
        if not html:
            continue
        seasons = parse(html)
        f.write_text(json.dumps({'id': sid, 'name': name, 'seasons': seasons}, separators=(',', ':')))
        print(f'{n:4}/{len(all_schools)}  {name:28} {len(seasons):3} seasons', flush=True)
        time.sleep(1.0)


main()
