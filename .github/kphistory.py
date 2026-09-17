#!/usr/bin/env python3
"""Past seasons for the Butler County schools (and a few beside them), from each team's KPreps archive page.

KPreps keeps one page per team per year (archive.php?year=YYYY&id=<id>&t=<slug>) with every game's date,
opponent, home or away and result. This reads five seasons for the county's ten schools and writes one file per
school into history/, which the pregame page uses for past meetings between the two teams.

    python3 .github/kphistory.py            (from the repo root) writes history/
"""
import json, re, time, urllib.request
from html import unescape
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'history'
YEARS = [2025, 2024, 2023, 2022, 2021]
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
# The county's schools, with the name this site uses and their KPreps page.
TEAMS = [
    ('Andover', 33, 'andover'), ('Andover Central', 34, 'andover-central'), ('Augusta', 69, 'augusta'),
    ('Bluestem', 158, 'leon-bluestem'), ('Circle', 122, 'towanda-circle'), ('Douglass', 140, 'douglass'),
    ('El Dorado', 86, 'el-dorado'), ('Flinthills', 244, 'flinthills'), ('Remington', 191, 'whitewater-remington'),
    ('Rose Hill', 114, 'rose-hill'),
    # and the schools Chuck asked for beside them
    ('Mill Valley', 53, 'mill-valley'), ('Shawnee Mission West', 24, 'shawnee-mission-west'),
    ('Andale', 66, 'andale'), ('Wellington', 125, 'wellington'),
]
# Each row is its own block of the page; take everything up to the next one (the divs inside it are nested).
slugify = lambda s: re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', s.lower().strip()))


def text(s):
    return unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s))).strip()


def season(name, team_id, slug, year):
    url = f'https://kpreps.com/kansas/teams/football/archive.php?year={year}&id={team_id}&t={slug}'
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode('utf-8', 'replace')
    rec = re.search(r'Overall Record:\s*</strong>\s*([\d-]+)', html) or re.search(r'Overall Record:\s*([\d-]+)', text(html))
    games = []
    for row in html.split('<div class="scheduleRow">')[1:]:
        date = re.search(r'scheduleDate">([^<]*)', row)
        opp = re.search(r'scheduleOpp">(.*?)</div>', row, re.S)
        res = re.search(r'scheduleResult">(.*?)</div>', row, re.S)
        if not (date and opp):
            continue
        if text(opp.group(1)).lower() in ('opponent', ''):   # the table's own header row
            continue
        raw = text(opp.group(1))
        where = 'away' if raw.startswith('@') else 'home' if raw.lower().startswith('vs') else 'neutral'
        other = re.sub(r'^(@|vs\.?)\s*', '', raw).strip()
        r = text(res.group(1)) if res else ''
        m = re.match(r'([WLT])\s*(\d+)\s*-\s*(\d+)', r)
        g = {'date': (date.group(1) or '').strip(), 'opp': other, 'at': where}
        if m:
            g.update(res=m.group(1), us=int(m.group(2)), them=int(m.group(3)))
            if '| OT' in r or 'OT' in r.split('|')[-1]:
                g['ot'] = 1
        note = re.search(r'scheduleNotes">(.*?)</div>', row, re.S)
        if note and text(note.group(1)):
            g['note'] = text(note.group(1))
        games.append(g)
    return {'record': rec.group(1) if rec else '', 'games': games}


def main():
    OUT.mkdir(exist_ok=True)
    index = []
    for name, team_id, slug in TEAMS:
        out = {'name': name, 'kpreps': {'id': team_id, 'slug': slug}, 'source': 'kpreps.com', 'seasons': {}}
        for year in YEARS:
            try:
                out['seasons'][str(year)] = season(name, team_id, slug, year)
            except Exception as e:
                print(f'{name} {year}: {e}')
            time.sleep(.6)   # one page at a time, gently
        n = sum(len(s['games']) for s in out['seasons'].values())
        (OUT / f'{slugify(name)}.json').write_text(json.dumps(out, separators=(',', ':'), ensure_ascii=False))
        index.append({'name': name, 'file': f'{slugify(name)}.json', 'games': n})
        print(f'{name}: {n} games')
    (OUT / 'index.json').write_text(json.dumps({'built': int(time.time() * 1000), 'years': YEARS, 'teams': index}, separators=(',', ':')))


if __name__ == '__main__':
    main()
