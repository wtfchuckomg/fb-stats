#!/usr/bin/env python3
"""The nightly rebuild, 3 a.m. Kansas time (.github/workflows/nightly.yml).

Opens the live site in a headless Chrome and lets the site's own code do the work, so every final, record and
player stat comes out exactly as the site works them out (they're replayed from the plays, in JavaScript):

  season.json  every shared game boiled down: teams, score, final or not (team pages, standings, scoreboards)
  stats.json   the numbers from every game with stats (the stats pages)
  g/<id>/      each game's preview page and score card, for links posted on social media
  embed/       the WordPress links, including one for each game with a gamecast

The site reads the database for anything saved after these files were written, so they're never wrong, only
slower to load the longer they go without a rebuild. One read of the shared games a night.

    python3 .github/nightly.py              needs: pip install playwright Pillow, and Chrome
"""
import json, os, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SITE = os.environ.get('SITE', 'https://stats.kansasmediarankings.com')
sys.path.insert(0, str(REPO / '.github'))

# Runs inside the site's page. ?gamecast= is the page that sets up the database through viewerApi() and nothing
# heavier, so asking viewerApi() again here gets the same connection.
BUILD = r"""
async () => {
  const {fsM, fsdb} = await viewerApi();
  const started = Date.now();
  const snap = await fsM.getDocs(fsM.query(fsM.collection(fsdb, 'pressbox'), fsM.where('public', '==', true)));
  const list = [];
  snap.forEach(d => {
    const v = d.data(); if (!v || v.deleted || !v.json) return;
    try { const x = JSON.parse(v.json); if (x && x.teams && x.teams.A && x.teams.H) list.push(Object.assign(x, {id:d.id})); } catch (e) {}
  });
  const side = T => ({name:T.name, abbr:T.abbr || '', color:T.color || '', mascot:T.mascot || '', rec:T.rec || '', hrec:T.hrec || ''});
  const tracked = x => x.kind !== 'score' && (!!(x.plays && x.plays.length) || !!x.box);
  // the players each game knows, for a school's roster card: names only
  const playersOf = x => {
    const out = {a:[], h:[]};
    try {
      if (x.box){ const b = boxData(x); if (b){ out.a = Object.keys(b.pl.A || {}).filter(n => n !== 'team'); out.h = Object.keys(b.pl.H || {}).filter(n => n !== 'team'); } }
      else if (x.plays && x.plays.length){ const r = replay(x);
        ['A', 'H'].forEach(s => { const roster = x.teams[s].roster || {};
          out[s === 'A' ? 'a' : 'h'] = Object.values(r.S.pl[s] || {}).filter(p => p.n !== 'team').map(p => playerName(rosterGet(roster, p.n, s)) || ('#' + p.n)); }); }
    } catch (e) {}
    return out;
  };
  const season = [], stats = [], cards = [], broken = [];
  list.forEach(x => {
    try {
      const f = finalOf(x);
      const e = {id:x.id, wk:gameWeek(x), date:x.date || '', kind:x.kind || '', a:side(x.teams.A), h:side(x.teams.H),
        fin:!!f.fin, live:!!f.live, status:f.status || '', q:f.q || 0, A:f.score.A, H:f.score.H,
        stats:tracked(x), box:!!x.box, updated:x.updated || 0};
      if (x.opp) e.opp = 1; if (x.sched) e.sched = 1; if (x.per) e.per = x.per; if (x.clk) e.clk = x.clk; if (x.time) e.time = x.time;
      if (e.stats){ const p = playersOf(x); if (p.a.length || p.h.length) e.pl = p; }
      season.push(e);
      if (tracked(x)){
        const n = gameNumbers(x);
        if (n){ const s = {id:x.id, wk:gameWeek(x), date:x.date || '', updated:x.updated || 0, numbers:n}; if (x.opp) s.opp = 1; stats.push(s); }
        const c = shareCard(x); cards.push({id:x.id, t:c.t, s:c.s});
      }
    } catch (err) { broken.push(x.id + ': ' + err.message); }
  });
  // Every player the stats know, with his jersey number from the rosters scorers have shared: one page and one
  // link card each (players.py).
  const rosters = {};
  const rs = await fsM.getDocs(fsM.query(fsM.collection(fsdb, 'pressbox'), fsM.where('public', '==', true), fsM.where('kind', '==', 'roster')));
  rs.forEach(d => {
    const v = d.data(); if (!v || v.deleted || !v.json) return;
    try {
      const r = JSON.parse(v.json), k = canonSchool(r.name), cur = rosters[k] || (rosters[k] = {});
      Object.entries(r.roster || {}).forEach(([no, nm]) => {
        const n = playerName(nm).toLowerCase();
        if (n && !cur[n]) cur[n] = String(no).split('/')[0];
      });
    } catch (e) {}
  });
  const P_KEYS = ['pc', 'pa', 'py', 'ptd', 'ru', 'ry', 'rtd', 're', 'rey', 'retd'];
  const pmap = {};
  stats.forEach(s => ['A', 'H'].forEach(side => {
    const sd = s.numbers[side];
    (sd.pl || []).forEach(row => {
      const nm = playerName(row.name);
      if (!nm || nm.startsWith('#') || nm === 'TEAM') return;
      const k = canonSchool(sd.name), key = k + '|' + nm.toLowerCase();
      const p = pmap[key] || (pmap[key] = Object.assign({name:nm, team:sd.name, no:(rosters[k] || {})[nm.toLowerCase()] || ''},
        Object.fromEntries(P_KEYS.map(x => [x, 0]))));
      P_KEYS.forEach(x => { p[x] += +row[x] || 0; });
    });
  }));
  return {built:started, season, stats, cards, players:Object.values(pmap), broken, read:snap.size};
}
"""


def main():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(channel=os.environ.get('CHROME_CHANNEL', 'chrome'))
        page = browser.new_page()
        page.goto(f'{SITE}/?gamecast=nightly-rebuild&embed=1', wait_until='domcontentloaded', timeout=60000)
        page.wait_for_function("typeof viewerApi === 'function' && typeof gameNumbers === 'function'", timeout=60000)
        out = page.evaluate(BUILD)
        browser.close()

    for b in out['broken']: print('could not read', b)
    old = json.loads((REPO / 'season.json').read_text()).get('games', []) if (REPO / 'season.json').exists() else []
    # A thin answer is far more likely a hiccup than half the season vanishing: keep yesterday's files instead.
    if len(out['season']) < max(10, int(len(old) * 0.8)):
        sys.exit(f"Only {len(out['season'])} games came back (the files have {len(old)}). Nothing changed.")
    compact = lambda o: json.dumps(o, separators=(',', ':'), ensure_ascii=False)
    (REPO / 'season.json').write_text(compact({'built': out['built'], 'games': out['season']}))
    (REPO / 'stats.json').write_text(compact({'built': out['built'], 'games': out['stats']}))
    print(f"read {out['read']} shared documents: {len(out['season'])} games, {len(out['stats'])} with stats")

    import previews
    previews.build((c['id'], c['t'], c['s']) for c in out['cards'])
    import players
    players.build(out.get('players') or [])
    subprocess.run([sys.executable, str(REPO / '.github' / 'embeds.py')], check=True)


if __name__ == '__main__':
    main()
