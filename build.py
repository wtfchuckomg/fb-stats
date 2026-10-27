#!/usr/bin/env python3
"""Build index.html for stats.kansasmediarankings.com out of the parts in pb/.

The whole site is one file: the page, its styles and its entire script. That
file is what GitHub Pages serves, so it is what gets committed — but editing
660KB by hand is no way to work, so the parts live in pb/ and this script
glues them back together.

    python3 build.py           build, write index.html, report what changed
    python3 build.py --check   build and compare only; write nothing

The same parts build a second site: AVCTLstats.com, the AVCTL's own fans-only
site, written to ~/Desktop/avctl-stats/ (its own repo, wtfchuckomg/avctl-stats). pb/0-site.js tells the script
which site it is, and a block of HTML marked <!--@kmr--> … <!--@end--> or
<!--@avctl--> … <!--@end--> goes only into that site's page.

Two things worth knowing before editing a part:

* Every .js part is concatenated into ONE <script>, so they all share one
  scope. A name declared at the top level of two parts is a SyntaxError that
  takes down the whole page. This script checks for that on every build.
* PARTS below is the build order, and it is authoritative. The number in a
  filename is only a label (7-sample.js is built last on purpose, because it
  boots the page once everything it calls exists).

History: the original parts were lost with a temp directory on 2026-09-16 and
were rebuilt by splitting the deployed index.html back apart, so a few of the
filenames are reconstructions rather than the originals.
"""

import base64
import hashlib
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PB = HERE / 'pb'

# The page shell: head and styles, the glass layer, the body markup (which ends
# with the opening <script> tag).
PARTS_HTML = ['1-head.html', '1b-glass.html', '1c-embed.html', '1d-skins.html', '2-body.html']

# The script, in the order it has to run.
PARTS_JS = [
    '0-site.js',         # which site this is (stats/KMR or AVCTLstats.com): first, so every part can ask
    '3-engine.js',       # a game is its plays; every score and stat is replayed from them
    '4-ui.js',           # scoreboard, field, play-entry pad
    '4b-quick.js',       # shorthand and plain-English play entry
    '4c-voice.js',       # calling the play out loud, on phones
    '5-views.js',        # views, dialogs, storage, events
    '10-logos.js',       # the school list and where each logo lives
    '11-gamecast.js',    # gamecast, line score, play-by-play, drive chart, box score
    '11b-print.js',      # the printed box score (the Print button)
    '12-xlsx.js',        # .xlsx export, written by hand, no library
    '12b-avctl.js',      # the AVCTL divisions and standings — before the pages that read them
    '12c-leagues.js',    # State › Leagues: every 4A-6A league's standings and stats — before the pages that read them
    '8-sync.js',         # Google sign-in and the per-account Firestore document
    '9-teams.js',        # saved teams: short name, colors, roster
    '13-scores.js',      # the week's scores strip
    '14-scorepage.js',   # the full scoreboard page
    '15-schedule.js',    # 2026 Butler County schedule data
    '16-box.js',         # games entered from a pasted box score
    '17-stats.js',       # season stats pages
    '19-home.js',        # home page and the how-to-keep-stats guide
    '20-start.js',       # start screen when no game is under way
    '21-teampages.js',   # the school index and each school's page
    '22-oppdata.js',     # opponents' 2026 schedules, from KPreps
    '23-classes.js',     # each school's class and league
    '24-rosters.js',     # rosters shared between scorers
    '26-others.js',      # admin: everyone else's games
    '27-winprob.js',     # win probability chart
    '28-schools.js',     # admin: the school list, short names, removals
    '29-embed.js',
    '30-pregame.js',     # ?preview=<id>: a game before kickoff
    '32-kpscores.js',   # Friday's KPreps finals, for games nobody tracked
    '33-schedfile.js',  # every logo school's schedule, from KPreps
    '34-player.js',     # ?player=<name>&team=<school>: one player's stats and game log
    '35-bracket.js',
    '36-turbo.js',    # importing a TurboStats gamecast as real plays    # ?bracket=4A: where the playoff bracket stands, seeded the KSHSAA way
    '36b-hudl.js',      # a Hudl box score by its link, read as a pasted one
    '37-avhome.js',      # AVCTLstats.com's front page: leaders and the four divisions
    '39-phistory.js',
    '40-matchup.js',    # ?matchup: any two schools, played 1,000 times (State › Matchup Calculator)   # ?brackets=<year>&class=<c>: every playoff bracket since 1969 (State › Playoff History)
    '38-address.js',    # the address bar follows the page
    '7-sample.js',       # the sample game, then boot. Always last.
]

# The scorer's tools, which no fan's visit runs: they go out as a file of their own, tracker-<hash>.js, that the
# Game Tracker loads before it starts (7-sample.js, loadTracker) and a scorer's phone fetches ahead so sw.js has it
# at a field with no signal (Chuck, 2026-10-27). They still share the one scope, and load after every other part.
TRACKER_JS = ['4b-quick.js', '4c-voice.js', '36-turbo.js', '36b-hudl.js', '12-xlsx.js']

# Anything declared at the top level of a part (column 0) shares one scope with
# every other part.
TOP_LEVEL = re.compile(r'^(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)')


def clashes(parts):
    """Top-level names declared in more than one part."""
    seen, dupes = {}, []
    for name, text in parts:
        for line in text.split('\n'):
            m = TOP_LEVEL.match(line)
            if not m:
                continue
            who = m.group(1)
            if who in seen and seen[who] != name:
                dupes.append((who, seen[who], name))
            seen.setdefault(who, name)
    return dupes


SITES = {'kmr': HERE, 'avctl': HERE.parent.parent / 'avctl-stats'}   # each site's page, and the folder it goes in: ~/Desktop/avctl-stats is that repo
MARKED = re.compile(r'<!--@(kmr|avctl)-->(.*?)<!--@end-->\n?', re.S)


def build(site='kmr'):
    missing = [p for p in PARTS_HTML + PARTS_JS if not (PB / p).exists()]
    if missing:
        sys.exit('missing parts: ' + ', '.join(missing))

    js = [(p, (PB / p).read_text(encoding='utf-8')) for p in PARTS_JS]
    if site == 'kmr':
        for who, first, second in clashes(js):
            print(f'! {who} is declared at the top level of both {first} and {second}')
    page = ''.join((PB / p).read_text(encoding='utf-8') for p in PARTS_HTML)
    page = MARKED.sub(lambda m: m.group(2) if m.group(1) == site else '', page)
    tracker = ''.join(text for p, text in js if p in TRACKER_JS)
    tname = f'tracker-{hashlib.sha256(tracker.encode()).hexdigest()[:10]}.js'
    page += ''.join(text.replace("'__SITE__'", f"'{site}'").replace("'__TRACKER__'", f"'{tname}'") if p == '0-site.js' else text
                    for p, text in js if p not in TRACKER_JS)
    page += '</script>\n'
    return page, (tname, tracker)


# Pictures the parts carry as data: addresses (the site mark, the home page art, the icons) go out as files in
# img/, named by their own hash (Chuck, 2026-10-27). Baked in, they were 125 KB of every visit's 436 KB, didn't
# compress, and were downloaded again with every new build; as files the browser keeps them.
DATA_IMG = re.compile(r'data:image/(png|jpeg|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=]{2000,})')
IMG_EXT = {'png': 'png', 'jpeg': 'jpg', 'gif': 'gif', 'webp': 'webp', 'svg+xml': 'svg'}


def pictures(page):
    files = {}
    def out(m):
        raw = base64.b64decode(m.group(2))
        name = f'img/{hashlib.sha256(raw).hexdigest()[:12]}.{IMG_EXT[m.group(1)]}'
        files[name] = raw
        return name
    return DATA_IMG.sub(out, page), files


def write_pictures(folder, files):
    d = folder / 'img'
    d.mkdir(exist_ok=True)
    for name, raw in files.items():
        f = folder / name
        if not f.exists() or f.read_bytes() != raw:
            f.write_bytes(raw)
    for f in d.iterdir():                     # only ever this script's files: a picture no part uses any more goes
        if f'img/{f.name}' not in files:
            f.unlink()


def main():
    check = '--check' in sys.argv
    changed = False
    for site, folder in SITES.items():
        page, (tname, tracker) = build(site)
        page, files = pictures(page)
        out = folder / 'index.html'
        old = out.read_text(encoding='utf-8') if out.exists() else ''
        same = old == page
        changed |= not same
        print(f'{site}: {len(page):,} chars, sha {hashlib.sha256(page.encode()).hexdigest()[:12]}'
              f' — {"unchanged" if same else "CHANGED"} from {out}')
        if check:
            continue
        folder.mkdir(parents=True, exist_ok=True)
        # stats/KMR also keeps a copy one folder up, where it has always been previewed from.
        for target in (out, HERE.parent / 'index.html') if site == 'kmr' else (out,):
            target.write_text(page, encoding='utf-8')
            write_pictures(target.parent, files)
            for old in target.parent.glob('tracker-*.js'):
                if old.name != tname:
                    old.unlink()
            (target.parent / tname).write_text(tracker, encoding='utf-8')
            print('wrote', target)
        # The offline cache, stamped with this build's own hash so a new page means a new cache.
        sw = (PB / 'sw.js').read_text(encoding='utf-8').replace('__BUILD__', hashlib.sha256(page.encode()).hexdigest()[:12])
        for target in (folder / 'sw.js', HERE.parent / 'sw.js') if site == 'kmr' else (folder / 'sw.js',):
            target.write_text(sw, encoding='utf-8')
            print('wrote', target)
        if site == 'avctl':
            (folder / 'CNAME').write_text('avctlstats.com\n', encoding='utf-8')   # GitHub Pages' custom domain
    return 1 if check and changed else 0


if __name__ == '__main__':
    sys.exit(main())
