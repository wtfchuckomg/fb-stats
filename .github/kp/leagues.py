#!/usr/bin/env python3
"""The leagues with a 2A-6A school in them, plus the Butler County schools' own leagues, from KPreps' league
pages, in the site's own names. It was 4A-6A until 2026-10-12, when Chuck added 3A and 2A. --all prints every
league KPreps has, 8-man and 6-man included.

Prints the LEAGUES table for pb/12c-leagues.js. Run it again if KPreps realigns a league, and paste the result
over the old table. The AVCTL isn't printed: its four divisions live in pb/12b-avctl.js.

A county school's league is kept whatever its class, so the 8-man pages are read too (Flinthills' league is
8-man) and this takes a minute longer than it used to. KPreps tags those names "(8-Man)" only to tell them
from its 11-man page of the same name; the tag isn't part of the league's name, so it comes off here.
"""
import json, re, sys, time, urllib.request
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from schedule import HERE, logo_index, resolve, short, slug   # the same name matching the schedules use

UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'}
BIG = {'6A', '5A', '4A', '3A', '2A'}
# The four Butler County schools that aren't in the AVCTL, as KPreps writes them: their leagues get a page
# whatever the class. COUNTY in pb/17-stats.js is the same list, in this site's names.
COUNTY = {'leon-bluestem', 'douglass', 'whitewater-remington', 'flinthills'}


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
        if name.startswith('Ark Valley'):
            continue

        page = get(f'https://kpreps.com/kansas/leagues/football/?l={lslug.strip()}&id={lid}')
        members = []
        for s_ in re.findall(r'teams/football/\?id=\d+&(?:amp;)?t=([a-z0-9\-]+)', page):
            if s_ not in members:
                members.append(s_)
        if '--all' in sys.argv or any(classes.get(s_) in BIG for s_ in members) or COUNTY & set(members):
            found.append((name, members))
        time.sleep(.6)
    # KPreps tags a name "(8-Man)" or "(6-Man)" only to tell it from an 11-man league of the same name. The tag
    # comes off unless that other league is on the list too: then both keep their pages apart.
    plain = lambda n: re.sub(r'\s*\((?:8|6)-Man\)$', '', n)
    taken = {n for n, _ in found if plain(n) == n}
    found = [(n if plain(n) in taken and plain(n) != n else plain(n), m) for n, m in found]
    ours = resolve({s_: kpname.get(s_, s_) for _, m in found for s_ in m}, logo_index())
    print('const LEAGUES = [')
    seen = set()
    for name, members in sorted(found):
        if slug(name) in seen:   # an 8-man league sharing an 11-man league's name, once the tag is off
            print(f'  // {name}: same slug as the league above — give one of them a different name')
        seen.add(slug(name))
        names = sorted(ours.get(s_) or kpname.get(s_) or s_.replace('-', ' ').title() for s_ in members)
        missing = [s_ for s_ in members if s_ not in ours]
        print(f"  {{slug:'{slug(name)}', name:{json.dumps(name)}, teams:{json.dumps(names)}}},"
              + (f'   // no logo: {", ".join(missing)}' if missing else ''))
    print('];')


if __name__ == '__main__':
    main()
