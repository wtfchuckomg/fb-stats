#!/usr/bin/env python3
"""A game's link card, made as soon as the game is final — not at 3 a.m.

Runs every quarter hour through Kansas evenings (.github/workflows/cards.yml). It opens the live site in a
headless Chrome (the database turns down plain web requests) and asks only for games saved since the last run,
so it costs a handful of reads. The nightly rebuild still does the full pass.

    python3 .github/cards-now.py       needs: pip install playwright Pillow, and Chrome
"""
import json, os, sys, time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / '.github'))
import previews

STATE = REPO / '.github' / 'cards-state.json'
SITE = os.environ.get('SITE', 'https://stats.kansasmediarankings.com')
LOOKBACK_MS = 6 * 60 * 60 * 1000

FETCH = r"""
async (since) => {
  const {fsM, fsdb} = await viewerApi();
  const snap = await fsM.getDocs(fsM.query(fsM.collection(fsdb, 'pressbox'),
    fsM.where('public', '==', true), fsM.where('updated', '>', since)));
  const out = [];
  snap.forEach(d => {
    const v = d.data();
    out.push({id:d.id, updated:v.updated || 0, kind:v.kind || '', deleted:!!v.deleted,
      card:v.card || null, teams:(() => { try { const x = JSON.parse(v.json || 'null'); return x && x.teams ? [x.teams.A.name, x.teams.H.name] : null; } catch (e) { return null; } })()});
  });
  return {now:Date.now(), rows:out};
}
"""


def since_ms():
    try:
        return int(json.loads(STATE.read_text())['since'])
    except Exception:
        return int(time.time() * 1000) - LOOKBACK_MS


def main():
    since = since_ms()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(channel=os.environ.get('CHROME_CHANNEL', 'chrome'))
        page = browser.new_page()
        page.goto(f'{SITE}/?gamecast=card-run&embed=1', wait_until='domcontentloaded', timeout=60000)
        page.wait_for_function("typeof viewerApi === 'function'", timeout=60000)
        got = page.evaluate(FETCH, since)
        browser.close()

    seed_path = REPO / '.github' / 'cards-seed.json'
    seed = json.loads(seed_path.read_text()) if seed_path.exists() else {}
    rows, newest = [], since
    for r in got['rows']:
        newest = max(newest, int(r.get('updated') or 0))
        if r['deleted'] or r['kind'] in previews.NOT_GAMES:
            continue
        card = r.get('card') or {}
        title, sub = card.get('t') or '', card.get('s') or ''
        if not title and r['id'] in seed:
            title, sub = seed[r['id']]['t'], seed[r['id']].get('s', '')
        # Only a game with a score on it: "Augusta 28, Independence 14".
        if title and previews.cards.sides_of(title):
            rows.append((r['id'], title, sub))
    print(f"{len(rows)} card{'' if len(rows) == 1 else 's'} to draw, from {len(got['rows'])} games saved since the last run")
    for _, title, sub in rows:
        print(f'  {title} — {sub}')
    if rows:
        previews.build(rows, keep_only=False)
    STATE.write_text(json.dumps({'since': max(newest, since), 'at': got['now']}) + '\n')


main()
