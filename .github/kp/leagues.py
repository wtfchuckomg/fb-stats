#!/usr/bin/env python3
"""The 11-man leagues with a 4A, 5A or 6A school in them, from KPreps' league pages, in the site's own names.

Prints the LEAGUES table for pb/12c-leagues.js. Run it again if KPreps realigns a league, and paste the result
over the old table. The AVCTL isn't printed: its four divisions live in pb/12b-avctl.js.
"""
import json, re, sys, time, urllib.request
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from schedule import HERE, logo_index, resolve, short, slug   # the same name matching the schedules use

UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'}
BIG = {'6A', '5A', '4A'}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode('utf-8', 'replace')


def main():
    classes = {t['slug']: t['class'] for t in json.loads((HERE / 'teams.json').read_text())}
    kpname = {}
    for f in (HERE / 'seasons').glob('*.json'):
        d = json.loads(f.read_text())
        kpname[f.stem] = short(next((v.get('name') for y, v in sorted(d.items(), reverse=True) if v.get('name')), f.stem))
    index = get('https://kpreps.com/kansas/leagues/')
    found = []
    for lslug, lid, raw in re.findall(r'leagues/football/\?l=([^"&]*)&(?:amp;)?id=(\d+)"[^>]*>(.*?)</a>', index, re.S):
        name = unescape(re.sub(r'<[^>]+>', '', raw)).strip()
        if re.search(r'\((?:8|6)-Man\)', name) or name.startswith('Ark Valley'):
            continue
        page = get(f'https://kpreps.com/kansas/leagues/football/?l={lslug.strip()}&id={lid}')
        members = []
        for s_ in re.findall(r'teams/football/\?id=\d+&(?:amp;)?t=([a-z0-9\-]+)', page):
            if s_ not in members:
                members.append(s_)
        if any(classes.get(s_) in BIG for s_ in members):
            found.append((name, members))
        time.sleep(.6)
    ours = resolve({s_: kpname.get(s_, s_) for _, m in found for s_ in m}, logo_index())
    print('const LEAGUES = [')
    for name, members in sorted(found):
        names = sorted(ours.get(s_) or kpname.get(s_) or s_.replace('-', ' ').title() for s_ in members)
        missing = [s_ for s_ in members if s_ not in ours]
        print(f"  {{slug:'{slug(name)}', name:{json.dumps(name)}, teams:{json.dumps(names)}}},"
              + (f'   // no logo: {", ".join(missing)}' if missing else ''))
    print('];')


if __name__ == '__main__':
    main()
