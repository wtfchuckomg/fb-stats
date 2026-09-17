#!/usr/bin/env python3
"""Turn the crawled seasons into the small per-school files the site reads (history/<school>.json).

The site uses these for a school's Season dropdown, its last five games and the past meetings on a preview.
Written for every Kansas school, keyed the way KPreps writes the name ("towanda-circle"); the site matches its
own names to those through the ratings file.
"""
import json, re, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'history'


def main():
    OUT.mkdir(exist_ok=True)
    index, kept = [], 0
    for f in sorted((HERE / 'seasons').glob('*.json')):
        seasons, name = {}, f.stem
        for year, s in json.loads(f.read_text()).items():
            name = re.sub(r'^\d{4}\s+', '', s.get('name') or name).strip()
            games = [{k: v for k, v in g.items() if k in ('date', 'opp', 'at', 'res', 'us', 'them', 'ot')}
                     for g in s.get('games', [])]
            if games:
                seasons[year] = {'record': s.get('record', ''), 'games': games}
        if not seasons:
            continue
        (OUT / f'{f.stem}.json').write_text(json.dumps({'name': name, 'source': 'kpreps.com', 'seasons': seasons},
                                                       separators=(',', ':'), ensure_ascii=False))
        index.append({'slug': f.stem, 'name': name})
        kept += 1
    (OUT / 'index.json').write_text(json.dumps({'built': int(time.time() * 1000), 'teams': index}, separators=(',', ':')))
    print(f'{kept} schools written to history/')


main()
