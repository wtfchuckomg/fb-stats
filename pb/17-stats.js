/* ================================================================
   BUCO Stats (?stats, or ?stats=rushing etc.): season stats for the
   Butler County schools, laid out like ESPN's stats pages, from every
   game that's been statted, live or entered from a box score. Quick
   scores have no stats, so they aren't counted. Built from the shared
   games, like the scoreboard, so everyone sees the same page.
   No defense: tackles and sacks are never complete (box scores don't
   carry them). Nor first downs, third downs, penalties or fumbles,
   which only live-statted games have.
   ================================================================ */
// State Stats (?statestats) is this same page for every school in the state, next to the State Scoreboard.
const STATE_STATS = new URLSearchParams(location.search).has('statestats');
const COUNTY_PAGE = new URLSearchParams(location.search).has('stats') || STATE_STATS || AV_STATS || LG_STATS;
const COUNTY = ['Andover', 'Andover Central', 'Augusta', 'Bluestem', 'Circle', 'Douglass', 'El Dorado', 'Flinthills', 'Remington', 'Rose Hill'];
const COUNTY_ALIASES = {Bluestem:['Leon-Bluestem'], Circle:['Towanda-Circle'], Remington:['Whitewater-Remington']};
// Which schools this page covers: Butler County, the AVCTL, a league (State › Leagues), or (State Stats) whoever
// turns up in the games.
const GROUP = AV_STATS ? AVCTL : LG_STATS ? LG.teams : COUNTY;
const GROUP_ALIASES = AV_STATS ? AVCTL_ALIASES : LG_STATS ? {} : COUNTY_ALIASES;
const groupOf = name => LG_STATS ? lgOf(name)
  : GROUP.find(c => [c, ...(GROUP_ALIASES[c] || [])].some(a => logoSlug(a) === logoSlug(name))) || null;
const countyOf = name => COUNTY.find(c => [c, ...(COUNTY_ALIASES[c] || [])].some(a => logoSlug(a) === logoSlug(name))) || null;
const groupName = () => AV_STATS ? 'AVCTL' : LG_STATS ? LG.name : STATE_STATS ? 'State' : 'BUCO';
const C_VIEWS = ['passing', 'rushing', 'receiving', 'scoring', 'kicking', 'team'];
const county = {games:null, err:'', team:'all', season:new Date().getFullYear(), view:'passing', sort:{}};

async function startCounty(){
  ui.viewer = true; ui.county = true; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  document.title = `${groupName()} Stats · Kansas Media Stats`;
  const want = new URLSearchParams(location.search).get(AV_STATS ? 'avstats' : LG_STATS ? 'lgstats' : STATE_STATS ? 'statestats' : 'stats');
  if (C_VIEWS.includes(want)) county.view = want;
  // &team=<school>, from a team's page: that team's stats (statewide, any school).
  const pickTeam = new URLSearchParams(location.search).get('team');
  if (GROUP.includes(pickTeam) || (STATE_STATS && pickTeam)) county.team = pickTeam;
  const pickSeason = +new URLSearchParams(location.search).get('season');   // &season=2025
  if (pickSeason) county.season = pickSeason;
  loadLogos(); renderCounty();
  try {
    // The admin's own devices (the Game Tracker marks them at sign-in) sign in here too, to set the minimums.
    let admin = false; try { admin = localStorage.getItem('pressbox.admin') === '1'; } catch (e) {}
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-`;
    const [appM, fsM, authM] = await Promise.all(['app', 'firestore', ...(admin ? ['auth'] : [])].map(m => import(base + m + '.js')));
    const app = appM.initializeApp(firebaseConfig);
    if (authM) authM.onAuthStateChanged(authM.getAuth(app), u => { ui.admin = !!u && u.uid === ADMIN_UID; renderCounty(); });
    const fsdb = fsM.getFirestore(app);
    scoresReady({fsM, fsdb});   // the week's scores strip, above the menu bar
    watchStatMins({fsM, fsdb});
    loadStats({fsM, fsdb});
  } catch (e) { county.err = 'Can’t reach the stats. Check your connection and reload.'; renderCounty(); }
}

// The season's numbers feed three pages: the stats pages, a pregame page, and the scoreboard, where a game
// that hasn't kicked off shows each team's season leaders where a played game shows its own.
function statsArrived(){ renderCounty(); if (ui.player) renderPlayer(); if (ui.preview) renderPreview(); if (ui.board) renderScoreboard(); }
// A game as the stats file carries it: the numbers already added up, and just enough around them to be
// filtered by week and team.
const statsGame = e => ({id:e.id, date:e.date || '', wk:e.wk, updated:e.updated || 0, opp:e.opp,
  teams:{A:{name:e.numbers.A.name}, H:{name:e.numbers.H.name}}, numbers:e.numbers});

// The season's numbers come from stats.json — worked out once instead of in every visitor's browser — and
// anything saved since that file was written comes live on top, so a box score pasted a minute ago is in.
async function loadStats(api){
  const {fsM, fsdb} = api;
  let built = 0;
  try {
    const r = await fetch('/stats.json', {cache:'no-cache'});
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (!d || !Array.isArray(d.games) || !d.games.length) throw new Error('empty');
    county.games = d.games.map(statsGame); built = d.built || 0; county.err = ''; statsArrived();
  } catch (e) { built = 0; }      // no file: ask for every game, the way this used to work
  const col = fsM.collection(fsdb, 'pressbox'), pub = fsM.where('public', '==', true);
  listenStats(fsM, built ? fsM.query(col, pub, fsM.where('updated', '>', built)) : fsM.query(col, pub), () => {
    // Refused (the public + updated index isn't there yet): read every game instead, so nothing is stale.
    console.warn('Kansas Media Stats: catch-up query refused, reading every game instead.');
    listenStats(fsM, fsM.query(col, pub), null);
  });
}
function listenStats(fsM, q, onRefused){
  fsM.onSnapshot(q, snap => {
    const by = new Map((county.games || []).map(x => [x.id, x]));
    snap.forEach(d => {
      const v = d.data(); if (!v || v.public !== true) return;
      if (v.deleted || v.kind === 'score' || !v.json){ by.delete(d.id); return; }
      try { const x = JSON.parse(v.json); if (x.teams && ((x.plays && x.plays.length) || x.box)) by.set(d.id, Object.assign(x, {id:d.id})); } catch (e) {}
    });
    county.games = [...by.values()]; county.err = ''; statsArrived();
  }, e => {
    if (onRefused) return onRefused(e);
    if (!county.games){ county.err = 'Can’t load the stats right now. Reload to try again.'; renderCounty(); }
  });
}

/* ---------- the numbers ---------- */
const seasonOf = x => fromYmd(gameWeek(x)).getFullYear();
function countySeasons(){
  const ys = new Set([new Date().getFullYear(), ...(STATE_STATS || AV_STATS || LG_STATS ? [] : [2025])]);   // 2025: Butler County's season leaderboard (25-stats2025.js)
  (county.games || []).forEach(x => ys.add(seasonOf(x)));
  return [...ys].sort((a, b) => b - a);
}
// The season's statted games, one per matchup a week: a game entered twice counts once, the newest copy.
function countyGames(){
  const season = new Set(seasonKeys(county.season)), pick = {};
  (county.games || []).forEach(x => {
    if (!season.has(gameWeek(x)) || isHidden(x)) return;   // nor any the admin has hidden
    const k = gameWeek(x) + '|' + [x.teams.A.name, x.teams.H.name].map(canonSchool).sort().join('|');
    if (!pick[k] || (x.updated || 0) > (pick[k].updated || 0)) pick[k] = x;
  });
  return Object.values(pick);
}
const T_KEYS = ['rushN', 'rushY', 'passC', 'passA', 'passY', 'passTD', 'passInt'];
// What the stats pages need from one game: the score, the quarters, each team's totals and each player's line.
// A game read from the site's own stats file arrives in this shape already (x.numbers); anything else is worked
// out from its plays or its box score, once.
function gameNumbers(x){
  if (x.numbers) return x.numbers;
  let r; try { r = replay(x); } catch (e) { return null; }
  const st = r.st;
  const side = s => ({
    name:x.teams[s].name, score:st.score[s], lines:st.lines[s],
    team:Object.fromEntries(T_KEYS.map(k => [k, +r.S.team[s][k] || 0])),
    pl:Object.values(r.S.pl[s]).filter(p => p.n !== 'team').map(p => {
      // A statted game keys players by number (named from its roster); a box score keys them by name.
      const name = /^\d+$/.test(p.n) ? playerName(rosterGet(x.teams[s].roster, p.n, s)) || playerName(fillName(x.teams[s].name, p.n, s)) || `#${p.n}` : playerName(p.n);
      // Return touchdowns: a box score's own count, or a statted game's touchdowns that weren't runs or catches.
      const ret = (+p.rettd || 0) + Math.max(0, (+p.tds || 0) - (+p.rtd || 0) - (+p.retd || 0));
      const row = {name};
      C_KEYS.forEach(k => { const v = k === 'ret' ? ret : k === 'two' ? +p.two || 0 : +p[k] || 0; if (v) row[k] = v; });
      return row;
    }).filter(row => C_KEYS.some(k => row[k]))
  });
  return {fin:!!st.final, q:st.q, A:side('A'), H:side('H')};
}
const C_KEYS = ['pc', 'pa', 'py', 'ptd', 'pint', 'ru', 'ry', 'rtd', 're', 'rey', 'retd', 'ret', 'two', 'fgm', 'fga', 'xpm', 'xpa'];
function countyStats(games){
  // Each team's own offense and, from the other side of the same games, what opponents did against it ('o' keys).
  const blank = c => Object.assign({name:c, gp:0, w:0, l:0, t:0, pf:0, pa:0, qf:[0, 0, 0, 0, 0], qa:[0, 0, 0, 0, 0], ot:false},
    zeros(T_KEYS), zeros(T_KEYS.map(k => 'o' + k)));
  const teams = Object.fromEntries((STATE_STATS ? [] : GROUP).map(c => [c, blank(c)])), players = {};
  // Whose side counts: in Butler County only its ten schools, by their proper names; statewide every school, one row
  // each however its name was typed (the first spelling seen names the row).
  const names = {}, sideOf = n => STATE_STATS ? (names[canonSchool(n)] || (names[canonSchool(n)] = n)) : groupOf(n);
  for (const x of games){
    const g = gameNumbers(x); if (!g) continue;
    ['A', 'H'].forEach(s => {
      const c = sideOf(g[s].name); if (!c) return;
      const o = other(s), T = teams[c] || (teams[c] = blank(c)), S = g[s].team, O = g[o].team;
      T.gp++; T.pf += g[s].score; T.pa += g[o].score;
      T_KEYS.forEach(k => { T[k] += +S[k] || 0; T['o' + k] += +O[k] || 0; });
      // Four quarters of their own; every overtime a game went to adds into the one OT column.
      const mine = g[s].lines || [], theirs = g[o].lines || [];
      for (let i = 0; i < Math.max(5, mine.length); i++){
        const j = Math.min(i, 4);
        T.qf[j] += +mine[i] || 0; T.qa[j] += +theirs[i] || 0;
      }
      if (g.q > 4 || mine[4] || theirs[4]) T.ot = true;
      if (g.fin) T[g[s].score > g[o].score ? 'w' : g[s].score < g[o].score ? 'l' : 't']++;
      g[s].pl.forEach(row => {
        if (!C_KEYS.some(k => +row[k])) return;
        // A number the game had no name for (baked into the stats file as "#8"): the school's saved roster may know it.
        // A class that rode along with the name ("Cole Brandt SR") is dropped here too.
        const nmr = /^#\d+$/.test(row.name) && playerName(fillName(g[s].name, row.name.slice(1), s)) || playerName(row.name);
        const key = `${c}|${nmr.toLowerCase()}`;
        const P = players[key] || (players[key] = Object.assign({name:nmr, team:c, gp:0}, zeros(C_KEYS)));
        P.gp++; C_KEYS.forEach(k => { P[k] += +row[k] || 0; });
      });
    });
  }
  // A bare last name from one box score ("Vega") joins the one full name on that team with it ("Pete Vega").
  Object.values(players).forEach(P => {
    if (P.name.includes(' ') || P.name.startsWith('#')) return;
    const k = P.name.toLowerCase(), full = Object.values(players).filter(Q => Q !== P && Q.team === P.team && Q.name.includes(' ') && lastName(Q.name) === k);
    if (full.length !== 1) return;
    const Q = full[0]; Q.gp += P.gp; C_KEYS.forEach(n => { Q[n] += P[n]; });
    delete players[`${P.team}|${k}`];
  });
  // One player spelled two ways in different box scores ("Kirchhoff-Jones", "Kirchoff-Jones"): same team, same first
  // name, last names one letter apart. The one with more games keeps the spelling.
  const oneOff = (a, b) => {
    if (a === b || Math.abs(a.length - b.length) > 1) return a === b;
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    return a.slice(i + (a.length >= b.length ? 1 : 0)) === b.slice(i + (b.length >= a.length ? 1 : 0));
  };
  const split = n => { const p = n.toLowerCase().split(/\s+/); return [p[0], p.slice(1).join(' ')]; };
  const list = Object.entries(players);
  list.forEach(([k1, P]) => list.forEach(([k2, Q]) => {
    if (k1 === k2 || !players[k1] || !players[k2] || P.team !== Q.team || !P.name.includes(' ') || !Q.name.includes(' ')) return;
    const [f1, l1] = split(P.name), [f2, l2] = split(Q.name);
    if (f1 !== f2 || l1 === l2 || Math.min(l1.length, l2.length) < 5 || !oneOff(l1, l2)) return;
    const [keep, drop, dk] = P.gp >= Q.gp ? [P, Q, k2] : [Q, P, k1];
    keep.gp += drop.gp; C_KEYS.forEach(n => { keep[n] += drop[n]; }); delete players[dk];
  }));
  return {teams:Object.values(teams), players:Object.values(players)};
}
// 2025: players' season totals from the leaderboard, with no games behind them; each team's offense is its players
// added up. Games played aren't known, so gp stays blank (per-game columns show a dash).
function countyStats2025(){
  const players = STATS_2025.map(r => Object.assign({gp:undefined, ret:0, two:0, fgm:0, fga:0, xpm:0, xpa:0}, r));
  const teams = COUNTY.map(c => {
    const T = Object.assign({name:c, gp:undefined, w:0, l:0, t:0, pf:0, pa:0, qf:[0, 0, 0, 0, 0], qa:[0, 0, 0, 0, 0], ot:false},
      zeros(T_KEYS), zeros(T_KEYS.map(k => 'o' + k)));
    players.filter(p => p.team === c).forEach(p => {
      T.rushN += p.ru; T.rushY += p.ry; T.passC += p.pc; T.passA += p.pa; T.passY += p.py; T.passTD += p.ptd; T.passInt += p.pint;
    });
    return T;
  });
  return {teams, players};
}

/* ---------- views. A column is [heading, value to sort by (null: none), decimals, text to show instead] ---------- */
const num = v => v == null || Number.isNaN(v) ? null : v;
const per = (a, b) => b ? a / b : null;
const tdAll = p => p.rtd + p.retd + p.ret;
const ptsOf = p => 6 * tdAll(p) + 3 * p.fgm + p.xpm + 2 * p.two;
// Passer rating, the NFL formula: four parts, each held between 0 and 2.375, so it runs 0 to 158.3.
const rating = p => {
  if (!p.pa) return null;
  const part = v => Math.max(0, Math.min(2.375, v));
  return (part((p.pc / p.pa - 0.3) * 5) + part((p.py / p.pa - 3) * 0.25) + part(p.ptd / p.pa * 20) + part(2.375 - p.pint / p.pa * 25)) / 6 * 100;
};
const P_VIEWS = {
  passing:{label:'Passing', keep:p => p.pa > 0, def:3, qual:p => p.pa, unit:'pass attempts', rate:['CMP%', 'AVG', 'RTG'], cols:[['CMP', p => p.pc], ['ATT', p => p.pa], ['CMP%', p => per(100 * p.pc, p.pa), 1], ['YDS', p => p.py],
    ['AVG', p => per(p.py, p.pa), 1], ['TD', p => p.ptd], ['INT', p => p.pint], ['RTG', rating, 1]]},
  rushing:{label:'Rushing', keep:p => p.ru > 0, def:1, qual:p => p.ru, unit:'carries', rate:['AVG'], cols:[['ATT', p => p.ru], ['YDS', p => p.ry], ['AVG', p => per(p.ry, p.ru), 1], ['TD', p => p.rtd]]},
  receiving:{label:'Receiving', keep:p => p.re > 0 || p.rey !== 0, def:1, qual:p => p.re, unit:'catches', rate:['AVG'], cols:[['REC', p => p.re], ['YDS', p => p.rey], ['AVG', p => per(p.rey, p.re), 1], ['TD', p => p.retd]]},
  scoring:{label:'Scoring', keep:p => ptsOf(p) > 0, def:7, groups:[['TOUCHDOWNS', 4], ['SCORING', 5]], cols:[['RUSH', p => p.rtd], ['REC', p => p.retd], ['RET', p => p.ret], ['TD', tdAll],
    ['FG', p => p.fgm], ['XP', p => p.xpm], ['2PT', p => p.two], ['PTS', ptsOf], ['PTS/G', p => per(ptsOf(p), p.gp), 1]]},
  kicking:{label:'Kicking', keep:p => p.fga > 0 || p.xpa > 0, def:6, qual:p => p.fga, unit:'field goal tries', rate:['FG%'], cols:[['FGM', p => p.fgm], ['FGA', p => p.fga], ['FG%', p => per(100 * p.fgm, p.fga), 1],
    ['XPM', p => p.xpm], ['XPA', p => p.xpa], ['XP%', p => per(100 * p.xpm, p.xpa), 1], ['PTS', p => 3 * p.fgm + p.xpm]]}};
// 2025's Scoring: the leaderboard has rushing and receiving touchdowns, no kicks or two-point tries.
const SCORING_25 = {label:'Scoring', keep:p => p.rtd + p.retd > 0, def:2, groups:[['TOUCHDOWNS', 3]],
  cols:[['RUSH', p => p.rtd], ['REC', p => p.retd], ['TD', p => p.rtd + p.retd]]};
const C_TABS = [['offense', 'Offense', 'passing'], ['scoring', 'Scoring', 'scoring'], ['special', 'Special Teams', 'kicking'], ['team', 'Team Stats', 'team']];
const tabOf = v => ({passing:'offense', rushing:'offense', receiving:'offense', scoring:'scoring', kicking:'special', team:'team'})[v];
const signed = v => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
const T_COLS = [['GP', t => t.gp], ['W-L', t => t.gp ? (t.w + t.t / 2) / t.gp + t.w / 1000 : null, 0, t => `${t.w}-${t.l}${t.t ? `-${t.t}` : ''}`],
  ['PF', t => t.pf], ['PA', t => t.pa], ['PF/G', t => per(t.pf, t.gp), 1], ['PA/G', t => per(t.pa, t.gp), 1],
  ['MARGIN/G', t => per(t.pf - t.pa, t.gp), 1, t => signed((t.pf - t.pa) / t.gp)]];
// The same columns for a team's own offense (p '') and for what its opponents did against it (p 'o').
function yardCols(p){
  const k = (t, n) => t[p + n], ry = t => k(t, 'rushY'), py = t => k(t, 'passY'), plays = t => k(t, 'rushN') + k(t, 'passA');
  return [['RUSH', t => k(t, 'rushN')], ['RUSH YDS', ry], ['RUSH/G', t => per(ry(t), t.gp), 1], ['YDS/CAR', t => per(ry(t), k(t, 'rushN')), 1],
    ['C/ATT', t => k(t, 'passC'), 0, t => `${k(t, 'passC')}/${k(t, 'passA')}`], ['PASS YDS', py], ['PASS/G', t => per(py(t), t.gp), 1], ['PASS TD', t => k(t, 'passTD')],
    [p ? 'INT MADE' : 'INT', t => k(t, 'passInt')], ['TOTAL YDS', t => ry(t) + py(t)], ['YDS/G', t => per(ry(t) + py(t), t.gp), 1], ['YDS/PLAY', t => per(ry(t) + py(t), plays(t)), 1]];
}
// Points for and against each quarter ("21-7"), sorted by the margin; halves after, and OT once there's been one.
function quarterCols(ot){
  const q = (t, i) => [i.reduce((a, n) => a + t.qf[n], 0), i.reduce((a, n) => a + t.qa[n], 0)];
  const col = (label, ...i) => [label, t => { const [f, a] = q(t, i); return f - a; }, 0, t => q(t, i).join('-')];
  return [col('1ST', 0), col('2ND', 1), col('3RD', 2), col('4TH', 3), ...(ot ? [col('OT', 4)] : []), col('1ST HALF', 0, 1), col('2ND HALF', 2, 3)];
}

/* ---------- minimums to rank in a rate (passer rating, yards per carry…), kept by the admin ---------- */
// One shared setting, like the hidden games: only the admin's account can change it, and anyone can read it.
// {passing:25} means a passer needs 25 attempts to be ranked when the table is sorted by RTG, CMP% or AVG.
// Totals (yards, touchdowns) rank everyone, the way ESPN does it.
const MINS_DOC = 'stat-minimums';
const statMins = {map:{}, api:null, unsub:null};
const statMin = view => Math.max(0, +statMins.map[view] || 0);
function watchStatMins(api){
  statMins.api = api;
  if (statMins.unsub) return;
  const {fsM, fsdb} = api;
  // Until the first minimum is saved there is no document, and reading it is refused: then there are none.
  statMins.unsub = fsM.onSnapshot(fsM.doc(fsdb, 'pressbox', MINS_DOC), snap => {
    const d = snap.exists() ? snap.data() : null;
    let map = {}; if (d && d.owner === ADMIN_UID && !d.deleted){ try { map = JSON.parse(d.json).views || {}; } catch (e) {} }
    statMins.map = map; if (ui.county) renderCounty();
  }, () => { statMins.unsub = null; });
}
async function saveStatMin(view, val){
  if (!ui.admin || !statMins.api) return toast('Sign in on the Game Tracker to set minimums');
  const n = Math.floor(+val);
  if (!(n >= 0) || n > 999) return toast('Type a number, or 0 for no minimum');
  const map = Object.assign({}, statMins.map);
  if (n) map[view] = n; else delete map[view];
  const {fsM, fsdb} = statMins.api;
  try {
    // Save first, then show it: a refused write must not leave the table ranked by a minimum nobody else sees.
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', MINS_DOC), {owner:ADMIN_UID, updated:Date.now(), public:true, kind:'minimums',
      title:'Minimums to rank', json:JSON.stringify({views:map})});
    statMins.map = map; renderCounty();
    toast(n ? `Minimum saved: ${n} ${P_VIEWS[view].unit}` : 'Minimum removed');
    if (!statMins.unsub) watchStatMins(statMins.api);   // the first save makes the document: follow it from now on
  } catch (e) { toast('Couldn’t save that. Sign in on the Game Tracker, then try again.'); }
}
// Under the table: what the minimum is, for everyone; a box to change it, for the admin.
function minLine(V, min){
  if (!V.qual) return '';
  const what = `to rank in ${V.rate.join(', ')}`;
  if (ui.admin) return `<div class="c-min"><label for="cmin">Minimum ${what}:</label><input id="cmin" type="number" inputmode="numeric" min="0" max="999" value="${min || ''}" placeholder="none"><span>${esc(V.unit)}</span><button type="button" data-cminsave>Save</button></div>`;
  return min ? `<div class="c-min">Minimum ${min} ${esc(V.unit)} ${what}.</div>` : '';
}

/* ---------- the table, ESPN style: rank, name, then numbers; the sorted column shaded ---------- */
function statTable(id, rows, cols, def, o){
  const s = county.sort[id] || {i:def, desc:!o.asc}, key = r => num(cols[s.i][1](r));
  // Sorted by a rate (RTG, AVG…) with a minimum set: players short of it go below everyone who has it, unranked.
  const q = o.qual && o.rate && o.rate.has(s.i) ? o.qual : null;
  // A team with no games yet always sorts to the bottom, whichever way the column runs; so do blanks.
  const sorted = rows.slice().sort((a, b) => {
    if ((a.gp === 0) !== (b.gp === 0)) return a.gp === 0 ? 1 : -1;
    if (q && q(a) !== q(b)) return q(a) ? -1 : 1;
    const x = key(a), y = key(b);
    if (x == null || y == null) return (x == null) - (y == null) || a.name.localeCompare(b.name);
    return (s.desc ? y - x : x - y) || a.name.localeCompare(b.name);
  });
  let rank = 0, prev, n = 0;   // ties share a rank
  const rk = sorted.map(r => { if (q && !q(r)) return ''; const v = key(r); if (n === 0 || v !== prev) rank = n + 1; prev = v; n++; return rank; });
  const firstShort = q ? sorted.findIndex(r => !q(r)) : -1;
  const cell = (c, r) => {
    if (r.gp === 0 && c[0] !== 'GP') return '—';
    if (c[3]) return c[3](r);
    const v = num(c[1](r)); return v == null ? '—' : c[2] ? v.toFixed(c[2]) : Math.round(v * 10) / 10;
  };
  const groups = o.groups ? `<tr class="cgrp"><th class="rk"></th><th class="nm"></th>${o.groups.map(([g, n]) => `<th colspan="${n}">${g}</th>`).join('')}</tr>` : '';
  return `<div class="tbl-wrap"><table class="ctbl"><thead>${groups}<tr><th class="rk">RK</th><th class="nm">${o.first || 'NAME'}</th>
      ${cols.map((c, i) => `<th class="num${i === s.i ? ' on' : ''}" data-csort="${id}:${i}"><span>${c[0]}</span>${i === s.i ? `<i>${s.desc ? '▾' : '▴'}</i>` : ''}</th>`).join('')}</tr></thead>
    <tbody>${sorted.map((r, j) => `${j === firstShort ? `<tr class="nq-hd"><td colspan="${cols.length + 2}">${esc(o.shortLabel || 'Below the minimum')}</td></tr>` : ''}<tr class="${[o.hi && o.hi(r) && 'hi', q && !q(r) && 'nq'].filter(Boolean).join(' ')}"><td class="rk">${rk[j]}</td><td class="nm"><div class="cn-in">${o.name(r)}</div></td>
      ${cols.map((c, i) => `<td class="num${i === s.i ? ' on' : ''}">${esc(String(cell(c, r)))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const cMark = name => markFor({name, abbr:shortName(name), color:'#4A4B4D'}, 26);   // phones: 22 (1-head.html)
// "Will Quinn" -> "W. Quinn"; one-word names and numbers ("#12") stay as they are.
const plShort = n => { const p = String(n).trim().split(/\s+/); return p.length < 2 || p[0].startsWith('#') ? n : `${p[0][0]}. ${p.slice(1).join(' ')}`; };
// Statewide: every school in the season's games, once each, by the first spelling seen (as countyStats names them).
// One entry per school, under the name this site uses, however the games spell it.
const sameTeamName = (a, b) => !!a && !!b && canonSchool(a) === canonSchool(b);
function stateTeamList(games){
  const seen = {};
  games.forEach(x => ['A', 'H'].forEach(s => { const k = canonSchool(x.teams[s].name); if (!seen[k]) seen[k] = schoolName(x.teams[s].name); }));
  return Object.values(seen).sort((a, b) => a.localeCompare(b));
}
function renderCounty(){
  if (!ui.county) return;
  const box = $('#board'), v = county.view, tab = tabOf(v), games = countyGames();
  const allLabel = STATE_STATS ? 'All Kansas Teams' : AV_STATS ? 'All AVCTL Teams' : LG_STATS ? `All ${LG.name} Teams` : 'All County Teams', teamList = STATE_STATS ? stateTeamList(games) : GROUP;
  const who = county.team === 'all' ? allLabel : county.team;
  const title = v === 'team' ? `${who} Team Stats ${county.season}` : `${who} Player ${P_VIEWS[v].label} Stats ${county.season}`;
  document.title = `${title} · ${groupName()} Stats`;
  const head = `<section class="bcard bhead"><div class="bhead-top"><h1 class="c-title">${esc(title)}</h1></div>
    <nav class="c-tabs">${C_TABS.map(([k, label, first]) => `<button type="button"${k === tab ? ' class="on"' : ''} data-cview="${first}">${label}</button>`).join('')}</nav>
    ${tab === 'offense' ? `<div class="c-pills">${['passing', 'rushing', 'receiving'].map(k => `<button type="button"${k === v ? ' class="on"' : ''} data-cview="${k}">${P_VIEWS[k].label}</button>`).join('')}</div>` : ''}
    <div class="c-filters"><select class="c-sel" id="cseason" aria-label="Season">${countySeasons().map(y => `<option value="${y}"${y === county.season ? ' selected' : ''}>${y}</option>`).join('')}</select>
      <select class="c-sel" id="cteam" aria-label="Team">${['all', ...teamList].map(c => `<option value="${esc(c)}"${county.team === c ? ' selected' : ''}>${c === 'all' ? allLabel : esc(c)}</option>`).join('')}</select></div></section>`;
  // 2025 comes from the season leaderboard, not games: passing, rushing, receiving and touchdowns, and nothing to load.
  const y25 = county.season === 2025 && !STATE_STATS && !AV_STATS && !LG_STATS, note = t => `<section class="bcard"><p class="bempty">${esc(t)}</p></section>`;
  let body;
  if (county.err && !y25) body = note(county.err);
  else if (!county.games && !y25) body = note('Loading stats…');
  else {
    const {teams, players} = y25 ? countyStats2025() : countyStats(games);
    if (v === 'team'){
      const o = {first:'TEAM', name:t => `${cMark(t.name)}<a class="tlink" href="?team=${encodeURIComponent(t.name)}"><b>${esc(t.name)}</b></a>`, hi:t => sameTeamName(t.name, county.team)};
      const card = (title, id, cols, def, asc) => `<section class="bcard ccard"><div class="ccard-hd"><h2>${title}</h2></div>${statTable(id, STATE_STATS ? teams.filter(t => t.gp) : teams, cols, def, {...o, asc})}</section>`;
      if (y25){
        const cols = yardCols('').filter(c => !c[0].endsWith('/G'));
        body = card('Offense', 'off25', cols, cols.findIndex(c => c[0] === 'TOTAL YDS'))
          + note('The 2025 leaderboard has each player’s season totals, so these are the players added up. Records, points and defense aren’t in it.');
      } else {
        const qcols = quarterCols(teams.some(t => t.ot));
        body = card('Team Totals', 'team', T_COLS, 1) + card('Offense', 'off', yardCols(''), 10) + card('Defensive Team Stats', 'allow', yardCols('o'), 10, true)
          + card('Scoring by Quarter (for-against)', 'qtr', qcols, qcols.length - 2);
      }
    } else if (y25 && v === 'kicking') body = note('The 2025 leaderboard has no kicking stats.');
    else {
      const V = y25 && v === 'scoring' ? SCORING_25 : P_VIEWS[v], rows = players.filter(p => V.keep(p) && (county.team === 'all' || sameTeamName(p.team, county.team)));
      // Phones show the short form, like ESPN's ("W. Quinn").
      const name = p => `${cMark(p.team)}<a class="c-pl" href="${playerHref(p.name, p.team)}"><b><span class="pl-full">${esc(p.name)}</span><span class="pl-short">${esc(plShort(p.name))}</span></b><small>${esc(shortName(p.team))}${p.yr ? `<span class="pl-yr"> · ${esc(p.yr)}</span>` : ''}</small></a>`;
      // 2025's tables keep their own sort (its Scoring has fewer columns than this season's).
      const min = V.qual ? statMin(v) : 0, rateAt = new Set((V.rate || []).map(h => V.cols.findIndex(c => c[0] === h)));
      const mo = min ? {qual:p => V.qual(p) >= min, rate:rateAt, shortLabel:`Under ${min} ${V.unit}`} : {};
      body = `<section class="bcard ccard">${rows.length ? statTable(y25 ? v + '25' : v, rows, V.cols, V.def, {name, groups:V.groups, ...mo})
        : `<p class="bempty" style="padding:4px 20px 10px">No ${V.label.toLowerCase()} stats yet${county.team === 'all' ? '' : ` for ${esc(county.team)}`}.</p>`}${minLine(V, min)}</section>`;
    }
  }
  // A league's stats sit under its tabs: Standings, Player Stats, Team Stats.
  box.innerHTML = (AV_STATS || LG_STATS ? leagueNav(v === 'team' ? 'team' : 'players') : '') + head + body;
}
document.addEventListener('click', e => {
  if (!ui.county || !e.target.closest) return;
  if (e.target.closest('[data-cminsave]')) return saveStatMin(county.view, $('#cmin') && $('#cmin').value);
  const vb = e.target.closest('[data-cview]');
  if (vb){
    county.view = vb.dataset.cview;
    // The address keeps the page it's on: a league's, the AVCTL's, the state's or the county's.
    const at = LG_STATS ? `league=${LG.slug}&lgstats` : AV_STATS ? 'avstats' : STATE_STATS ? 'statestats' : 'stats';
    history.replaceState(null, '', `?${at}=${county.view}`);
    return renderCounty();
  }
  const th = e.target.closest('[data-csort]'); if (!th) return;
  const [id, i] = th.dataset.csort.split(':'), cur = county.sort[id];
  county.sort[id] = {i:+i, desc:cur && cur.i === +i ? !cur.desc : true};
  renderCounty();
});
document.addEventListener('keydown', e => {
  if (ui.county && e.key === 'Enter' && e.target.id === 'cmin') saveStatMin(county.view, e.target.value);
});
document.addEventListener('change', e => {
  if (!ui.county) return;
  if (e.target.id === 'cteam'){ county.team = e.target.value; renderCounty(); }
  if (e.target.id === 'cseason'){ county.season = +e.target.value; renderCounty(); }
});
/* Where each school's logo is. The stats site's own logos folder first (the set Chuck uploaded 2026-09-15),
   then whatever Media Rankings or Pick 'Em had for schools that set doesn't cover. Generated by logomap.py,
   then updated in place when the new logo set landed. */
const LOGO_MAP = {
"abilene": "https://stats.kansasmediarankings.com/logos/Abilene.png",
"altoona-midway": "https://stats.kansasmediarankings.com/logos/Altoona-Midway.png",
"andale": "https://stats.kansasmediarankings.com/logos/Andale.png",
"anderson-county": "https://stats.kansasmediarankings.com/logos/Anderson%20County.png",
"andover": "https://stats.kansasmediarankings.com/logos/Andover.png",
"andover-central": "https://stats.kansasmediarankings.com/logos/Andover%20Central.png",
"aquinas": "https://stats.kansasmediarankings.com/logos/St%20Thomas%20Aquinas.png",
"argonia": "https://stats.kansasmediarankings.com/logos/Argonia.png",
"arkansas-city": "https://stats.kansasmediarankings.com/logos/Arkansas%20City.png",
"ashland": "https://stats.kansasmediarankings.com/logos/Ashland.png",
"atchison": "https://stats.kansasmediarankings.com/logos/Atchison.png",
"atchison-county": "https://stats.kansasmediarankings.com/logos/Atchison%20County.png",
"attica": "https://stats.kansasmediarankings.com/logos/Attica.png",
"attica-argonia": "https://stats.kansasmediarankings.com/logos/Attica-Argonia.png",
"augusta": "https://stats.kansasmediarankings.com/logos/Augusta.png",
"axtell": "https://stats.kansasmediarankings.com/logos/Axtell.png",
"baldwin": "https://stats.kansasmediarankings.com/logos/Baldwin.png",
"basehor-linwood": "https://stats.kansasmediarankings.com/logos/Basehor-Linwood.png",
"baxter-springs": "https://stats.kansasmediarankings.com/logos/Baxter%20Springs.png",
"belle-plaine": "https://stats.kansasmediarankings.com/logos/Belle%20Plaine.png",
"beloit": "https://stats.kansasmediarankings.com/logos/Beloit.png",
"bennington": "https://stats.kansasmediarankings.com/logos/Bennington.png",
"berean": "https://stats.kansasmediarankings.com/logos/Berean.png",
"bishop-carroll": "https://stats.kansasmediarankings.com/logos/Bishop%20Carroll.png",
"bishop-miege": "https://stats.kansasmediarankings.com/logos/Bishop%20Miege.png",
"bishop-seabury": "https://stats.kansasmediarankings.com/logos/Bishop%20Seabury.png",
"bishop-ward": "https://stats.kansasmediarankings.com/logos/Bishop%20Ward.png",
"blue-valley": "https://stats.kansasmediarankings.com/logos/Blue%20Valley.png",
"blue-valley-north": "https://stats.kansasmediarankings.com/logos/Blue%20Valley%20North.png",
"blue-valley-northwest": "https://stats.kansasmediarankings.com/logos/Blue%20Valley%20Northwest.png",
"blue-valley-southwest": "https://stats.kansasmediarankings.com/logos/Blue%20Valley%20Southwest.png",
"blue-valley-west": "https://stats.kansasmediarankings.com/logos/Blue%20Valley%20West.png",
"bluestem": "https://stats.kansasmediarankings.com/logos/Bluestem.png",
"bonner-springs": "https://stats.kansasmediarankings.com/logos/Bonner%20Springs.png",
"bucklin": "https://stats.kansasmediarankings.com/logos/Bucklin.png",
"buhler": "https://stats.kansasmediarankings.com/logos/Buhler.png",
"burlingame": "https://stats.kansasmediarankings.com/logos/Burlingame.png",
"burlington": "https://stats.kansasmediarankings.com/logos/Burlington.png",
"burrton": "https://stats.kansasmediarankings.com/logos/Burrton.png",
"bv": "https://stats.kansasmediarankings.com/logos/Blue%20Valley.png",
"bv-northwest": "https://stats.kansasmediarankings.com/logos/Blue%20Valley%20Northwest.png",
"bv-randolph": "https://stats.kansasmediarankings.com/logos/BV%20Randolph.png",
"bv-southwest": "https://stats.kansasmediarankings.com/logos/Blue%20Valley%20Southwest.png",
"bv-west": "https://stats.kansasmediarankings.com/logos/Blue%20Valley%20West.png",
"bvnw": "https://stats.kansasmediarankings.com/logos/Blue%20Valley%20Northwest.png",
"bvsw": "https://stats.kansasmediarankings.com/logos/Blue%20Valley%20Southwest.png",
"bvw": "https://stats.kansasmediarankings.com/logos/Blue%20Valley%20West.png",
"cair-paravel": "https://stats.kansasmediarankings.com/logos/Cair%20Paravel.png",
"caldwell": "https://stats.kansasmediarankings.com/logos/Caldwell.png",
"campus": "https://stats.kansasmediarankings.com/logos/Campus.png",
"caney-valley": "https://stats.kansasmediarankings.com/logos/Caney%20Valley.png",
"canton-galva": "https://stats.kansasmediarankings.com/logos/Canton-Galva.png",
"cedar-vale-dexter": "https://stats.kansasmediarankings.com/logos/Cedar%20Vale-Dexter.png",
"central": "https://stats.kansasmediarankings.com/logos/Central.png",
"central-burden": "https://stats.kansasmediarankings.com/logos/Central.png",
"central-christian": "https://stats.kansasmediarankings.com/logos/Central%20Christian.png",
"central-heights": "https://stats.kansasmediarankings.com/logos/Central%20Heights.png",
"central-plains": "https://stats.kansasmediarankings.com/logos/Central%20Plains.png",
"centralia": "https://stats.kansasmediarankings.com/logos/Centralia.png",
"centre": "https://stats.kansasmediarankings.com/logos/Centre.png",
"chanute": "https://stats.kansasmediarankings.com/logos/Chanute.png",
"chaparral": "https://stats.kansasmediarankings.com/logos/Chaparral.png",
"chapman": "https://stats.kansasmediarankings.com/logos/Chapman.png",
"chase": "https://stats.kansasmediarankings.com/logos/Chase.png",
"chase-county": "https://stats.kansasmediarankings.com/logos/Chase%20County.png",
"cheney": "https://stats.kansasmediarankings.com/logos/Cheney.png",
"cherryvale": "https://stats.kansasmediarankings.com/logos/Cherryvale.png",
"chetopa": "https://stats.kansasmediarankings.com/logos/Chetopa.png",
"cheylin": "https://stats.kansasmediarankings.com/logos/Cheylin.png",
"cimarron": "https://stats.kansasmediarankings.com/logos/Cimarron.png",
"circle": "https://stats.kansasmediarankings.com/logos/Circle.png",
"clay-center": "https://stats.kansasmediarankings.com/logos/Clay%20Center.png",
"clearwater": "https://stats.kansasmediarankings.com/logos/Clearwater.png",
"clifton-clyde": "https://stats.kansasmediarankings.com/logos/Clifton-Clyde.png",
"coffeyville": "https://stats.kansasmediarankings.com/logos/Coffeyville.png",
"colby": "https://stats.kansasmediarankings.com/logos/Colby.png",
"collegiate": "https://stats.kansasmediarankings.com/logos/Wichita%20Collegiate.png",
"colony-crest": "https://stats.kansasmediarankings.com/logos/Colony-Crest.png",
"columbus": "https://stats.kansasmediarankings.com/logos/Columbus.png",
"concordia": "https://stats.kansasmediarankings.com/logos/Concordia.png",
"conway-springs": "https://stats.kansasmediarankings.com/logos/Conway%20Springs.png",
"council-grove": "https://stats.kansasmediarankings.com/logos/Council%20Grove.png",
"cunningham": "https://stats.kansasmediarankings.com/logos/Cunningham.png",
"de-soto": "https://stats.kansasmediarankings.com/logos/De%20Soto.png",
"decatur": "https://stats.kansasmediarankings.com/logos/Decatur.png",
"decatur-community": "https://stats.kansasmediarankings.com/logos/Decatur.png",
"deerfield": "https://stats.kansasmediarankings.com/logos/Deerfield.png",
"derby": "https://stats.kansasmediarankings.com/logos/Derby.png",
"dighton": "https://stats.kansasmediarankings.com/logos/Dighton.png",
"dodge-city": "https://stats.kansasmediarankings.com/logos/Dodge%20City.png",
"doniphan-west": "https://stats.kansasmediarankings.com/logos/Doniphan%20West.png",
"douglass": "https://stats.kansasmediarankings.com/logos/Douglass.png",
"eisenhower": "https://stats.kansasmediarankings.com/logos/Eisenhower.png",
"el-dorado": "https://stats.kansasmediarankings.com/logos/El%20Dorado.png",
"elk-valley": "https://stats.kansasmediarankings.com/logos/Elk%20Valley.png",
"elkhart": "https://stats.kansasmediarankings.com/logos/Elkhart.png",
"ell-saline": "https://stats.kansasmediarankings.com/logos/Ell-Saline.png",
"ellinwood": "https://stats.kansasmediarankings.com/logos/Ellinwood.png",
"ellis": "https://stats.kansasmediarankings.com/logos/Ellis.png",
"ellsworth": "https://stats.kansasmediarankings.com/logos/Ellsworth.png",
"elyria-christian": "https://stats.kansasmediarankings.com/logos/Elyria%20Christian.png",
"emporia": "https://stats.kansasmediarankings.com/logos/Emporia.png",
"erie": "https://stats.kansasmediarankings.com/logos/Erie.png",
"eudora": "https://stats.kansasmediarankings.com/logos/Eudora.png",
"eureka": "https://stats.kansasmediarankings.com/logos/Eureka.png",
"fairfield": "https://stats.kansasmediarankings.com/logos/Fairfield.png",
"field-kindley": "https://stats.kansasmediarankings.com/logos/Coffeyville.png",
"flinthills": "https://stats.kansasmediarankings.com/logos/Flinthills.png",
"fort-scott": "https://stats.kansasmediarankings.com/logos/Fort%20Scott.png",
"frankfort": "https://stats.kansasmediarankings.com/logos/Frankfort.png",
"fredonia": "https://stats.kansasmediarankings.com/logos/Fredonia.png",
"free-state": "https://stats.kansasmediarankings.com/logos/Lawrence%20Free%20State.png",
"frontenac": "https://stats.kansasmediarankings.com/logos/Frontenac.png",
"galena": "https://stats.kansasmediarankings.com/logos/Galena.png",
"garden-city": "https://stats.kansasmediarankings.com/logos/Garden%20City.png",
"garden-plain": "https://stats.kansasmediarankings.com/logos/Garden%20Plain.png",
"gardner-edgerton": "https://stats.kansasmediarankings.com/logos/Gardner-Edgerton.png",
"girard": "https://stats.kansasmediarankings.com/logos/Girard.png",
"goddard": "https://stats.kansasmediarankings.com/logos/Goddard.png",
"goddard-eisenhower": "https://stats.kansasmediarankings.com/logos/Eisenhower.png",
"goessel": "https://stats.kansasmediarankings.com/logos/Goessel.png",
"golden-plains": "https://stats.kansasmediarankings.com/logos/Golden%20Plains.png",
"goodland": "https://stats.kansasmediarankings.com/logos/Goodland.png",
"great-bend": "https://stats.kansasmediarankings.com/logos/Great%20Bend.png",
"greeley-county": "https://stats.kansasmediarankings.com/logos/Greeley%20County.png",
"halstead": "https://stats.kansasmediarankings.com/logos/Halstead.png",
"hanover": "https://stats.kansasmediarankings.com/logos/Hanover.png",
"harmon": "https://stats.kansasmediarankings.com/logos/Harmon.png",
"hartford": "https://stats.kansasmediarankings.com/logos/Hartford.png",
"haven": "https://stats.kansasmediarankings.com/logos/Haven.png",
"hayden": "https://stats.kansasmediarankings.com/logos/Hayden.png",
"hays": "https://stats.kansasmediarankings.com/logos/Hays.png",
"haysville-campus": "https://stats.kansasmediarankings.com/logos/Campus.png",
"heights": "https://stats.kansasmediarankings.com/logos/Heights.png",
"herington": "https://stats.kansasmediarankings.com/logos/Herington.png",
"hesston": "https://stats.kansasmediarankings.com/logos/Hesston.png",
"hiawatha": "https://stats.kansasmediarankings.com/logos/Hiawatha.png",
"highland-park": "https://stats.kansasmediarankings.com/logos/Highland%20Park.png",
"hill-city": "https://stats.kansasmediarankings.com/logos/Hill%20City.png",
"hillsboro": "https://stats.kansasmediarankings.com/logos/Hillsboro.png",
"hodgeman-county": "https://stats.kansasmediarankings.com/logos/Hodgeman%20County.png",
"hoisington": "https://stats.kansasmediarankings.com/logos/Hoisington.png",
"holcomb": "https://stats.kansasmediarankings.com/logos/Holcomb.png",
"holton": "https://stats.kansasmediarankings.com/logos/Holton.png",
"horton": "https://stats.kansasmediarankings.com/logos/Horton.png",
"hoxie": "https://stats.kansasmediarankings.com/logos/Hoxie.png",
"hugoton": "https://stats.kansasmediarankings.com/logos/Hugoton.png",
"humboldt": "https://stats.kansasmediarankings.com/logos/Humboldt.png",
"hutch-central-christian": "https://stats.kansasmediarankings.com/logos/Central%20Christian.png",
"hutch-trinity": "https://stats.kansasmediarankings.com/logos/Hutch%20Trinity.png",
"hutchinson": "https://stats.kansasmediarankings.com/logos/Hutchinson.png",
"hutchinson-central-christian": "https://stats.kansasmediarankings.com/logos/Central%20Christian.png",
"hutchinson-trinity": "https://stats.kansasmediarankings.com/logos/Hutch%20Trinity.png",
"independence": "https://stats.kansasmediarankings.com/logos/Independence.png",
"ingalls": "https://stats.kansasmediarankings.com/logos/Ingalls.png",
"inman": "https://stats.kansasmediarankings.com/logos/Inman.png",
"iola": "https://stats.kansasmediarankings.com/logos/Iola.png",
"jackson-heights": "https://stats.kansasmediarankings.com/logos/Jackson%20Heights.png",
"jayhawk-linn": "https://stats.kansasmediarankings.com/logos/Jayhawk-Linn.png",
"jc-harmon": "https://stats.kansasmediarankings.com/logos/Harmon.png",
"jefferson-county-north": "https://stats.kansasmediarankings.com/logos/Jefferson%20County%20North.png",
"jefferson-west": "https://stats.kansasmediarankings.com/logos/Jefferson%20West.png",
"jennings": "https://stats.kansasmediarankings.com/logos/Jennings.png",
"junction-city": "https://stats.kansasmediarankings.com/logos/Junction%20City.png",
"kansas-city-christian": "https://stats.kansasmediarankings.com/logos/Kansas%20City%20Christian.png",
"kansas-school-for-the-deaf": "https://stats.kansasmediarankings.com/logos/Kansas%20School%20for%20the%20Deaf.png",
"kapaun-mt-carmel": "https://stats.kansasmediarankings.com/logos/Kapaun%20Mt%20Carmel.png",
"kc-harmon": "https://stats.kansasmediarankings.com/logos/JC%20Harmon.png",
"kc-piper": "https://stats.kansasmediarankings.com/logos/Piper.png",
"kc-sumner": "https://stats.kansasmediarankings.com/logos/KC%20Sumner.png",
"kingman": "https://stats.kansasmediarankings.com/logos/Kingman.png",
"kinsley": "https://stats.kansasmediarankings.com/logos/Kinsley.png",
"kiowa-county": "https://stats.kansasmediarankings.com/logos/Kiowa%20County.png",
"la-crosse": "https://stats.kansasmediarankings.com/logos/La%20Crosse.png",
"labette-county": "https://stats.kansasmediarankings.com/logos/Labette%20County.png",
"lakeside": "https://stats.kansasmediarankings.com/logos/Lakeside.png",
"lakin": "https://stats.kansasmediarankings.com/logos/Lakin.png",
"lansing": "https://stats.kansasmediarankings.com/logos/Lansing.png",
"larned": "https://stats.kansasmediarankings.com/logos/Larned.png",
"lawrence": "https://stats.kansasmediarankings.com/logos/Lawrence.png",
"lawrence-free-state": "https://stats.kansasmediarankings.com/logos/Lawrence%20Free%20State.png",
"leavenworth": "https://stats.kansasmediarankings.com/logos/Leavenworth.png",
"lebo": "https://stats.kansasmediarankings.com/logos/Lebo.png",
"leon-bluestem": "https://stats.kansasmediarankings.com/logos/Bluestem.png",
"leoti": "https://stats.kansasmediarankings.com/logos/Wichita%20County.png",
"leoti-wichita-co": "https://stats.kansasmediarankings.com/logos/Wichita%20County.png",
"liberal": "https://stats.kansasmediarankings.com/logos/Liberal.png",
"life-prep": "https://stats.kansasmediarankings.com/logos/Life%20Prep.png",
"lincoln": "https://stats.kansasmediarankings.com/logos/Lincoln.png",
"linn": "https://stats.kansasmediarankings.com/logos/Linn.png",
"little-river": "https://stats.kansasmediarankings.com/logos/Little%20River.png",
"logan": "https://stats.kansasmediarankings.com/logos/Logan.png",
"louisburg": "https://stats.kansasmediarankings.com/logos/Louisburg.png",
"lyndon": "https://stats.kansasmediarankings.com/logos/Lyndon.png",
"lyons": "https://stats.kansasmediarankings.com/logos/Lyons.png",
"macksville": "https://stats.kansasmediarankings.com/logos/Macksville.png",
"madison": "https://stats.kansasmediarankings.com/logos/Madison.png",
"maize": "https://stats.kansasmediarankings.com/logos/Maize.png",
"maize-s": "https://stats.kansasmediarankings.com/logos/Maize%20South.png",
"maize-south": "https://stats.kansasmediarankings.com/logos/Maize%20South.png",
"manhattan": "https://stats.kansasmediarankings.com/logos/Manhattan.png",
"marais-des-cygnes-valley": "https://stats.kansasmediarankings.com/logos/Marais%20des%20Cygnes%20Valley.png",
"maranatha": "https://stats.kansasmediarankings.com/logos/Maranatha.png",
"marion": "https://stats.kansasmediarankings.com/logos/Marion.png",
"marmaton-valley": "https://stats.kansasmediarankings.com/logos/Marmaton%20Valley.png",
"marysville": "https://stats.kansasmediarankings.com/logos/Marysville.png",
"maur-hill-mount": "https://stats.kansasmediarankings.com/logos/Maur%20Hill-Mount.png",
"mclouth": "https://stats.kansasmediarankings.com/logos/McLouth.png",
"mcpherson": "https://stats.kansasmediarankings.com/logos/McPherson.png",
"meade": "https://stats.kansasmediarankings.com/logos/Meade.png",
"medicine-lodge": "https://stats.kansasmediarankings.com/logos/Medicine%20Lodge.png",
"mill-valley": "https://stats.kansasmediarankings.com/logos/Mill%20Valley.png",
"minneapolis": "https://stats.kansasmediarankings.com/logos/Minneapolis.png",
"minneola": "https://stats.kansasmediarankings.com/logos/Minneola.png",
"mission-valley": "https://stats.kansasmediarankings.com/logos/Mission%20Valley.png",
"moscow": "https://stats.kansasmediarankings.com/logos/Moscow.png",
"moundridge": "https://stats.kansasmediarankings.com/logos/Moundridge.png",
"mulvane": "https://stats.kansasmediarankings.com/logos/Mulvane.png",
"natoma": "https://stats.kansasmediarankings.com/logos/Natoma.png",
"nemaha-central": "https://stats.kansasmediarankings.com/logos/Nemaha%20Central.png",
"neodesha": "https://stats.kansasmediarankings.com/logos/Neodesha.png",
"ness-city": "https://stats.kansasmediarankings.com/logos/Ness%20City.png",
"newton": "https://stats.kansasmediarankings.com/logos/Newton.png",
"nickerson": "https://stats.kansasmediarankings.com/logos/Nickerson.png",
"north": "https://stats.kansasmediarankings.com/logos/North.png",
"northeast": "https://stats.kansasmediarankings.com/logos/Northeast.png",
"northern-heights": "https://stats.kansasmediarankings.com/logos/Northern%20Heights.png",
"northern-valley": "https://stats.kansasmediarankings.com/logos/Northern%20Valley.png",
"norton": "https://stats.kansasmediarankings.com/logos/Norton.png",
"norwich": "https://stats.kansasmediarankings.com/logos/Norwich.png",
"oakley": "https://stats.kansasmediarankings.com/logos/Oakley.png",
"oberlin-decatur": "https://stats.kansasmediarankings.com/logos/Decatur.png",
"oberlin-decatur-co": "https://stats.kansasmediarankings.com/logos/Oberlin-Decatur.png",
"olathe-east": "https://stats.kansasmediarankings.com/logos/Olathe%20East.png",
"olathe-heritage-christian": "https://stats.kansasmediarankings.com/logos/Olathe%20Heritage%20Christian.png",
"olathe-north": "https://stats.kansasmediarankings.com/logos/Olathe%20North.png",
"olathe-northwest": "https://stats.kansasmediarankings.com/logos/Olathe%20Northwest.png",
"olathe-south": "https://stats.kansasmediarankings.com/logos/Olathe%20South.png",
"olathe-west": "https://stats.kansasmediarankings.com/logos/Olathe%20West.png",
"olpe": "https://stats.kansasmediarankings.com/logos/Olpe.png",
"onaga": "https://stats.kansasmediarankings.com/logos/Onaga.png",
"osage-city": "https://stats.kansasmediarankings.com/logos/Osage%20City.png",
"osawatomie": "https://stats.kansasmediarankings.com/logos/Osawatomie.png",
"osborne": "https://stats.kansasmediarankings.com/logos/Osborne.png",
"oskaloosa": "https://stats.kansasmediarankings.com/logos/Oskaloosa.png",
"oswego": "https://stats.kansasmediarankings.com/logos/Oswego.png",
"otis-bison": "https://stats.kansasmediarankings.com/logos/Otis-Bison.png",
"ottawa": "https://stats.kansasmediarankings.com/logos/Ottawa.png",
"oxford": "https://stats.kansasmediarankings.com/logos/Oxford.png",
"paola": "https://stats.kansasmediarankings.com/logos/Paola.png",
"parsons": "https://stats.kansasmediarankings.com/logos/Parsons.png",
"pawnee-heights": "https://stats.kansasmediarankings.com/logos/Pawnee%20Heights.png",
"peabody-burns": "https://stats.kansasmediarankings.com/logos/Peabody-Burns.png",
"perry-lecompton": "https://stats.kansasmediarankings.com/logos/Perry-Lecompton.png",
"phillipsburg": "https://stats.kansasmediarankings.com/logos/Phillipsburg.png",
"pike-valley": "https://stats.kansasmediarankings.com/logos/Pike%20Valley.png",
"piper": "https://stats.kansasmediarankings.com/logos/Piper.png",
"pittsburg": "https://stats.kansasmediarankings.com/logos/Pittsburg.png",
"plainville": "https://stats.kansasmediarankings.com/logos/Plainville.png",
"pleasant-ridge": "https://stats.kansasmediarankings.com/logos/Pleasant%20Ridge.png",
"pleasanton": "https://stats.kansasmediarankings.com/logos/Pleasanton.png",
"prairie-view": "https://stats.kansasmediarankings.com/logos/Prairie%20View.png",
"pratt": "https://stats.kansasmediarankings.com/logos/Pratt.png",
"pretty-prairie": "https://stats.kansasmediarankings.com/logos/Pretty%20Prairie.png",
"quinter": "https://stats.kansasmediarankings.com/logos/Quinter.png",
"rawlins-county": "https://stats.kansasmediarankings.com/logos/Rawlins%20County.png",
"remington": "https://stats.kansasmediarankings.com/logos/Remington.png",
"republic-county": "https://stats.kansasmediarankings.com/logos/Republic%20County.png",
"riley-county": "https://stats.kansasmediarankings.com/logos/Riley%20County.png",
"riverside": "https://stats.kansasmediarankings.com/logos/Riverside.png",
"riverton": "https://stats.kansasmediarankings.com/logos/Riverton.png",
"rock-creek": "https://stats.kansasmediarankings.com/logos/Rock%20Creek.png",
"rock-hills": "https://stats.kansasmediarankings.com/logos/Rock%20Hills.png",
"rolla": "https://stats.kansasmediarankings.com/logos/Rolla.png",
"rose-hill": "https://stats.kansasmediarankings.com/logos/Rose%20Hill.png",
"rossville": "https://stats.kansasmediarankings.com/logos/Rossville.png",
"royal-valley": "https://stats.kansasmediarankings.com/logos/Royal%20Valley.png",
"rural-vista": "https://stats.kansasmediarankings.com/logos/Rural%20Vista.png",
"russell": "https://stats.kansasmediarankings.com/logos/Russell.png",
"sabetha": "https://stats.kansasmediarankings.com/logos/Sabetha.png",
"sacred-heart": "https://stats.kansasmediarankings.com/logos/Sacred%20Heart.png",
"saint-mary-s-academy": "https://stats.kansasmediarankings.com/logos/Saint%20Mary%27s%20Academy.png",
"salina-central": "https://stats.kansasmediarankings.com/logos/Salina%20Central.png",
"salina-south": "https://stats.kansasmediarankings.com/logos/Salina%20South.png",
"santa-fe-trail": "https://stats.kansasmediarankings.com/logos/Santa%20Fe%20Trail.png",
"satanta": "https://stats.kansasmediarankings.com/logos/Satanta.png",
"schlagle": "https://stats.kansasmediarankings.com/logos/Schlagle.png",
"scott-city": "https://stats.kansasmediarankings.com/logos/Scott%20City.png",
"seaman": "https://stats.kansasmediarankings.com/logos/Seaman.png",
"sedan": "https://stats.kansasmediarankings.com/logos/Sedan.png",
"sedgwick": "https://stats.kansasmediarankings.com/logos/Sedgwick.png",
"shawnee-heights": "https://stats.kansasmediarankings.com/logos/Shawnee%20Heights.png",
"shawnee-mission-east": "https://stats.kansasmediarankings.com/logos/Shawnee%20Mission%20East.png",
"shawnee-mission-north": "https://stats.kansasmediarankings.com/logos/Shawnee%20Mission%20North.png",
"shawnee-mission-northwest": "https://stats.kansasmediarankings.com/logos/Shawnee%20Mission%20Northwest.png",
"shawnee-mission-south": "https://stats.kansasmediarankings.com/logos/Shawnee%20Mission%20South.png",
"shawnee-mission-west": "https://stats.kansasmediarankings.com/logos/Shawnee%20Mission%20West.png",
"silver-lake": "https://stats.kansasmediarankings.com/logos/Silver%20Lake.png",
"skyline": "https://stats.kansasmediarankings.com/logos/Skyline.png",
"sm-north": "https://stats.kansasmediarankings.com/logos/Shawnee%20Mission%20North.png",
"sm-west": "https://stats.kansasmediarankings.com/logos/Shawnee%20Mission%20West.png",
"smith-center": "https://stats.kansasmediarankings.com/logos/Smith%20Center.png",
"smn": "https://stats.kansasmediarankings.com/logos/Shawnee%20Mission%20North.png",
"smoky-valley": "https://stats.kansasmediarankings.com/logos/Smoky%20Valley.png",
"smw": "https://stats.kansasmediarankings.com/logos/Shawnee%20Mission%20West.png",
"solomon": "https://stats.kansasmediarankings.com/logos/Solomon.png",
"south-barber": "https://stats.kansasmediarankings.com/logos/South%20Barber.png",
"south-central": "https://stats.kansasmediarankings.com/logos/South%20Central.png",
"south-gray": "https://stats.kansasmediarankings.com/logos/South%20Gray.png",
"south-haven": "https://stats.kansasmediarankings.com/logos/South%20Haven.png",
"south-sumner": "https://stats.kansasmediarankings.com/logos/South%20Sumner.png",
"south-sumner-co": "https://stats.kansasmediarankings.com/logos/South%20Sumner%20County.png",
"south-sumner-county": "https://stats.kansasmediarankings.com/logos/South%20Sumner.png",
"southeast-cherokee": "https://stats.kansasmediarankings.com/logos/Southeast%20%28Cherokee%29.png",
"southeast-of-saline": "https://stats.kansasmediarankings.com/logos/Southeast%20of%20Saline.png",
"southeast-saline": "https://stats.kansasmediarankings.com/logos/Southeast%20of%20Saline.png",
"southeast-wichita": "https://stats.kansasmediarankings.com/logos/Southeast%20%28Wichita%29.png",
"southern-cloud": "https://stats.kansasmediarankings.com/logos/Southern%20Cloud.png",
"southern-coffey-county": "https://stats.kansasmediarankings.com/logos/Southern%20Coffey%20County.png",
"southwestern-heights": "https://stats.kansasmediarankings.com/logos/Southwestern%20Heights.png",
"spearville": "https://stats.kansasmediarankings.com/logos/Spearville.png",
"spring-hill": "https://stats.kansasmediarankings.com/logos/Spring%20Hill.png",
"st-francis": "https://stats.kansasmediarankings.com/logos/St%20Francis.png",
"st-james": "https://stats.kansasmediarankings.com/logos/St%20James.png",
"st-james-academy": "https://stats.kansasmediarankings.com/logos/St%20James.png",
"st-john": "https://stats.kansasmediarankings.com/logos/St%20John.png",
"st-john-s": "https://stats.kansasmediarankings.com/logos/St%20John%27s.png",
"st-mary-s": "https://stats.kansasmediarankings.com/logos/St%20Marys.png",
"st-mary-s-colgan": "https://stats.kansasmediarankings.com/logos/St%20Mary%27s%20Colgan.png",
"st-marys": "https://stats.kansasmediarankings.com/logos/St%20Marys.png",
"st-marys-colgan": "https://stats.kansasmediarankings.com/logos/St%20Mary%27s%20Colgan.png",
"st-paul": "https://stats.kansasmediarankings.com/logos/St%20Paul.png",
"st-thomas-aquinas": "https://stats.kansasmediarankings.com/logos/St%20Thomas%20Aquinas.png",
"st-xavier": "https://stats.kansasmediarankings.com/logos/St%20Xavier.png",
"sta": "https://stats.kansasmediarankings.com/logos/St%20Thomas%20Aquinas.png",
"stafford": "https://stats.kansasmediarankings.com/logos/Stafford.png",
"stanton-county": "https://stats.kansasmediarankings.com/logos/Stanton%20County.png",
"sterling": "https://stats.kansasmediarankings.com/logos/Sterling.png",
"stjames": "https://stats.kansasmediarankings.com/logos/St%20James%20Academy.png",
"stockton": "https://stats.kansasmediarankings.com/logos/Stockton.png",
"sublette": "https://stats.kansasmediarankings.com/logos/Sublette.png",
"sunrise-christian": "https://stats.kansasmediarankings.com/logos/Sunrise%20Christian.png",
"sylvan-lucas-unified": "https://stats.kansasmediarankings.com/logos/Sylvan-Lucas%20Unified.png",
"syracuse": "https://stats.kansasmediarankings.com/logos/Syracuse.png",
"tescott": "https://stats.kansasmediarankings.com/logos/Tescott.png",
"thomas-more-prep": "https://stats.kansasmediarankings.com/logos/Thomas%20More%20Prep.png",
"thomas-more-prep-marian": "https://stats.kansasmediarankings.com/logos/Thomas%20More%20Prep.png",
"thunder-ridge": "https://stats.kansasmediarankings.com/logos/Thunder%20Ridge.png",
"tmp-marian": "https://stats.kansasmediarankings.com/logos/Thomas%20More%20Prep.png",
"tonganoxie": "https://stats.kansasmediarankings.com/logos/Tonganoxie.png",
"topeka": "https://stats.kansasmediarankings.com/logos/Topeka.png",
"topeka-hayden": "https://stats.kansasmediarankings.com/logos/Hayden.png",
"topeka-west": "https://stats.kansasmediarankings.com/logos/Topeka%20West.png",
"towanda-circle": "https://stats.kansasmediarankings.com/logos/Circle.png",
"triplains-brewster": "https://stats.kansasmediarankings.com/logos/Triplains-Brewster.png",
"troy": "https://stats.kansasmediarankings.com/logos/Troy.png",
"turner": "https://stats.kansasmediarankings.com/logos/Turner.png",
"udall": "https://stats.kansasmediarankings.com/logos/Udall.png",
"ulysses": "https://stats.kansasmediarankings.com/logos/Ulysses.png",
"uniontown": "https://stats.kansasmediarankings.com/logos/Uniontown.png",
"valley-center": "https://stats.kansasmediarankings.com/logos/Valley%20Center.png",
"valley-falls": "https://stats.kansasmediarankings.com/logos/Valley%20Falls.png",
"valley-heights": "https://stats.kansasmediarankings.com/logos/Valley%20Heights.png",
"veritas-christian": "https://stats.kansasmediarankings.com/logos/Veritas%20Christian.png",
"victoria": "https://stats.kansasmediarankings.com/logos/Victoria.png",
"wabaunsee": "https://stats.kansasmediarankings.com/logos/Wabaunsee.png",
"wakeeney-trego": "https://stats.kansasmediarankings.com/logos/WaKeeney-Trego.png",
"wakefield": "https://stats.kansasmediarankings.com/logos/Wakefield.png",
"wallace-county": "https://stats.kansasmediarankings.com/logos/Wallace%20County.png",
"wamego": "https://stats.kansasmediarankings.com/logos/Wamego.png",
"washburn-rural": "https://stats.kansasmediarankings.com/logos/Washburn%20Rural.png",
"washington": "https://stats.kansasmediarankings.com/logos/Washington.png",
"washington-county": "https://stats.kansasmediarankings.com/logos/Washington%20County.png",
"waverly": "https://stats.kansasmediarankings.com/logos/Waverly.png",
"wellington": "https://stats.kansasmediarankings.com/logos/Wellington.png",
"wellsville": "https://stats.kansasmediarankings.com/logos/Wellsville.png",
"weskan": "https://stats.kansasmediarankings.com/logos/Weskan.png",
"west-elk": "https://stats.kansasmediarankings.com/logos/West%20Elk.png",
"west-elk-elk-valley": "https://stats.kansasmediarankings.com/logos/West%20Elk.png",
"west-franklin": "https://stats.kansasmediarankings.com/logos/West%20Franklin.png",
"western-plains": "https://stats.kansasmediarankings.com/logos/Western%20Plains.png",
"wheatland-grinnell": "https://stats.kansasmediarankings.com/logos/Wheatland-Grinnell.png",
"whitewater-remington": "https://stats.kansasmediarankings.com/logos/Remington.png",
"wichita": "https://stats.kansasmediarankings.com/logos/Wichita.png",
"wichita-classical": "https://stats.kansasmediarankings.com/logos/Wichita%20Classical.png",
"wichita-collegiate": "https://stats.kansasmediarankings.com/logos/Wichita%20Collegiate.png",
"wichita-county": "https://stats.kansasmediarankings.com/logos/Wichita%20County.png",
"wichita-east": "https://stats.kansasmediarankings.com/logos/Wichita%20East.png",
"wichita-heights": "https://stats.kansasmediarankings.com/logos/Heights.png",
"wichita-independent": "https://stats.kansasmediarankings.com/logos/Wichita%20Independent.png",
"wichita-north": "https://stats.kansasmediarankings.com/logos/North.png",
"wichita-northwest": "https://stats.kansasmediarankings.com/logos/Wichita%20Northwest.png",
"wichita-se": "https://stats.kansasmediarankings.com/logos/Wichita%20Southeast.png",
"wichita-south": "https://stats.kansasmediarankings.com/logos/Wichita%20South.png",
"wichita-southeast": "https://stats.kansasmediarankings.com/logos/Southeast%20%28Wichita%29.png",
"wichita-trinity": "https://stats.kansasmediarankings.com/logos/Wichita%20Trinity.png",
"wichita-west": "https://stats.kansasmediarankings.com/logos/Wichita%20West.png",
"winfield": "https://stats.kansasmediarankings.com/logos/Winfield.png",
"wyandotte": "https://stats.kansasmediarankings.com/logos/Wyandotte.png",
"yates-center": "https://stats.kansasmediarankings.com/logos/Yates%20Center.png"
};

