#!/usr/bin/env python3
"""The nightly check, after the nightly rebuild (.github/workflows/nightly.yml).

Chuck, 2026-10-16: "I think you should be doing nightly site checks, to make sure the site is running properly."
That day the State scoreboard had taken eight seconds to redraw, and nobody knew until he tried to type a score.

Opens each main page of both sites in a headless Chrome and checks three things:
  - it loads: the page's own content shows up within LOAD_LIMIT seconds
  - it doesn't break: no JavaScript error on the page
  - it draws fast: the page's own draw function, run again, takes under DRAW_LIMIT seconds

Writes health.json (what was measured, for looking back), prints a table, and fails the step if anything is wrong,
so GitHub's "run failed" email says so in the morning.

    python3 .github/healthcheck.py        needs: pip install playwright, and Chrome
"""
import json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
KMR = os.environ.get('SITE', 'https://stats.kansasmediarankings.com')
AV = 'https://avctlstats.com'
LOAD_LIMIT = 20     # seconds until the page's content is there (a phone on a slow line is slower than this machine)
DRAW_LIMIT = 1.5    # seconds for one redraw; the slow scoreboard took 8

# (name, address, what shows when it has loaded, the redraw to time)
PAGES = [
    ('Home', f'{KMR}/', 'body', None),
    ('State Scoreboard', f'{KMR}/?state', '#board .bgame', 'renderScoreboard()'),
    ('Butler County Scoreboard', f'{KMR}/?scores', '#board .bcard', 'renderScoreboard()'),
    ('State Stats', f'{KMR}/?statestats', 'table tr', 'renderCounty()'),
    ('Standings', f'{KMR}/?standings', '#board table', 'renderStandings()'),
    ('Team page', f'{KMR}/?team=Derby', '.tp-head', 'renderTeamPage()'),
    ('Team playoff history', f'{KMR}/?team=Derby&playoffs', '.po-recs', 'renderTeamPage()'),
    ('Playoff bracket', f'{KMR}/?brackets=1990&class=6A', '.ph-cell', None),
    ('AVCTL home', f'{AV}/', 'body', None),
    ('AVCTL scoreboard', f'{AV}/?scores', '#board .bcard', 'renderScoreboard()'),
]


def check(browser, name, url, ready, redraw):
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)[:200]))
    out = {'page': name, 'url': url, 'problems': []}
    t0 = time.time()
    try:
        page.goto(url, wait_until='domcontentloaded', timeout=LOAD_LIMIT * 1000)
        page.wait_for_selector(ready, timeout=LOAD_LIMIT * 1000)
        out['load_s'] = round(time.time() - t0, 1)
    except Exception as e:
        out['load_s'] = None
        out['problems'].append(f'did not load in {LOAD_LIMIT}s')
    if out['load_s'] is not None:
        page.wait_for_timeout(1500)   # the late data (the database, the logo list) settles
        if redraw:
            try:
                ms = page.evaluate(f'() => {{ const t = performance.now(); {redraw}; return performance.now() - t; }}')
                out['draw_s'] = round(ms / 1000, 2)
                if ms / 1000 > DRAW_LIMIT: out['problems'].append(f'redraw took {ms / 1000:.1f}s (limit {DRAW_LIMIT}s)')
            except Exception as e:
                out['problems'].append(f'redraw failed: {str(e)[:120]}')
        out['elements'] = page.evaluate('() => document.querySelectorAll("*").length')
    if errors:
        out['problems'].append('page error: ' + errors[0])
        out['errors'] = errors[:5]
    page.close()
    return out


def main():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(channel=os.environ.get('CHROME_CHANNEL', 'chrome'))
        results = [check(browser, *pg) for pg in PAGES]
        browser.close()
    bad = [r for r in results if r['problems']]
    (REPO / 'health.json').write_text(json.dumps({'checked': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                                                  'ok': not bad, 'pages': results}, indent=1))
    for r in results:
        print(f"{'FAIL' if r['problems'] else 'ok  '}  {r['page']:<26} load {r.get('load_s')}s  redraw {r.get('draw_s', '-')}s"
              f"  {r.get('elements', '')} elements  {'; '.join(r['problems'])}")
    if bad:
        print(f"\n{len(bad)} page(s) need a look.")
        sys.exit(1)


if __name__ == '__main__':
    main()
