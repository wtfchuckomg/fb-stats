#!/usr/bin/env python3
"""Each logo school's mascot, from KPreps (Chuck, 2026-10-24: "Add all the teams mascots").

A KPreps team page is named "Mill Valley Jaguars", and every opponent's schedule writes the school as plain
"Mill Valley". The mascot is what's left of the first once the second comes off it, so a two-word mascot
("Blue Jays", "Golden Eagles") comes through whole. Written into logos/teams.json as "mascot"; a mascot the
admin typed in there already is left alone.

    python3 .github/kp/mascots.py
"""
import collections, json, re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
import sys; sys.path.insert(0, str(HERE))
import schedule as S


def main():
    full, plain = {}, collections.defaultdict(collections.Counter)
    for f in sorted((HERE / 'seasons').glob('*.json')):
        d = json.loads(f.read_text())
        for y, v in sorted(d.items(), reverse=True):
            if v.get('name') and f.stem not in full:
                full[f.stem] = re.sub(r'^\d{4}\s+', '', v['name'].strip())
            for g in v.get('games', []):
                if g.get('oppSlug') and g.get('opp'):
                    plain[g['oppSlug']][re.sub(r'^(at|vs\.?)\s+', '', g['opp'].strip())] += 1
    mascot = {}
    for s_, n in full.items():
        base = plain[s_].most_common(1)[0][0] if plain[s_] else ''
        if base and n.lower().startswith(base.lower() + ' '):
            mascot[s_] = n[len(base) + 1:].strip()
    idx = S.logo_index()
    ours = S.resolve({s_: S.short(n) for s_, n in full.items()}, idx)
    path = ROOT / 'logos' / 'teams.json'
    raw = json.loads(path.read_text())
    L = raw['list'] if isinstance(raw, dict) else raw
    by = {}
    for s_, m in mascot.items():
        if ours.get(s_):
            by.setdefault(ours[s_], m)
    added = 0
    for t in L:
        if not t.get('mascot') and by.get(t['name']):
            t['mascot'] = by[t['name']]; added += 1
    path.write_text(json.dumps(raw, indent=1, ensure_ascii=False) + '\n')
    have = sum(1 for t in L if t.get('mascot'))
    print(f'{added} mascots added; {have} of {len(L)} logo schools have one')
    print('No mascot:', ', '.join(sorted(t['name'] for t in L if not t.get('mascot'))))


if __name__ == '__main__':
    main()
