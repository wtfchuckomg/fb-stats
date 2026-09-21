/* ================================================================
   Teams: an index of every school (?teams) and a page for each one
   (?team=<name>) with its record, schedule and results. The admin
   sets each team's record here once; from then on every final on the
   site adds to it, and the scoreboards show it on the team's games
   still to come.
   ================================================================ */
const TEAM_PAGE = (PAGE_Q.has('team') || PAGE_Q.has('teams')) && !PAGE_Q.has('stats');
const tpage = {edit:false, draft:null, sug:null, name:'', season:'', hist:{}};

/* ---------- every shared game, for the schools' schedules and their records ---------- */
// The home page and BUCO Stats don't need it; the scoreboards, game pages, tracker and team pages do.
//
// History comes from season.json, a file the site serves itself: every shared game boiled down to who played,
// the score and whether it's final. It costs no database reads at all, which matters because this used to ask
// for every game on every page — 370-odd reads a visit, growing with the season. This week's games arrive live
// on top of it (watchWeek), so a score still moves the moment it changes.
const allGames = {list:null, idx:null, err:'', unsub:null, built:0};
function watchAllGames(api){
  if (allGames.unsub || ui.home || ui.county) return;
  allGames.unsub = () => {};
  loadSeason(api);
}
// A snapshot game, shaped like the real thing so everything downstream reads it the same way.
function seasonGame(e){
  return {id:e.id, teams:{A:e.a, H:e.h}, date:e.date || '', kind:e.kind || '', wk:e.wk,
    opp:e.opp, sched:e.sched, per:e.per, clk:e.clk, time:e.time, updated:e.updated || 0,
    box:!!e.box, stats:!!e.stats, players:e.pl || null,
    snap:{fin:!!e.fin, live:!!e.live, status:e.status || '', q:e.q || 0, score:{A:+e.A || 0, H:+e.H || 0}}};
}
async function loadSeason(api){
  try {
    const r = await fetch('/season.json', {cache:'no-cache'});
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (!d || !Array.isArray(d.games) || !d.games.length) throw new Error('empty');
    allGames.list = d.games.map(seasonGame); allGames.built = d.built || 0; allGames.err = '';
    indexGames(); recordsChanged();
    watchSince(api, allGames.built);   // and whatever has changed since the file was written
  } catch (e) {
    // No file, or it can't be read: ask the database for the games, the way this used to work.
    allGames.unsub = null;
    watchAllGamesLive(api);
  }
}
// Anything saved since the snapshot was built — a box score pasted for an old week, a score corrected — read
// live and laid over it. It asks only for documents newer than the file, which on a normal day is a handful.
function watchSince(api, built){
  if (!api || !built) return;
  const {fsM, fsdb} = api;
  try {
    const q = fsM.query(fsM.collection(fsdb, 'pressbox'), fsM.where('public', '==', true), fsM.where('updated', '>', built));
    allGames.since = fsM.onSnapshot(q, snap => {
      let changed = false;
      snap.forEach(d => {
        const v = d.data();
        if (!v || v.public !== true) return;
        const at = allGames.list.findIndex(x => x.id === d.id);
        if (v.deleted || !v.json){ if (at >= 0){ allGames.list.splice(at, 1); changed = true; } return; }
        let x; try { x = JSON.parse(v.json); } catch (e) { return; }
        if (!x.teams || !x.teams.A || !x.teams.H) return;
        x = Object.assign(x, {id:d.id});
        if (at >= 0) allGames.list[at] = x; else allGames.list.push(x);
        changed = true;
      });
      if (changed){ indexGames(); recordsChanged(); }
    }, e => {
      // The query needs a composite index (public + updated). Until it exists, read every game the way this used
      // to: dearer, but a box score pasted for an old week still shows the moment it's saved.
      console.warn('Kansas Media Stats: catch-up query refused, reading every game instead.', e && e.code);
      allGames.since = null; allGames.unsub = null; watchAllGamesLive(api);
    });
  } catch (e) { allGames.unsub = null; watchAllGamesLive(api); }
}

function watchAllGamesLive(api){
  if (allGames.unsub || !api) return;
  const {fsM, fsdb} = api;
  allGames.unsub = fsM.onSnapshot(fsM.query(fsM.collection(fsdb, 'pressbox'), fsM.where('public', '==', true)), snap => {
    const out = [];
    snap.forEach(d => {
      const v = d.data(); if (v.deleted || !v.json) return;
      try { const x = JSON.parse(v.json); if (x.teams && x.teams.A && x.teams.H) out.push(Object.assign(x, {id:d.id})); } catch (e) {}
    });
    allGames.list = out; allGames.err = ''; indexGames(); recordsChanged();
  }, () => { allGames.err = 'Can’t load the games right now. Reload to try again.'; allGames.list = allGames.list || []; renderTeamPage(); });
}
// Each school's games, one per week and opponent: the one with stats if there is one, else the newest copy.
function indexGames(){
  const idx = new Map();
  // The week showing is watched live, so its games are the current word on themselves: they replace the
  // snapshot's copy, which may have been written before tonight's result.
  const live = Object.entries(scores.docs || {}).map(([id, x]) => Object.assign({}, x, {id}));
  const byId = new Map();
  (allGames.list || []).forEach(x => byId.set(x.id, x));
  live.forEach(x => { if (x && x.teams && x.teams.A && x.teams.H) byId.set(x.id, x); });
  const have = [...byId.values()];
  [...have, ...schedMissing(have)].map(kpFill).forEach(x => {
    // Only a game the admin hid is left out; the other schools' games count even though they're off the scoreboards.
    if (hideList.ids.has(x.id)) return;
    const stats = x.stats != null ? !!x.stats : (x.kind !== 'score' && ((x.plays && x.plays.length) || !!x.box)), wk = x.wk || gameWeek(x);
    ['A', 'H'].forEach(side => {
      const opp = side === 'A' ? 'H' : 'A', k = canonSchool(x.teams[side].name), key = wk + '|' + canonSchool(x.teams[opp].name);
      let m = idx.get(k); if (!m) idx.set(k, m = {});
      const was = m[key];
      if (!was || (stats && !was.stats) || (stats === was.stats && (x.updated || 0) > (was.x.updated || 0))) m[key] = {x, side, opp, wk, stats, key};
    });
  });
  allGames.idx = idx; recCache.clear();
  pushLocalScores();   // anything added on this device that never went up
}
const schoolRows = name => Object.values((allGames.idx && allGames.idx.get(canonSchool(name))) || {}).sort((a, b) => gameDay(a.x) - gameDay(b.x));
// Whether a game is final and its score, worked out once per version of the game (a replay isn't free).
const finMemo = new Map();
function finalOf(x){
  // A snapshot game carries its result, so nothing is replayed to find it again.
  if (x.snap) return {fin:x.snap.fin, live:x.snap.live, score:x.snap.score, status:x.snap.status, q:x.snap.q};
  const k = `${x.id}:${x.updated || 0}`;
  let v = finMemo.get(k);
  if (!v){ const m = summary(x); v = {fin:m.fin, live:m.live, score:m.score, status:m.status, q:m.q}; finMemo.set(k, v); }
  return v;
}

/* ---------- team records, kept by the admin ---------- */
// One shared list, like the hidden games: only the admin's account can change it, and anyone can read it.
const RECS_DOC = 'team-records';
const teamRecs = {map:{}, api:null, unsub:null};
function watchTeamRecs(api){
  teamRecs.api = api;
  if (teamRecs.unsub) return;
  const {fsM, fsdb} = api;
  // Until the first record is saved there is no list, and reading it is refused: then there are no records.
  teamRecs.unsub = fsM.onSnapshot(fsM.doc(fsdb, 'pressbox', RECS_DOC), snap => {
    const d = snap.exists() ? snap.data() : null;
    let map = {}; if (d && d.owner === ADMIN_UID && !d.deleted){ try { map = JSON.parse(d.json).teams || {}; } catch (e) {} }
    teamRecs.map = map; recCache.clear(); recordsChanged();
  }, () => { teamRecs.unsub = null; });
}
function recordsChanged(){ renderScores(); renderScoreboard(); renderTeamPage(); renderStandings(); if (g && R && !ui.board) renderBoard(); }

// "3-1" or "3-1-1" as numbers, or null when it's something else (left as typed).
const parseRec = s => { const m = String(s || '').trim().match(/^(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?$/); return m ? [+m[1], +m[2], +(m[3] || 0)] : null; };
const fmtRec = ([w, l, t]) => `${w}-${l}${t ? '-' + t : ''}`;
// The record as shown: what the admin saved, plus every final on the site since. Saving notes the finals already on
// the site (those are in what was typed); after that a final counts if it's dated on or after the day it was saved.
const recCache = new Map();
function shownRecord(name, thru){
  const k0 = name && canonSchool(name); if (!k0) return null;
  const k = thru ? `${k0}|${thru}` : k0;
  if (recCache.has(k)) return recCache.get(k);
  // A game already played shows the record as it stood that week, so a Week 1 final doesn't read Week 3's record.
  const upTo = r => !thru || r.wk <= thru;
  const base = teamRecs.map[k0]; let out = null;
  if (base){
    out = {rec:base.rec || '', home:base.home || '', away:base.away || ''};
    if (allGames.idx){
      const seen = new Set(base.seen || []), from = new Date(base.asOf || base.updated || 0); from.setHours(0, 0, 0, 0);
      const P = {rec:parseRec(base.rec), home:parseRec(base.home), away:parseRec(base.away)};
      schoolRows(name).forEach(r => {
        if (seen.has(r.key) || gameDay(r.x) < from || !upTo(r)) return;
        const f = finalOf(r.x); if (!f.fin) return;
        const a = f.score[r.side], b = f.score[r.opp], i = a > b ? 0 : a < b ? 1 : 2;
        [P.rec, r.side === 'H' ? P.home : P.away].forEach(p => { if (p) p[i]++; });
      });
      ['rec', 'home', 'away'].forEach(kk => { if (P[kk]) out[kk] = fmtRec(P[kk]); });
    }
  } else if (allGames.idx){
    // No record set: tally every final on the site, overall and home or away. A pasted box score is a final
    // like any other, so it counts. For a school whose whole schedule isn't here this is the record as far as
    // the site knows, and its page says so.
    const T = {rec:[0, 0, 0], home:[0, 0, 0], away:[0, 0, 0]}; let n = 0;
    schoolRows(name).forEach(r => {
      const f = finalOf(r.x); if (!f.fin || !upTo(r)) return;
      const a = f.score[r.side], b = f.score[r.opp], i = a > b ? 0 : a < b ? 1 : 2;
      T.rec[i]++; (r.side === 'H' ? T.home : T.away)[i]++; n++;
    });
    if (n) out = {rec:fmtRec(T.rec), home:fmtRec(T.home), away:fmtRec(T.away)};
  }
  recCache.set(k, out);
  return out;
}
async function saveTeamRecord(name, rec){
  if (!ui.admin || !teamRecs.api) return toast('Sign in on the Game Tracker to edit records');
  const map = Object.assign({}, teamRecs.map), k = canonSchool(name);
  if (rec.rec || rec.home || rec.away){
    const seen = schoolRows(name).filter(r => finalOf(r.x).fin).map(r => r.key);
    map[k] = Object.assign({name}, rec, {asOf:Date.now(), seen, updated:Date.now()});
  } else delete map[k];
  teamRecs.map = map; recCache.clear(); recordsChanged();
  const {fsM, fsdb} = teamRecs.api;
  try {
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', RECS_DOC), {owner:ADMIN_UID, updated:Date.now(), public:true, kind:'records',
      title:'Team records', json:JSON.stringify({teams:map})});
    toast('Record saved');
    if (!teamRecs.unsub) watchTeamRecs(teamRecs.api);   // the first save makes the list: follow it from now on
  } catch (e) { toast('Couldn’t save that. Sign in on the Game Tracker, then try again.'); }
}
// Wipe the typed records: from then on every school's record is the finals the site has, which is what a
// pasted box score feeds. Nothing else is touched — the games, their scores and their stats stay as they are.
async function clearTeamRecords(){
  if (!ui.admin || !teamRecs.api) return toast('Sign in on the Game Tracker first');
  const n = Object.keys(teamRecs.map || {}).length;
  if (!n) return toast('No typed records to clear');
  if (ui.confirm !== 'recs'){ ui.confirm = 'recs'; if (ui.dlg === 'schools') dlg().innerHTML = dlgSchools(); return toast(`Clear ${n} typed record${n === 1 ? '' : 's'}? Tap again`); }
  ui.confirm = null;
  const {fsM, fsdb} = teamRecs.api;
  try {
    // Save first, then forget them here: a refused write must not leave the screen saying they are gone.
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', RECS_DOC), {owner:ADMIN_UID, updated:Date.now(), public:true, kind:'records',
      title:'Team records', json:JSON.stringify({teams:{}})});
    teamRecs.map = {}; recCache.clear(); recordsChanged();
    toast(`Cleared ${n} typed record${n === 1 ? '' : 's'}`);
  } catch (e) { toast('Couldn’t clear those. Sign in on the Game Tracker, then try again.'); }
  if (ui.dlg === 'schools') dlg().innerHTML = dlgSchools();
}
const recParts = r => r ? [r.rec, r.home && `${r.home} Home`, r.away && `${r.away} Away`].filter(Boolean) : [];

/* ---------- the pages ---------- */
async function startTeamPage(){
  ui.viewer = true; ui.teamPage = true; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  loadLogos();   // the school list: without it "Haysville Campus" and "Campus" are two different schools
  loadRatings();  // so a school's own KPreps spelling can be found for its past seasons
  renderTeamPage();
  // The admin's own devices sign in here too, for Edit record.
  let admin = false; try { admin = localStorage.getItem('pressbox.admin') === '1'; } catch (e) {}
  try {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-`;
    const [appM, fsM, authM] = await Promise.all(['app', 'firestore', ...(admin ? ['auth'] : [])].map(m => import(base + m + '.js')));
    const app = appM.initializeApp(firebaseConfig);
    if (authM) authM.onAuthStateChanged(authM.getAuth(app), u => { ui.admin = !!u && u.uid === ADMIN_UID; renderTeamPage(); });
    const fsdb = fsM.getFirestore(app);
    scoresReady({fsM, fsdb});   // the scores strip, the records and every shared game
    watchRosters({fsM, fsdb});  // and the rosters scorers have shared, for the roster card
  } catch (e) { allGames.err = 'Can’t reach the games. Check your connection and reload.'; allGames.list = []; renderTeamPage(); }
}

// Past seasons for a school, when this site has them on file.
function teamHistory(name){
  const k = logoSlug(name); if (!k) return null;
  if (tpage.hist[k] === undefined){
    tpage.hist[k] = null;
    fetchHistory(name, d => { tpage.hist[k] = d || false; renderTeamPage(); });
  }
  return tpage.hist[k] || null;
}

function renderTeamPage(){
  if (ui.preview) renderPreview();
  if (!ui.teamPage) return;
  const name = PAGE_Q.get('team');
  $('#board').innerHTML = name ? teamPageHtml(name) : teamsIndexHtml();
}

function teamsIndexHtml(){
  document.title = 'Teams · Kansas Media Stats';
  // The teams the county plays, each with its whole schedule on the site (their own opponents aren't listed: the site
  // has only their games against these teams).
  const county = new Set(COUNTY.map(canonSchool));
  // Everyone else the site covers: the county's opponents, the AVCTL, and any school that turns up in a game
  // someone has kept — a school joins this list the moment its first game does.
  const named = new Map();
  const add = n => { const k = n && canonSchool(n); if (!k || county.has(k) || named.has(k)) return; named.set(k, schoolName(n)); };
  Object.keys(SCHOOL_INFO).forEach(add);
  AVCTL.forEach(add);
  (allGames.list || []).forEach(x => ['A', 'H'].forEach(sd => add(x.teams[sd] && x.teams[sd].name)));
  const others = [...named.values()].sort((a, b) => a.localeCompare(b));
  const card = (n, size) => { const r = recParts(shownRecord(n));
    return `<a class="tp-card" href="?team=${encodeURIComponent(n)}">${markFor({name:n, abbr:shortName(n), color:'#4A4B4D'}, size)}<b>${esc(n)}</b>${r.length ? `<span>${esc(r[0])}</span>` : ''}</a>`; };
  return `<section class="bcard bhead"><div class="bhead-top"><h1>Teams</h1></div><p class="h-note" style="margin:0">Each team’s record, schedule and results.</p></section>
    <section class="bcard"><h2 class="tp-h">Butler County</h2><div class="tp-grid">${COUNTY.map(n => card(n, 56)).join('')}</div></section>
    <section class="bcard"><h2 class="tp-h">Every other team</h2>${allGames.err ? `<p class="bempty">${esc(allGames.err)}</p>` : ''}
      <div class="tp-grid small">${others.map(n => card(n, 28)).join('')}</div></section>`;
}

function teamPageHtml(nameIn){
  const k = canonSchool(nameIn), rows = schoolRows(nameIn), any = rows[0], tm = any ? any.x.teams[any.side] : null;
  const roster = rosterFor(nameIn) || rosterFromGames(nameIn);
  const lib = (logoLib.list || []).find(t => logoSlug(t.name) === k);
  const name = COUNTY.find(n => canonSchool(n) === k) || (lib && lib.name) || (tm && tm.name) || nameIn;
  tpage.name = name; document.title = `${name} · Kansas Media Stats`;
  const inCounty = COUNTY.some(n => canonSchool(n) === k), r = shownRecord(name);
  const mark = {name, abbr:(tm && tm.abbr) || shortName(name), color:(tm && tm.color) || '#4A4B4D'};
  // The record from the finals on the site, offered when entering one (it misses any game that isn't on the site).
  const c = {w:0, l:0, t:0, hw:0, hl:0, aw:0, al:0};
  rows.forEach(({x, side, opp}) => {
    const f = finalOf(x); if (!f.fin) return;
    const a = f.score[side], b = f.score[opp], res = a > b ? 'w' : a < b ? 'l' : 't';
    c[res]++; if (res !== 't') c[(side === 'H' ? 'h' : 'a') + res]++;
  });
  const f2 = (w, l, t) => `${w}-${l}${t ? '-' + t : ''}`;
  tpage.sug = {rec:f2(c.w, c.l, c.t), home:f2(c.hw, c.hl), away:f2(c.aw, c.al)};
  const val = kk => esc(tpage.draft && kk in tpage.draft ? tpage.draft[kk] : (r && r[kk]) || '');
  const recBox = (kk, label) => `<div class="tp-rec"><b>${esc((r && r[kk]) || '–')}</b><span>${label}</span></div>`;
  const form = ui.admin && tpage.edit ? `<div class="tp-form">
      <div class="row">${[['rec', 'Overall', '3-1'], ['home', 'Home', '2-0'], ['away', 'Away', '1-1']].map(([kk, l, ph]) =>
        `<div class="fld"><label class="eyebrow" for="tp-${kk}">${l}</label><input class="inp" id="tp-${kk}" maxlength="9" autocomplete="off" value="${val(kk)}" placeholder="${ph}"></div>`).join('')}</div>
      <p class="h-note">From the finals on the site: <b>${esc(tpage.sug.rec)}</b> (${esc(tpage.sug.home)} home, ${esc(tpage.sug.away)} away). <button type="button" class="linkbtn" data-tp-use>Use these</button></p>
      <div class="tp-acts"><button type="button" class="btn primary" data-tp-save>Save record</button><button type="button" class="btn" data-tp-cancel>Cancel</button>
        ${teamRecs.map[k] ? '<button type="button" class="btn" data-tp-clear>Clear it (use the tally)</button>' : ''}</div>
      <p class="h-note">Records tally themselves from the results on the site. Set one here only to correct it (say, for a game that isn’t on the site); from then on each new final adds to it. It shows on the scoreboards on ${esc(name)}’s games still to come, and a record typed into one game wins for that game.</p></div>` : '';
  const now = {w:0, l:0, t:0};
  const sched = rows.map(({x, side, opp, wk, stats}) => {
    const m = finalOf(x), o = x.teams[opp], a = m.score[side], b = m.score[opp];
    const res = m.fin ? `<b class="${a > b ? 'w' : a < b ? 'l' : ''}">${a > b ? 'W' : a < b ? 'L' : 'T'}</b> ${a}-${b}${m.q > 4 ? ' (OT)' : ''}`
      : m.live ? `<span class="live">${esc(m.status)}</span> ${a}-${b}` : esc(dayShort(gameDay(x)));
    const go = stats ? `<a class="tp-go" href="?game=${encodeURIComponent(x.id)}${x.box ? '&amp;tab=box' : ''}">${x.box ? 'Box Score' : 'Gamecast'}</a>` : '';
    // The admin can fix a scheduled game or quick score right here (a game with stats is edited through the game).
    const edit = ui.admin && x.kind === 'score', open = edit && tpage.editing && tpage.editing.id === x.id;
    const cell = edit ? `<button type="button" class="tp-res-btn" data-tp-score="${esc(x.id)}" data-side="${side}" title="Edit the score">${res}</button>` : res;
    const d = tpage.sdraft || {}, val = (k, v) => esc(String(d[k] != null ? d[k] : m.fin ? v : ''));
    const form = open ? `<tr class="tp-edit-row"><td colspan="5"><div class="tp-score-form">
        <label>${esc(x.teams[side].name)}<input class="inp" id="tp-s-mine" inputmode="numeric" maxlength="3" autocomplete="off" value="${val('mine', a)}"></label>
        <label>${esc(o.name)}<input class="inp" id="tp-s-opp" inputmode="numeric" maxlength="3" autocomplete="off" value="${val('opp', b)}"></label>
        <label class="tp-ot"><input type="checkbox" id="tp-s-ot"${(d.ot != null ? d.ot : x.per === 'fot') ? ' checked' : ''}> OT/F</label>
        <a class="btn" href="?tracker&amp;box=${encodeURIComponent(x.id)}">Paste box score</a>
        <button type="button" class="btn primary" data-tp-score-save>Save final</button>
        ${m.fin ? '<button type="button" class="btn" data-tp-score-clear>Not played yet</button>' : ''}
        <button type="button" class="btn" data-tp-score-cancel>Cancel</button>
        ${tpage.removing === x.id
          ? `<span class="tp-rm-ask">Take ${esc(x.teams.A.name)} at ${esc(x.teams.H.name)} off every schedule?
             <button type="button" class="btn danger" data-tp-remove-yes>Remove</button><button type="button" class="linkbtn" data-tp-remove-no>Keep it</button></span>`
          : '<button type="button" class="btn danger" data-tp-remove>Remove game</button>'}</div></td></tr>` : '';
    if (m.fin) now[a > b ? 'w' : a < b ? 'l' : 't']++;
    const runNow = m.fin ? `${now.w}-${now.l}${now.t ? '-' + now.t : ''}` : '';
    return `<tr><td class="wk">${esc(weekLabel(wk))}</td><td class="opp"><em>${side === 'A' ? 'at' : 'vs'}</em><a href="?team=${encodeURIComponent(o.name)}">${markFor(o, 24)}${esc(o.name)}</a></td>
      <td class="res">${cell}</td><td class="tp-run">${runNow}</td><td class="lnk">${go}</td></tr>${form}`;
  }).join('');
  // Earlier seasons, from KPreps: a year to pick, and that year's games in place of this season's.
  // This season is the site's own games, up top; KPreps' copy of the same year would only repeat it.
  const H = teamHistory(name), thisYear = String(new Date().getFullYear());
  const years = H && H.seasons ? Object.keys(H.seasons).filter(y => y !== thisYear).sort((a, b) => b - a) : [];
  if (tpage.season && !years.includes(tpage.season)) tpage.season = '';
  const seasonPick = years.length ? `<div class="tp-season"><label class="eyebrow" for="tp-season">Season</label>
      <select class="inp" id="tp-season"><option value=""${tpage.season ? '' : ' selected'}>${thisYear} (this season)</option>
      ${years.map(y => `<option value="${y}"${tpage.season === y ? ' selected' : ''}>${y}</option>`).join('')}</select></div>` : '';
  const S = tpage.season && H && H.seasons[tpage.season];
  const pastRec = S ? S.record : '';
  const run = {w:0, l:0, t:0};   // the record as it stood after each game
  const past = S ? (S.games || []).map(g => {
    const played = g.us != null;
    if (played) run[g.us > g.them ? 'w' : g.us < g.them ? 'l' : 't']++;
    const res = played ? `<b class="${g.us > g.them ? 'w' : g.us < g.them ? 'l' : ''}">${g.us > g.them ? 'W' : g.us < g.them ? 'L' : 'T'}</b> ${g.us}-${g.them}${g.ot ? ' (OT)' : ''}` : '&#8212;';
    const opp = schoolName(g.opp) || g.opp;
    return `<tr><td class="wk">${esc(g.date || '')}</td>
      <td class="opp"><em>${g.at === 'away' ? 'at' : 'vs'}</em><a href="?team=${encodeURIComponent(opp)}">${markFor({name:opp, abbr:shortName(opp), color:'#4A4B4D'}, 24)}${esc(opp)}</a></td>
      <td class="res">${res}</td><td class="lnk tp-run">${played ? `${run.w}-${run.l}${run.t ? '-' + run.t : ''}` : ''}</td></tr>`;
  }).join('') : '';

  return `<section class="bcard tp-head">
      <div class="tp-id">${markFor(mark, 72)}<div><h1>${esc(name)}</h1>${(s => s ? `<p class="tp-sub">${esc(s)}</p>` : '')(schoolLine(name))}</div></div>
      <div class="tp-recs">${recBox('rec', 'Overall')}${recBox('home', 'Home')}${recBox('away', 'Away')}</div>
      ${ui.admin && !tpage.edit ? `<button type="button" class="bhide" data-tp-add-game>Add a game</button><button type="button" class="bhide" data-tp-edit>Edit record</button>${teamRecs.map[k] ? '<p class="h-note tp-manual">This record was set by hand, so it doesn’t come from the tally. Edit record to change or clear it.</p>' : ''}` : ''}
      ${form}
      ${inCounty || rows.some(r => r.stats) || roster || ui.admin ? (() => {
        // Butler County has its own stats pages; every other school's numbers live on State Stats.
        const p = inCounty ? '?stats' : '?statestats', t = inCounty ? '?stats=team' : '?statestats=team', q = encodeURIComponent(name);
        const stats = inCounty || rows.some(r => r.stats)
          ? `<a class="h-btn" href="${p}&amp;team=${q}">Player stats</a><a class="h-btn" href="${t}&amp;team=${q}">Team stats</a>` : '';
        return `<div class="tp-links">${stats}${roster || ui.admin ? '<button type="button" class="h-btn" data-tp-roster>Roster</button>' : ''}</div>`;
      })() : ''}
    </section>
    <section class="bcard"><div class="tp-h-row"><h2 class="tp-h">Schedule &amp; Results</h2>${seasonPick}</div>
      ${coveredSchool(name) || !r ? '' : `<p class="h-note" style="margin:0 0 10px">${esc(name)}’s record here counts the games this site has — a paste or a tracked game adds to it.</p>`}
      ${past ? `<div class="tbl-x"><table class="tp-sched"><tbody>${past}</tbody></table></div>`
        : allGames.list ? (sched ? `<div class="tbl-x"><table class="tp-sched"><tbody>${sched}</tbody></table></div>` : `<p class="bempty">No games for ${esc(name)} on the site yet.</p>`)
        : `<p class="bempty">${esc(allGames.err || 'Loading…')}</p>`}
    </section>
    ${(() => {
      // Whoever has kept a game for this school has shared its roster; anyone setting one up can use it.
      // The admin can type one here for a school nobody has tracked.
      const r = roster;
      if (tpage.rosterEdit === k && ui.admin){
        const text = r ? r.players.map(p => `${p.num || ''} ${p.name}`.trim()).join('\n') : '';
        return `<section class="bcard" id="roster"><h2 class="tp-h">Roster</h2>
          <div class="fld"><label class="eyebrow" for="tp-roster">One player per line: number then name</label>
            <textarea class="inp" id="tp-roster" rows="12" spellcheck="false" placeholder="7 Cole Brandt&#10;28 Isaiah Ford">${esc(text)}</textarea></div>
          <p class="h-note">A line with no number in front is left out. Saving shares it with every scorer, the same as a roster saved in Setup.</p>
          <div class="line"><button type="button" class="btn primary" data-tp-roster-save>Save roster</button>
            <button type="button" class="btn" data-tp-roster-cancel>Cancel</button></div></section>`;
      }
      if (!r) return ui.admin ? `<section class="bcard" id="roster"><h2 class="tp-h">Roster</h2>
        <p class="bempty">No roster for ${esc(name)} yet.</p>
        <div class="line"><button type="button" class="btn" data-tp-roster-edit>Add a roster</button></div></section>` : '';
      const list = r.players.map(p => `<div class="tp-p"><b>${p.num ? esc(p.num) : ''}</b><span>${esc(p.name || '#' + p.num)}</span></div>`).join('');
      const note = r.fromGames
        ? `${plural2(r.count, 'player')} from ${esc(name)}’s games on the site — a pasted box score gives names without numbers.
           Keep a game for them, or save their roster in Setup, and the numbers fill in for everyone.`
        : `${plural2(r.count, 'player')}, from a scorer who has kept a game for ${esc(name)}.
           Anyone starting a game with them can use it in Setup.`;
      return `<section class="bcard" id="roster"><h2 class="tp-h">Roster</h2><div class="tp-roster">${list}</div>
        <p class="h-note" style="margin:10px 0 0">${note}</p>
        ${ui.admin ? '<div class="line" style="margin-top:10px"><button type="button" class="btn" data-tp-roster-edit>Edit roster</button></div>' : ''}</section>`;
    })()}`;
}

// The Roster button takes you down to the card (scroll-margin-top keeps it clear of the bars).
document.addEventListener('change', e => {
  if (e.target.id !== 'tp-season') return;
  tpage.season = e.target.value; renderTeamPage();
});
document.addEventListener('click', e => {
  const c = s => e.target.closest && e.target.closest(s);
  if (c('[data-tp-roster]')){ const el = $('#roster'); if (el) el.scrollIntoView({behavior:'smooth', block:'start'}); return; }
  if (c('[data-tp-roster-edit]')){ tpage.rosterEdit = canonSchool(tpage.name); renderTeamPage(); const t = $('#tp-roster'); if (t) t.focus(); return; }
  if (c('[data-tp-roster-cancel]')){ tpage.rosterEdit = null; renderTeamPage(); return; }
  if (c('[data-tp-roster-save]')) return saveTeamRoster(tpage.name, ($('#tp-roster') || {}).value || '');
  // A game the schedule doesn't have: the score window, with this school already in it.
  if (c('[data-tp-add-game]')){ ui.qsId = null; ui.qsPrefill = {name:tpage.name, side:'H'}; return openDialog('score'); }
});

// Type a roster for a school on its own page. It goes up as a shared roster, so every scorer gets it.
async function saveTeamRoster(name, text){
  // A school's page has no sync of its own — it signs the admin in beside the records, so use that handle.
  const api = sync.api || teamRecs.api, uid = (sync.user && sync.user.uid) || (ui.admin ? ADMIN_UID : null);
  if (!ui.admin || !api || !uid) return toast('Sign in on the Game Tracker first');
  const roster = parseRosterText(text), n = Object.keys(roster).length;
  const {fsM, fsdb} = api, id = `roster-${teamKey(name)}-${uid}`;
  const doc = n ? {owner:uid, updated:Date.now(), public:true, kind:'roster', title:`${name} roster`,
    json:JSON.stringify({name, roster, count:n, updated:Date.now()})}
    : {owner:uid, updated:Date.now(), public:true, kind:'roster', deleted:true, json:''};
  try {
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', id), doc);
    tpage.rosterEdit = null; renderTeamPage();
    toast(n ? `Roster saved — ${plural2(n, 'player')}` : 'Roster cleared');
  } catch (e) { toast('Couldn’t save that roster. Sign in on the Game Tracker, then try again.'); }
}

// Take a game off the schedules — a duplicate, or one that was never going to be played. The document is marked
// deleted with its contents kept, so a mistake can be put back from the database; every page skips it either way.
async function removeTeamGame(){
  const id = tpage.removing, x0 = id && ((allGames.list || []).find(y => y.id === id) || schedById(id));
  if (!x0 || !teamRecs.api) return;
  const title = `${x0.teams.A.name} at ${x0.teams.H.name}`;
  // A game from the schedule file has no document of its own: it goes on the admin's hidden list instead.
  if (x0.file && !(allGames.list || []).some(y => y.id === id)){
    tpage.editing = null; tpage.sdraft = null; tpage.removing = null;
    return toast(await schedRemove(id) ? `Removed ${title}` : 'Couldn’t remove that game. Sign in on the Game Tracker, then try again.');
  }
  allGames.list = allGames.list.filter(y => y.id !== id);
  if (scores.docs && scores.docs[id]) delete scores.docs[id];
  tpage.editing = null; tpage.sdraft = null; tpage.removing = null; indexGames(); recordsChanged();
  const {fsM, fsdb} = teamRecs.api;
  try {
    // Keep what the document held. A game read from the season file is only a summary, so read the real one.
    let keep = x0.snap ? '' : JSON.stringify(x0);
    if (!keep){ try { const d = await fsM.getDoc(fsM.doc(fsdb, 'pressbox', id)); keep = (d.exists() && d.data().json) || ''; } catch (e) {} }
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', id), {owner:ADMIN_UID, updated:Date.now(), public:true, week:gameWeek(x0), kind:'score',
      title, deleted:true, json:keep});
    toast(`Removed ${title}`);
  } catch (e) { toast('Couldn’t remove that game. Sign in on the Game Tracker, then try again.'); }
}
// Save a score fixed on a team page: the game's own document, which the admin's account owns (it loaded the schedule).
async function saveTeamScore(clear){
  const ed = tpage.editing, x0 = ed && ((allGames.list || []).find(y => y.id === ed.id) || schedById(ed.id));
  if (!x0 || !teamRecs.api) return;
  const mine = parseInt(($('#tp-s-mine') || {}).value, 10), theirs = parseInt(($('#tp-s-opp') || {}).value, 10);
  if (!clear && (isNaN(mine) || isNaN(theirs))) return toast('Enter both scores');
  const x = JSON.parse(JSON.stringify(x0)), opp = ed.side === 'A' ? 'H' : 'A';
  if (clear) Object.assign(x, {A:0, H:0, per:'pre', clk:''});
  else Object.assign(x, {[ed.side]:clamp(mine, 0, 199), [opp]:clamp(theirs, 0, 199), per:($('#tp-s-ot') || {}).checked ? 'fot' : 'final', clk:''});
  x.updated = Date.now();
  allGames.list = allGames.list.some(y => y.id === x.id) ? allGames.list.map(y => y.id === x.id ? x : y) : [...allGames.list, x];
  tpage.editing = null; tpage.sdraft = null; indexGames(); recordsChanged();
  const {fsM, fsdb} = teamRecs.api;
  try {
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', x.id), {owner:ADMIN_UID, updated:x.updated, public:true, week:gameWeek(x), kind:'score',
      title:`${x.teams.A.abbr} at ${x.teams.H.abbr}`, json:JSON.stringify(x)});
    toast(clear ? 'Back to not played' : 'Score saved');
  } catch (e) { toast('Couldn’t save that score. Sign in on the Game Tracker, then try again.'); }
}

document.addEventListener('click', e => {
  if (!ui.teamPage || !e.target.closest) return;
  const t = e.target;
  const sc = t.closest('[data-tp-score]');
  if (sc){ tpage.editing = {id:sc.dataset.tpScore, side:sc.dataset.side}; tpage.sdraft = null; tpage.removing = null; return renderTeamPage(); }
  if (t.closest('[data-tp-score-cancel]')){ tpage.editing = null; tpage.sdraft = null; tpage.removing = null; return renderTeamPage(); }
  if (t.closest('[data-tp-score-save]')) return saveTeamScore(false);
  if (t.closest('[data-tp-score-clear]')) return saveTeamScore(true);
  if (t.closest('[data-tp-remove]')){ tpage.removing = tpage.editing && tpage.editing.id; return renderTeamPage(); }
  if (t.closest('[data-tp-remove-no]')){ tpage.removing = null; return renderTeamPage(); }
  if (t.closest('[data-tp-remove-yes]')) return removeTeamGame();
  if (t.closest('[data-tp-edit]')){ tpage.edit = true; tpage.draft = null; return renderTeamPage(); }
  if (t.closest('[data-tp-cancel]')){ tpage.edit = false; tpage.draft = null; return renderTeamPage(); }
  if (t.closest('[data-tp-clear]')){ tpage.edit = false; tpage.draft = null; return saveTeamRecord(tpage.name, {rec:'', home:'', away:''}); }
  if (t.closest('[data-tp-use]')){ tpage.draft = Object.assign({}, tpage.sug); ['rec', 'home', 'away'].forEach(k => { $('#tp-' + k).value = tpage.sug[k]; }); return; }
  if (t.closest('[data-tp-save]')){
    const v = k => $('#tp-' + k).value.trim().slice(0, 9), rec = {rec:v('rec'), home:v('home'), away:v('away')};
    tpage.edit = false; tpage.draft = null; return saveTeamRecord(tpage.name, rec);
  }
});
// What's typed survives a redraw while the record is being edited.
document.addEventListener('input', e => {
  const id = e.target.id || '';
  if (ui.teamPage && /^tp-(rec|home|away)$/.test(id)){ tpage.draft = tpage.draft || {}; tpage.draft[id.slice(3)] = e.target.value; }
  if (ui.teamPage && /^tp-s-(mine|opp)$/.test(id)){ tpage.sdraft = tpage.sdraft || {}; tpage.sdraft[id.slice(5)] = e.target.value; }
  if (ui.teamPage && id === 'tp-s-ot'){ tpage.sdraft = tpage.sdraft || {}; tpage.sdraft.ot = e.target.checked; }
});
/* Generated from the KPreps Kansas football week pages (kpreps.com/kansas/scores/football/?week=N), 2026 regular
   season: every game of the Butler County schools' opponents that doesn't include a county school (the county
   schedule stands as it is). [date, away, home, away score, home score]; scores are null until played. */
const OPP_SCHEDULE_2026 = [
  ["2026-09-03", "Haysville Campus", "Goddard", 12, 36],
  ["2026-09-04", "Abilene", "Concordia", 0, 33],
  ["2026-09-04", "Arkansas City", "Winfield", 26, 6],
  ["2026-09-04", "Belle Plaine", "Hutchinson Trinity", 14, 30],
  ["2026-09-04", "Buhler", "Maize South", 28, 7],
  ["2026-09-04", "Caney Valley", "Eureka", 58, 0],
  ["2026-09-04", "Chanute", "Mulvane", 12, 24],
  ["2026-09-04", "Chaparral", "Medicine Lodge", 47, 22],
  ["2026-09-04", "Cherryvale", "Fredonia", 36, 16],
  ["2026-09-04", "Colony-Crest", "Yates Center", 0, 48],
  ["2026-09-04", "Derby", "Eisenhower", 45, 21],
  ["2026-09-04", "Garden Plain", "Cheney", 27, 28],
  ["2026-09-04", "Haven", "Nickerson", 46, 7],
  ["2026-09-04", "Hesston", "Halstead", 35, 6],
  ["2026-09-04", "Hillsboro", "Hoisington", 8, 26],
  ["2026-09-04", "Holcomb", "Lakin", 40, 0],
  ["2026-09-04", "Independence", "Columbus", 36, 33],
  ["2026-09-04", "Inman", "Sedgwick", 71, 0],
  ["2026-09-04", "Lebo", "Madison", 30, 6],
  ["2026-09-04", "Marmaton Valley", "Oswego", 32, 56],
  ["2026-09-04", "Mission Valley", "Council Grove", 6, 62],
  ["2026-09-04", "Moundridge", "Sterling", 21, 53],
  ["2026-09-04", "Onaga", "Doniphan West", 24, 20],
  ["2026-09-04", "Oxford", "Chase County", 12, 26],
  ["2026-09-04", "Pleasanton", "St. Paul", 38, 30],
  ["2026-09-04", "Salina South", "Salina Central", 35, 33],
  ["2026-09-04", "Sedan", "Central Burden", 26, 40],
  ["2026-09-04", "Syracuse", "Ulysses", 0, 60],
  ["2026-09-04", "Uniontown", "Jayhawk-Linn", 8, 44],
  ["2026-09-04", "Valley Center", "Newton", 36, 34],
  ["2026-09-04", "Wellington", "Clearwater", 48, 7],
  ["2026-09-11", "Belle Plaine", "Kingman", 8, 42],
  ["2026-09-11", "Central Burden", "Chase County", 14, 52],
  ["2026-09-11", "Coffeyville", "Chanute", 8, 43],
  ["2026-09-11", "Conway Springs", "Cheney", 0, 37],
  ["2026-09-11", "Eisenhower", "Haysville Campus", 32, 28],
  ["2026-09-11", "Eureka", "Humboldt", 0, 42],
  ["2026-09-11", "Holcomb", "Garden Plain", 21, 25],
  ["2026-09-11", "Hutchinson", "Derby", 13, 55],
  ["2026-09-11", "Lakin", "Syracuse", 0, 13],
  ["2026-09-11", "Larned", "Hillsboro", 0, 37],
  ["2026-09-11", "Madison", "Waverly", 44, 40],
  ["2026-09-11", "Maize", "Salina South", 48, 6],
  ["2026-09-11", "Maize South", "Valley Center", 48, 20],
  ["2026-09-11", "Marion", "Inman", 0, 41],
  ["2026-09-11", "Marmaton Valley", "Yates Center", 58, 50],
  ["2026-09-11", "McPherson", "Great Bend", 3, 21],
  ["2026-09-11", "Mission Valley", "West Franklin", 43, 13],
  ["2026-09-11", "Moundridge", "Sedgwick", 41, 0],
  ["2026-09-11", "Mulvane", "Buhler", 23, 28],
  ["2026-09-11", "Neodesha", "Cherryvale", 49, 22],
  ["2026-09-11", "Newton", "Arkansas City", 25, 48],
  ["2026-09-11", "Nickerson", "Halstead", 6, 56],
  ["2026-09-11", "Oswego", "St. Paul", 59, 14],
  ["2026-09-11", "Pratt", "Haven", 41, 42],
  ["2026-09-11", "Salina Central", "Goddard", 34, 20],
  ["2026-09-11", "Sedan", "Cedar Vale-Dexter", 74, 24],
  ["2026-09-11", "Southeast-Cherokee", "Colony-Crest", 52, 44],
  ["2026-09-11", "Sterling", "Hutchinson Trinity", 55, 0],
  ["2026-09-11", "Udall", "West Elk", 0, 48],
  ["2026-09-11", "Wamego", "Abilene", 57, 13],
  ["2026-09-11", "Wellington", "Wichita Collegiate", 33, 13],
  ["2026-09-18", "Andale", "Wellington", null, null],
  ["2026-09-18", "Arkansas City", "Salina Central", null, null],
  ["2026-09-18", "Buhler", "McPherson", null, null],
  ["2026-09-18", "Central Heights", "Uniontown", null, null],
  ["2026-09-18", "Chanute", "Louisburg", null, null],
  ["2026-09-18", "Chaparral", "Conway Springs", null, null],
  ["2026-09-18", "Chapman", "Abilene", null, null],
  ["2026-09-18", "Ellinwood", "Moundridge", null, null],
  ["2026-09-18", "Eureka", "Neodesha", null, null],
  ["2026-09-18", "Fort Scott", "Independence", null, null],
  ["2026-09-18", "Garden Plain", "Wichita Trinity", null, null],
  ["2026-09-18", "Goddard", "Eisenhower", null, null],
  ["2026-09-18", "Goodland", "Lakin", null, null],
  ["2026-09-18", "Halstead", "Larned", null, null],
  ["2026-09-18", "Hesston", "Pratt", null, null],
  ["2026-09-18", "Hillsboro", "Haven", null, null],
  ["2026-09-18", "Humboldt", "Caney Valley", null, null],
  ["2026-09-18", "Hutchinson Trinity", "Marion", null, null],
  ["2026-09-18", "Inman", "Sterling", null, null],
  ["2026-09-18", "Madison", "Northern Heights", null, null],
  ["2026-09-18", "Maize South", "Maize", null, null],
  ["2026-09-18", "Medicine Lodge", "Kingman", null, null],
  ["2026-09-18", "Olpe", "Mission Valley", null, null],
  ["2026-09-18", "Oswego", "Colony-Crest", null, null],
  ["2026-09-18", "Pleasanton", "Marmaton Valley", null, null],
  ["2026-09-18", "Salina South", "Hutchinson", null, null],
  ["2026-09-18", "Southeast-Cherokee", "Oxford", null, null],
  ["2026-09-18", "Southwestern Heights", "Syracuse", null, null],
  ["2026-09-18", "St. Paul", "Yates Center", null, null],
  ["2026-09-18", "Udall", "Stafford", null, null],
  ["2026-09-18", "Wabaunsee", "Onaga", null, null],
  ["2026-09-18", "West Elk", "Sedan", null, null],
  ["2026-09-18", "Winfield", "Mulvane", null, null],
  ["2026-09-24", "Medicine Lodge", "Belle Plaine", null, null],
  ["2026-09-25", "Abilene", "Rock Creek", null, null],
  ["2026-09-25", "Cedar Vale-Dexter", "Central Burden", null, null],
  ["2026-09-25", "Cheney", "Clearwater", null, null],
  ["2026-09-25", "Cherryvale", "Galena", null, null],
  ["2026-09-25", "Coffeyville", "Independence", null, null],
  ["2026-09-25", "Colony-Crest", "Madison", null, null],
  ["2026-09-25", "Derby", "Maize", null, null],
  ["2026-09-25", "Erie", "Udall", null, null],
  ["2026-09-25", "Goddard", "Newton", null, null],
  ["2026-09-25", "Great Bend", "Buhler", null, null],
  ["2026-09-25", "Halstead", "Garden Plain", null, null],
  ["2026-09-25", "Humboldt", "Fredonia", null, null],
  ["2026-09-25", "Hutchinson", "Haysville Campus", null, null],
  ["2026-09-25", "Inman", "Hutchinson Trinity", null, null],
  ["2026-09-25", "Lakin", "Cimarron", null, null],
  ["2026-09-25", "Marion", "Chaparral", null, null],
  ["2026-09-25", "Mission Valley", "Onaga", null, null],
  ["2026-09-25", "Moundridge", "Conway Springs", null, null],
  ["2026-09-25", "Mulvane", "Wamego", null, null],
  ["2026-09-25", "Pratt", "Larned", null, null],
  ["2026-09-25", "Salina Central", "Eisenhower", null, null],
  ["2026-09-25", "South Sumner Co.", "Oxford", null, null],
  ["2026-09-25", "St. Paul", "Marmaton Valley", null, null],
  ["2026-09-25", "Sterling", "Sedgwick", null, null],
  ["2026-09-25", "Uniontown", "Northeast-Arma", null, null],
  ["2026-09-25", "Valley Center", "Salina South", null, null],
  ["2026-09-25", "Wichita Collegiate", "Andale", null, null],
  ["2026-09-25", "Wichita Trinity", "Syracuse", null, null],
  ["2026-10-02", "Andale", "Cheney", null, null],
  ["2026-10-02", "Baxter Springs", "Cherryvale", null, null],
  ["2026-10-02", "Central Burden", "South Sumner Co.", null, null],
  ["2026-10-02", "Central Heights", "Humboldt", null, null],
  ["2026-10-02", "Chanute", "Independence", null, null],
  ["2026-10-02", "Clay Center", "Abilene", null, null],
  ["2026-10-02", "Clearwater", "Wichita Trinity", null, null],
  ["2026-10-02", "Coffeyville", "Winfield", null, null],
  ["2026-10-02", "Conway Springs", "Medicine Lodge", null, null],
  ["2026-10-02", "Derby", "Maize South", null, null],
  ["2026-10-02", "Haven", "Marion", null, null],
  ["2026-10-02", "Haysville Campus", "Valley Center", null, null],
  ["2026-10-02", "Hillsboro", "Inman", null, null],
  ["2026-10-02", "Hoisington", "Pratt", null, null],
  ["2026-10-02", "Hutchinson Trinity", "Moundridge", null, null],
  ["2026-10-02", "Maize", "Hutchinson", null, null],
  ["2026-10-02", "Newton", "Salina Central", null, null],
  ["2026-10-02", "Olpe", "Eureka", null, null],
  ["2026-10-02", "Osawatomie", "Uniontown", null, null],
  ["2026-10-02", "Oxford", "Udall", null, null],
  ["2026-10-02", "Reno County Homeschool", "Belle Plaine", null, null],
  ["2026-10-02", "Salina South", "Arkansas City", null, null],
  ["2026-10-02", "Sedan", "Madison", null, null],
  ["2026-10-02", "Sedgwick", "Nickerson", null, null],
  ["2026-10-02", "Southeast of Saline", "Wichita Collegiate", null, null],
  ["2026-10-02", "Southwestern Heights", "Lakin", null, null],
  ["2026-10-02", "St. Paul", "Colony-Crest", null, null],
  ["2026-10-02", "Sterling", "Halstead", null, null],
  ["2026-10-02", "Valley Falls", "Onaga", null, null],
  ["2026-10-02", "Wellington", "Mulvane", null, null],
  ["2026-10-08", "Newton", "Eisenhower", null, null],
  ["2026-10-09", "Belle Plaine", "Conway Springs", null, null],
  ["2026-10-09", "Buhler", "Wellington", null, null],
  ["2026-10-09", "Cheney", "Wichita Collegiate", null, null],
  ["2026-10-09", "Cherryvale", "Caney Valley", null, null],
  ["2026-10-09", "Colony-Crest", "Sedan", null, null],
  ["2026-10-09", "Eureka", "Northeast-Arma", null, null],
  ["2026-10-09", "Fort Scott", "Chanute", null, null],
  ["2026-10-09", "Haven", "Larned", null, null],
  ["2026-10-09", "Haysville Campus", "Maize", null, null],
  ["2026-10-09", "Humboldt", "Neodesha", null, null],
  ["2026-10-09", "Hutchinson Trinity", "Sacred Heart", null, null],
  ["2026-10-09", "Independence", "Ottawa", null, null],
  ["2026-10-09", "Jackson Heights", "Onaga", null, null],
  ["2026-10-09", "Lakin", "Kingman", null, null],
  ["2026-10-09", "Lincoln", "Oxford", null, null],
  ["2026-10-09", "Madison", "Marmaton Valley", null, null],
  ["2026-10-09", "Maize South", "Salina South", null, null],
  ["2026-10-09", "Marion", "Garden Plain", null, null],
  ["2026-10-09", "McPherson", "Mulvane", null, null],
  ["2026-10-09", "Mission Valley", "St. Marys", null, null],
  ["2026-10-09", "Moundridge", "Hillsboro", null, null],
  ["2026-10-09", "Osage City", "Clearwater", null, null],
  ["2026-10-09", "Pratt", "Nickerson", null, null],
  ["2026-10-09", "Salina Central", "Hutchinson", null, null],
  ["2026-10-09", "St. Marys Colgan", "Uniontown", null, null],
  ["2026-10-09", "Syracuse", "Medicine Lodge", null, null],
  ["2026-10-09", "Udall", "Central Burden", null, null],
  ["2026-10-09", "Valley Center", "Derby", null, null],
  ["2026-10-09", "Wichita Trinity", "Andale", null, null],
  ["2026-10-16", "Andale", "Clearwater", null, null],
  ["2026-10-16", "Cedar Vale-Dexter", "Udall", null, null],
  ["2026-10-16", "Central Burden", "Oxford", null, null],
  ["2026-10-16", "Chanute", "Pittsburg", null, null],
  ["2026-10-16", "Cherryvale", "Humboldt", null, null],
  ["2026-10-16", "Conway Springs", "Sedgwick", null, null],
  ["2026-10-16", "Council Grove", "Inman", null, null],
  ["2026-10-16", "Eisenhower", "Arkansas City", null, null],
  ["2026-10-16", "Garden Plain", "Haven", null, null],
  ["2026-10-16", "Goddard", "Derby", null, null],
  ["2026-10-16", "Halstead", "Marion", null, null],
  ["2026-10-16", "Hillsboro", "Hutchinson Trinity", null, null],
  ["2026-10-16", "Hutchinson", "Maize South", null, null],
  ["2026-10-16", "Independence", "Labette County", null, null],
  ["2026-10-16", "Maize", "Valley Center", null, null],
  ["2026-10-16", "Marmaton Valley", "Sedan", null, null],
  ["2026-10-16", "Medicine Lodge", "Ellinwood", null, null],
  ["2026-10-16", "Onaga", "Valley Heights", null, null],
  ["2026-10-16", "Pratt", "Cheney", null, null],
  ["2026-10-16", "Rossville", "Mission Valley", null, null],
  ["2026-10-16", "St. Paul", "Madison", null, null],
  ["2026-10-16", "Sterling", "Syracuse", null, null],
  ["2026-10-16", "Tonganoxie", "McPherson", null, null],
  ["2026-10-16", "Uniontown", "Eureka", null, null],
  ["2026-10-16", "Wellington", "Fort Scott", null, null],
  ["2026-10-16", "Wichita Collegiate", "Wichita Trinity", null, null],
  ["2026-10-16", "Winfield", "Buhler", null, null],
  ["2026-10-22", "Eureka", "St. Marys Colgan", null, null],
  ["2026-10-23", "Abilene", "Marysville", null, null],
  ["2026-10-23", "Central Burden", "Oswego", null, null],
  ["2026-10-23", "Chaparral", "Lakin", null, null],
  ["2026-10-23", "Clearwater", "Wichita Collegiate", null, null],
  ["2026-10-23", "Colony-Crest", "Marmaton Valley", null, null],
  ["2026-10-23", "Goddard", "Arkansas City", null, null],
  ["2026-10-23", "Haven", "Halstead", null, null],
  ["2026-10-23", "Hoisington", "Garden Plain", null, null],
  ["2026-10-23", "Hutchinson", "Valley Center", null, null],
  ["2026-10-23", "Jayhawk-Linn", "Humboldt", null, null],
  ["2026-10-23", "Labette County", "Chanute", null, null],
  ["2026-10-23", "Lyons", "Pratt", null, null],
  ["2026-10-23", "Maize", "Newton", null, null],
  ["2026-10-23", "Maize South", "Haysville Campus", null, null],
  ["2026-10-23", "McPherson", "Winfield", null, null],
  ["2026-10-23", "Medicine Lodge", "Sterling", null, null],
  ["2026-10-23", "Moundridge", "Inman", null, null],
  ["2026-10-23", "Olpe", "Uniontown", null, null],
  ["2026-10-23", "Onaga", "Centralia", null, null],
  ["2026-10-23", "Oxford", "Cedar Vale-Dexter", null, null],
  ["2026-10-23", "Reno County Homeschool", "Andale", null, null],
  ["2026-10-23", "Riverton", "Cherryvale", null, null],
  ["2026-10-23", "Sedan", "St. Paul", null, null],
  ["2026-10-23", "Sedgwick", "Belle Plaine", null, null],
  ["2026-10-23", "Smoky Valley", "Hillsboro", null, null],
  ["2026-10-23", "Syracuse", "Ellinwood", null, null],
  ["2026-10-23", "Udall", "South Sumner Co.", null, null],
  ["2026-10-23", "Wabaunsee", "Mission Valley", null, null]
];

