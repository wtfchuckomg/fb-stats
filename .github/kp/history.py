#!/usr/bin/env python3
"""Turn the crawled seasons into the small per-school files the site reads (history/<school>.json).

The site uses these for a school's Season dropdown, its last five games and the past meetings on a preview.
Written for every Kansas school, keyed the way KPreps writes the name ("towanda-circle"); the site matches its
own names to those through the ratings file.
"""
import importlib.util, json, re, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'history'
# Seasons from 2000 that KPreps doesn't have (it starts in 2008) come from kansashsfootballhistory.com's pages, already
# crawled into .github/khsfh/raw (Chuck, 2026-10-26: "add in seasons through 2000 for each team"). No dates or sides there.
ARCHIVE_FROM = 2000


def archive_seasons():
    """Our slug -> {year: season} from the archive, for ARCHIVE_FROM on. Opponents carry our name for them where
    the archive's matches one of our schools, so the team pages can link them."""
    raw = HERE.parent / 'khsfh' / 'raw'
    if not raw.exists():
        return {}
    spec = importlib.util.spec_from_file_location('meetings', HERE.parent / 'khsfh' / 'meetings.py')
    M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
    ours = M.our_teams()
    match = M.matcher(ours)
    out = {}
    for f in sorted(raw.glob('*.json')):
        d = json.loads(f.read_text())
        me = match(d.get('name'))
        if not me:
            continue
        for year, s in (d.get('seasons') or {}).items():
            if not year.isdigit() or int(year) < ARCHIVE_FROM:
                continue
            games = []
            for g in s.get('games', []):
                them = match(g.get('opp'))
                row = {'opp': ours[them] if them else g.get('opp'), 'res': g.get('res')}
                if g.get('us') is not None and g.get('them') is not None:
                    row.update(us=g['us'], them=g['them'])
                note = g.get('note') or ''
                if 'ot' in note: row['ot'] = 1
                if note.startswith('p'): row['po'] = 1
                games.append(row)
            if games and len(games) > len((out.get(me) or {}).get(year, {}).get('games', [])):
                out.setdefault(me, {})[year] = {'record': s.get('record', ''), 'games': games, 'src': 'khsfh'}
    return out


def main():
    OUT.mkdir(exist_ok=True)
    index, kept = [], 0
    older = archive_seasons()
    for f in sorted((HERE / 'seasons').glob('*.json')):
        seasons, name = {}, f.stem
        for year, s in json.loads(f.read_text()).items():
            name = re.sub(r'^\d{4}\s+', '', s.get('name') or name).strip()
            games = [{k: v for k, v in g.items() if k in ('date', 'opp', 'at', 'res', 'us', 'them', 'ot')}
                     for g in s.get('games', [])]
            if games:
                seasons[year] = {'record': s.get('record', ''), 'games': games}
        for year, s in older.get(f.stem, {}).items():
            seasons.setdefault(year, s)          # KPreps' season, with dates and sides, wins where both have it
        if not seasons:
            continue
        (OUT / f'{f.stem}.json').write_text(json.dumps({'name': name, 'source': 'kpreps.com', 'seasons': seasons},
                                                       separators=(',', ':'), ensure_ascii=False))
        index.append({'slug': f.stem, 'name': name})
        kept += 1
    (OUT / 'index.json').write_text(json.dumps({'built': int(time.time() * 1000), 'teams': index}, separators=(',', ':')))
    print(f'{kept} schools written to history/')


main()
