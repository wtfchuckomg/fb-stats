#!/usr/bin/env python3
"""Every 11-man school in Kansas (6A-1A on KPreps' list, kp/teams.json), in this site's own names.

Prints the ELEVEN_MAN table for pb/21-teampages.js, the Teams page's list of schools. Run it again after a
reclassification and paste the result over the old table.
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from schedule import HERE, logo_index, resolve, short   # the same name matching the schedules use


def main():
    teams = [t for t in json.loads((HERE / 'teams.json').read_text()) if t['class'] in ('6A', '5A', '4A', '3A', '2A', '1A')]
    kpname = {}
    for t in teams:
        f = HERE / 'seasons' / (t['slug'] + '.json')
        d = json.loads(f.read_text()) if f.exists() else {}
        kpname[t['slug']] = short(next((v.get('name') for y, v in sorted(d.items(), reverse=True) if v.get('name')), t['slug']))
    ours = resolve(kpname, logo_index())
    missing = [s for s in kpname if s not in ours]
    names = sorted(set(ours.values()) | {kpname[s] for s in missing})
    print('const ELEVEN_MAN = [')
    for i in range(0, len(names), 8):
        print('  ' + ', '.join(json.dumps(n) for n in names[i:i + 8]) + ',')
    print('];')
    if missing:
        print('// no logo: ' + ', '.join(missing))


if __name__ == '__main__':
    main()
