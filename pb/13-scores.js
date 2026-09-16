/* ================================================================
   Scoreboard: the week's games across the top, the way ESPN runs its
   scores strip. The scorer sees every game on this device plus anyone's
   shared games; fans on a live link see the shared ones (the Firestore
   rules let anyone read a game whose live link is on). Quick scores —
   a score and nothing else, for games nobody is keeping stats on — ride
   along and are always on everyone's scoreboard.
   Weeks follow the Kansas high school calendar: Week 1 is the first
   Friday in September, and a week runs Tuesday through Monday so a
   Monday make-up game stays with its Friday. A game's week comes from
   the day it was set up.
   ================================================================ */
const WEEK_MS = 7 * 864e5;
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromYmd = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
// The Tuesday that starts the week holding time t, as "YYYY-MM-DD".
function weekKey(t){ const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 5) % 7); return ymd(d); }
// Week 1's Tuesday: three days before the first Friday in September.
function week1(y){ const d = new Date(y, 8, 1); d.setDate(1 + (12 - d.getDay()) % 7 - 3); return d; }
const weekNum = k => { const d = fromYmd(k); return Math.round((d - week1(d.getFullYear())) / WEEK_MS) + 1; };
// Nine regular-season weeks, then the four playoff rounds.
const PLAYOFFS = ['Regionals', 'Sectionals', 'Sub-State', 'State Championship'];
function weekLabel(k){
  const n = weekNum(k);
  if (n >= 1 && n <= 9) return `Week ${n}`;
  if (n >= 10 && n <= 13) return PLAYOFFS[n - 10];
  const f = fromYmd(k); f.setDate(f.getDate() + 3);   // that week's Friday
  return 'Week of ' + f.toLocaleDateString(undefined, {month:'short', day:'numeric'});
}
// A game's date: the one set in Setup or on the score form, else the day it was set up. Its week follows.
const gameDay = x => x.date ? fromYmd(x.date) : new Date(x.created || x.updated || Date.now());
const gameWeek = x => weekKey(gameDay(x).getTime());

/* ---------- quick scores: a game's score and nothing else ---------- */
// Kept apart from the games (db.scores), synced as their own documents (kind 'score'), always public.
const qsLib = () => db.scores || (db.scores = {});
const QS_PER = [['pre', 'Pre'], ['1', '1st'], ['2', '2nd'], ['half', 'Half'], ['3', '3rd'], ['4', '4th'], ['ot', 'OT'], ['final', 'Final'], ['ff', 'Forfeit']];
const QS_STATUS = {pre:'Pregame', half:'Halftime', ot:'OT', final:'Final', ff:'Forfeit'};
// A forfeit is a 2-0 win, the way KSHSAA records it.
const FORFEIT = 2;
const dayShort = d => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
const inQuarter = per => /^[1-4]$/.test(String(per));
// A short name for a school with none saved: initials for two or more words, else the first letters.
function shortName(name){
  const listed = typeof listAbbr === 'function' ? listAbbr(name) : '';   // the logo list's own short name wins
  if (listed) return listed;
  const w = String(name).replace(/[^A-Za-z ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (w.length > 1) return w.map(x => x[0]).join('').slice(0, 4).toUpperCase();
  const one = w[0] || '?'; return (one.length <= 4 ? one : one.slice(0, 3)).toUpperCase();
}
function pushScore(x){
  if (!x || !sync.user || !sync.api) return;
  const {fsM, fsdb} = sync.api;
  const doc = x.deleted ? {owner:sync.user.uid, updated:x.updated, deleted:true, kind:'score', json:''}
    : {owner:sync.user.uid, updated:x.updated, public:true, week:gameWeek(x), kind:'score', title:`${x.teams.A.abbr} at ${x.teams.H.abbr}`, json:JSON.stringify(x)};
  fsM.setDoc(fsM.doc(fsdb, 'pressbox', x.id), doc).catch(e => {
    // A schedule entry another account already put up can't be written from this one; that's expected.
    if (x.sched && /permission/.test(e?.code || '')) return;
    sync.err = friendlySync(e); sync.state = 'error'; renderSync();
  });
}
// From the account: whichever copy was saved last wins, and a deletion sticks.
function mergeScore(id, d){
  const lib = qsLib(), a = lib[id], ru = d.updated || 0, lu = a ? a.updated || 0 : -1;
  if (ru > lu){
    if (d.deleted) lib[id] = {id, kind:'score', deleted:true, updated:ru};
    else { try { lib[id] = JSON.parse(d.json); } catch (e) { return; } }
    persist(); renderScores();
  } else if (a && lu > ru) pushScore(a);
}
// A new score goes on today, unless the strip is showing another week: then on that week's Friday.
function scoreDefaultDate(){
  const k = ui.week;
  if (!k || k === weekKey(Date.now())) return ymd(new Date());
  const f = fromYmd(k); f.setDate(f.getDate() + 3); return ymd(f);
}
function dlgScore(id){
  const x = id && qsLib()[id] && !qsLib()[id].deleted ? qsLib()[id] : null, per = x ? String(x.per) : '1';
  const date = x ? ymd(gameDay(x)) : scoreDefaultDate();
  // Saved teams and every school with a logo, so a typed name finds its logo.
  const side = (s, label) => `<div class="qs-side"><div class="fld"><label class="eyebrow" for="qs-${s}-name">${label}</label>
      ${schoolPicker(`qs-${s}-name`, x ? x.teams[s].name : '', s === 'A' ? 'Visiting school' : 'Home school')}</div>
    <div class="fld qs-pts"><label class="eyebrow" for="qs-${s}-pts">Score</label>
      <input class="inp" id="qs-${s}-pts" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${x ? +x[s] || 0 : ''}" placeholder="0"></div></div>
    <div class="row qs-rec">${recFields('qs', s, x && x.teams[s])}</div>`;
  const note = sync.user ? 'Shows on everyone’s scoreboard as soon as you save.'
    : sync.state === 'unavailable' ? 'Saved on this device. From your own site, signed in, scores go on everyone’s scoreboard.'
    : `Saved on this device. Sign in to put it on everyone’s scoreboard.${sync.api ? ' <button type="button" class="linkbtn" data-signin>Sign in</button>' : ''}`;
  // The bigger jobs first, where they're seen: a box score or keeping stats; then the plain score.
  return `${dlgHead(x ? 'Update score' : 'Add a score')}<div class="dlg-bd">
    <div class="line qs-top">${x ? `<button type="button" class="btn small primary" data-qs-box="${esc(x.id)}">Paste box score</button><button type="button" class="btn small" data-qs-stats="${esc(x.id)}">Keep stats on this game</button>`
      : '<button type="button" class="btn small primary" data-qs-box="">Paste a box score instead</button>'}</div>
    <p class="hint qs-or">${x ? 'Or just update the score:' : 'Or just enter the score:'}</p>
    ${side('A', 'Visitors')}${side('H', 'Home')}
    <div class="fld"><span class="eyebrow">Status</span><div class="seg" id="qs-per">${QS_PER.map(([v, l]) => `<button type="button" data-qs-per="${v}" aria-pressed="${per === v}">${l}</button>`).join('')}</div></div>
    <div class="fld"${inQuarter(per) ? '' : ' hidden'}><label class="eyebrow" for="qs-clk">Time left, optional</label><input class="inp" id="qs-clk" inputmode="numeric" placeholder="4:12" value="${esc(x && x.clk || '')}"></div>
    <p class="hint" id="qs-ff"${per === 'ff' ? '' : ' hidden'}>A forfeit goes down as ${FORFEIT}-0. Put the ${FORFEIT} beside the team that was awarded the win.</p>
    <div class="fld"><label class="eyebrow" for="qs-date">Game date</label><input class="inp" type="date" id="qs-date" value="${date}"></div>
    <p class="hint">${note}</p>
    </div>
    <div class="dlg-ft">${x ? `<button type="button" class="btn danger" data-qs-del="${esc(x.id)}" style="margin-right:auto">Delete</button>` : ''}
      <button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" data-qs-save="${esc(x ? x.id : '')}">Save</button></div>`;
}
function saveScore(id){
  const nm = s => $(`#qs-${s}-name`).value.trim(), A = nm('A'), H = nm('H');
  if (!A || !H) return toast('Pick both schools from the list');
  const lib = qsLib(), old = id && lib[id] && !lib[id].deleted ? lib[id] : null;
  // A saved team brings its short name and color; otherwise keep what this score had, or make one up.
  const team = (s, name, was) => { const t = findTeam(name), same = was && was.name === name;
    return {name, abbr:(t && t.abbr) || (same && was.abbr) || shortName(name), color:(t && t.color) || (same && was.color) || '#4A4B4D',
      rec:recValue('qs', s, 'rec'), hrec:recValue('qs', s, 'hrec')}; };
  const pts = s => { const el = $(`#qs-${s}-pts`); return clamp(parseInt(el.value || el.dataset.was || '0', 10) || 0, 0, 199); };
  const perBtn = $('#qs-per [aria-pressed="true"]'), per = perBtn ? perBtn.dataset.qsPer : '1', c = parseClock($('#qs-clk').value);
  const dv = $('#qs-date').value, date = /^\d{4}-\d\d-\d\d$/.test(dv) ? dv : ymd(new Date());
  let a = pts('A'), h = pts('H');
  if (per === 'ff'){
    if (a === h) return toast(`Which team won it? Put ${FORFEIT} beside them and 0 beside the other`);
    [a, h] = a > h ? [FORFEIT, 0] : [0, FORFEIT];
  }
  const x = Object.assign(old || {id:'s' + Date.now().toString(36), kind:'score', created:Date.now()}, {
    teams:{A:team('A', A, old && old.teams.A), H:team('H', H, old && old.teams.H)}, A:a, H:h,
    per, clk:inQuarter(per) && c != null ? mmss(c) : '', date, updated:Date.now()});
  lib[x.id] = x; persist(); pushScore(x); closeDialog();
  // Show the week it went into, in case that isn't the week on screen.
  const wk = gameWeek(x); if (wk !== shownWeek()) ui.week = wk;
  renderScores(); toast(`Score saved to ${weekLabel(wk)}`);
}
function deleteScore(id){
  qsLib()[id] = {id, kind:'score', deleted:true, updated:Date.now()};
  persist(); pushScore(qsLib()[id]); closeDialog(); renderScores(); toast('Score removed');
}

/* ---------- shared games for the week, live from Firestore ---------- */
const scores = {api:null, key:null, unsub:null, docs:{}, seen:null};
function scoresReady(api){ scores.api = api; scores.key = null; watchHidden(api); watchTeamRecs(api); watchAllGames(api); watchSchools(api); renderScores(); }

/* ---------- games the admin has hidden from the scoreboards ---------- */
// One shared list, in a document only the admin's account can change (the rules let only a document's owner write
// it) and anyone can read, since it's public. Hidden games are left off both scoreboards, the strip and BUCO Stats;
// the admin still sees them on the scoreboards, faded, with Show to bring one back.
const ADMIN_UID = '2lbD7tPuufPdkBPtxbgSYnZwizp2';
const HIDE_DOC = 'hidden-games';
const hideList = {ids:new Set(), shown:new Set(), api:null, unsub:null};
// Off the scoreboards: a game the admin hid, or a game between two other schools (an opponent's own game) that the
// admin hasn't shown. Those still count toward records and team schedules; only a game the admin hid doesn't.
const isHidden = x => !!x && (hideList.ids.has(x.id) || (!!x.opp && !hideList.shown.has(x.id)));
function watchHidden(api){
  hideList.api = api;
  if (hideList.unsub) return;
  const {fsM, fsdb} = api;
  // Until the admin first hides something there is no list, and reading it is refused: then nothing is hidden.
  hideList.unsub = fsM.onSnapshot(fsM.doc(fsdb, 'pressbox', HIDE_DOC), snap => {
    const d = snap.exists() ? snap.data() : null;
    let ids = [], shown = [];
    if (d && d.owner === ADMIN_UID && !d.deleted){ try { const j = JSON.parse(d.json); ids = j.ids || []; shown = j.shown || []; } catch (e) {} }
    hideList.ids = new Set(ids); hideList.shown = new Set(shown); hiddenChanged();
  }, () => { hideList.unsub = null; });
}
function hiddenChanged(){
  if (allGames.list) indexGames();   // a hidden game no longer counts toward a team's record or schedule
  renderScores(); renderScoreboard(); renderHome(); renderTeamPage(); if (ui.county) renderCounty();
}
// Hide a game, or show it again. An opponent's own game starts hidden, so showing it puts it on the shown list.
async function toggleHide(id, opp){
  if (!ui.admin || !hideList.api) return;
  const ids = new Set(hideList.ids), shown = new Set(hideList.shown);
  const hide = !(ids.has(id) || (opp && !shown.has(id)));
  if (hide){ if (opp) shown.delete(id); else ids.add(id); }
  else { ids.delete(id); if (opp) shown.add(id); }
  hideList.ids = ids; hideList.shown = shown; hiddenChanged();
  const {fsM, fsdb} = hideList.api;
  try {
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', HIDE_DOC), {owner:ADMIN_UID, updated:Date.now(), public:true, kind:'hidden',
      title:'Hidden from the scoreboards', json:JSON.stringify({ids:[...ids], shown:[...shown]})});
    toast(hide ? 'Hidden from the scoreboards' : 'On the scoreboard');
    if (!hideList.unsub) watchHidden(hideList.api);   // the first save makes the list: follow it from now on
  } catch (e) { toast('Couldn’t save that. Sign in on the Game Tracker, then try again.'); }
}
function watchWeek(key){
  if (!scores.api || scores.key === key) return;
  if (scores.unsub) scores.unsub();
  scores.key = key; scores.docs = {}; scores.ready = null;
  const {fsM, fsdb} = scores.api;
  const q = fsM.query(fsM.collection(fsdb, 'pressbox'), fsM.where('public', '==', true), fsM.where('week', '==', key));
  scores.unsub = fsM.onSnapshot(q, snap => {
    const docs = {};
    snap.forEach(x => { const d = x.data(); if (d.deleted || !d.json) return; try { docs[x.id] = JSON.parse(d.json); } catch (e) {} });
    scores.docs = docs; scores.ready = key; renderScores(); renderScoreboard(); renderHome();
  }, () => { scores.docs = {}; scores.ready = key; renderScores(); renderScoreboard(); renderHome(); });
}

/* ---------- which week and which games ---------- */
function shownWeek(){
  if (ui.week) return ui.week;
  if (g && !g.sample) return gameWeek(g);
  return weekKey(Date.now());
}
// Shared copies first; this device's own copy wins, since it's the working copy.
// The admin's hidden games are left out, unless asked for (the admin's own view of a scoreboard); so are the
// opponents' own games (the State Scoreboard asks for those).
function weekGames(key, withHidden, withOpp){
  const out = {};
  Object.entries(scores.docs).forEach(([id, x]) => { if (x && x.teams) out[id] = Object.assign(x, {id}); });
  if (!ui.viewer){
    Object.values(db.games).forEach(x => { if (x && x.teams && x.teams.A && x.teams.H && !x.sample && gameWeek(x) === key) out[x.id] = x; });
    Object.values(qsLib()).forEach(x => { if (x.deleted) delete out[x.id]; else if (x.teams && gameWeek(x) === key) out[x.id] = x; });
  }
  if (g && !g.sample && gameWeek(g) === key) out[g.id] = g;
  // A game someone is keeping stats on takes the place of its schedule entry or quick score.
  const pair = x => [x.teams.A.name, x.teams.H.name].map(canonSchool).sort().join('|');
  // (A hidden game doesn't take its schedule entry's place.)
  const statted = new Set(Object.values(out).filter(x => x.kind !== 'score' && !isHidden(x)).map(pair));
  Object.values(out).forEach(x => { if ((x.kind === 'score' && statted.has(pair(x))) || (!withHidden && isHidden(x)) || (x.opp && !withOpp)) delete out[x.id]; });
  return Object.values(out).sort((a, b) => gameDay(a) - gameDay(b) || (a.created || 0) - (b.created || 0));
}
// Every week of this season, plus any week this device has a game or score in.
function weekOptions(cur){
  const ks = new Set([cur, weekKey(Date.now())]);
  if (!ui.viewer){
    Object.values(db.games).forEach(x => { if (!x.sample) ks.add(gameWeek(x)); });
    Object.values(qsLib()).forEach(x => { if (!x.deleted && x.created) ks.add(gameWeek(x)); });
  }
  seasonKeys(new Date().getFullYear()).forEach(k => ks.add(k));   // the whole season, so a game or score can go in any week
  return [...ks].sort();
}

/* ---------- team records, typed in by the scorer ---------- */
// ESPN style, "1-2, 0-1 Away": the season record, then the road or home record. Empty until one is entered.
// A game still to come (current) with no record typed in shows the team's record from its team page.
function recordText(t, s, current){
  let rec = t && t.rec, hrec = t && t.hrec;
  if (current && t && !rec && !hrec){ const r = shownRecord(t.name); if (r){ rec = r.rec || ''; hrec = (s === 'A' ? r.away : r.home) || ''; } }
  const where = s === 'A' ? 'Away' : 'Home', ha = hrec ? `${hrec} ${where}` : '';
  return rec || ha ? [rec, ha].filter(Boolean).join(', ') : '';
}
// The two record boxes for a team, in Setup (pre "s") or a quick score (pre "qs").
function recFields(pre, s, t){
  const where = s === 'A' ? 'Away' : 'Home';
  return `<div class="fld"><label class="eyebrow" for="${pre}-${s}-rec">Record, optional</label><input class="inp" id="${pre}-${s}-rec" maxlength="9" autocomplete="off" value="${esc(t && t.rec || '')}" placeholder="1-2"></div>
    <div class="fld"><label class="eyebrow" for="${pre}-${s}-hrec">${where} record</label><input class="inp" id="${pre}-${s}-hrec" maxlength="9" autocomplete="off" value="${esc(t && t.hrec || '')}" placeholder="0-1"></div>`;
}
const recValue = (pre, s, k) => { const el = $(`#${pre}-${s}-${k}`); return el ? el.value.trim().slice(0, 9) : ''; };

/* ---------- the strip ---------- */
// What a strip card or a scoreboard row needs from a game or a quick score: status, score, line score, stats.
function summary(x){
  if (x.kind === 'score'){
    // Before kickoff a scheduled game shows its day ("Fri 9/18") and no score.
    const fin = x.per === 'final' || x.per === 'ff', pre = x.per === 'pre';
    return {quick:true, fin, pre, ff:x.per === 'ff', live:!pre && !fin, q:{pre:0, half:2, ot:5, final:4, ff:4}[x.per] ?? +x.per,
      status:pre ? x.time || dayShort(gameDay(x)) : QS_STATUS[x.per] || `${x.clk ? x.clk + ' - ' : ''}${ord(+x.per)}`,
      score:{A:+x.A || 0, H:+x.H || 0}, poss:null, lines:null, S:null, men:0};
  }
  const r = replay(x), st = r.st;
  let status, live = false;
  if (st.final) status = st.q > 4 ? 'Final/OT' : 'Final';
  else if (!x.plays.length) status = 'Pregame';
  else {
    live = true;
    const last = x.plays[x.plays.length - 1], c = x.clk;
    if (last.t === 'endq' && st.q === 3) status = 'Halftime';
    else if (st.q > 4) status = perShort(st.q);
    else status = `${c ? mmss(c.run ? c.s - (Date.now() - c.at) / 1000 : c.s) + ' - ' : ''}${ord(st.q)}`;
  }
  return {quick:false, fin:st.final, pre:!x.plays.length && !x.box, live, q:st.q, status, score:st.score, poss:live && st.phase !== 'kick' ? st.poss : null,
    lines:st.lines, qPlayed:st.qPlayed, typed:st.typed, S:r.S, men:rulesOf(x).men};
}
const leadOf = m => m.score.A === m.score.H ? null : m.score.A > m.score.H ? 'A' : 'H';
function scoreCard(x){
  const m = summary(x), T = x.teams, lead = leadOf(m), cur = !m.quick && !!g && x.id === g.id;
  const row = s => `<div class="sc-row${m.fin && lead ? (lead === s ? ' won' : ' lose') : ''}">${markFor(T[s], 20)}<span class="sc-ab">${esc(T[s].abbr || T[s].name)}</span>`
    + `${m.poss === s ? '<i class="sc-ball" title="Has the ball"></i>' : ''}<span class="sc-pts">${m.pre ? '' : m.score[s]}</span><i class="sc-win"></i></div>`;
  const inner = `<div class="sc-st">${esc(m.status)}${m.men === 8 ? '<span class="sc-8">8-man</span>' : ''}</div>${row('A')}${row('H')}`;
  const cls = `sc-game${m.quick ? ' qs' : ''}${cur ? ' cur' : ''}${m.live ? ' live' : ''}`;
  // A game opens once stats are being kept on it; the scorer can always open their own.
  if (!m.quick){
    const title = esc(`${T.A.name} at ${T.H.name}`);
    return x.plays.length || x.box || (!ui.viewer && db.games[x.id]) ? `<a class="${cls}" href="?game=${encodeURIComponent(x.id)}" data-sc="${esc(x.id)}" title="${title}">${inner}</a>`
      : `<div class="${cls}" title="${title}">${inner}</div>`;
  }
  // A quick score: the scorer taps it to update; for fans there's no game behind it to open.
  const title = esc(`${T.A.name} at ${T.H.name} · score updated ${new Date(x.updated).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}`);
  return ui.viewer ? `<div class="${cls}" title="${title}">${inner}</div>` : `<a class="${cls}" href="#" role="button" data-qs="${esc(x.id)}" title="${title}">${inner}</a>`;
}
const chev = d => `<svg width="10" height="18" viewBox="0 0 10 18" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
// The menu bar under the strip: underline the page you're on. Game Tracker is the scorer's page, which opens the
// last game kept on this device.
(function markNav(){
  const q = new URLSearchParams(location.search);
  // The site's plain address is Home; the Game Tracker is ?tracker (or ?edit=<id>).
  const here = q.has('tracker') || q.has('edit') ? 'tracker'
    : q.has('avctl') ? 'avscores' : q.has('standings') ? 'standings' : q.has('avstats') ? 'avstats'
    : q.has('scores') ? 'scores' : q.has('state') ? 'state' : q.has('statestats') ? 'sstats'
    : q.has('stats') ? 'stats' : q.has('team') || q.has('teams') ? 'teams' : q.has('game') || q.has('live') ? '' : 'home';
  // Each menu's pages sit under its own name: Butler County, AVCTL, State.
  const UNDER = {scores:'buco', stats:'buco', teams:'buco', avscores:'avctl', standings:'avctl', avstats:'avctl', state:'state', sstats:'state'};
  const top = UNDER[here] || here;
  const a = top && document.querySelector(`.navlink[data-nav="${top}"]`);
  if (a){
    a.classList.add('on'); if (a.tagName === 'A') a.setAttribute('aria-current', 'page');
    // On a phone the links scroll sideways: bring this page's link into view.
    const nl = a.parentElement; nl.scrollLeft += a.getBoundingClientRect().left - nl.getBoundingClientRect().left - (nl.clientWidth - a.offsetWidth) / 2;
  }
})();
// Which page of a menu is open, so the menu can mark it.
function menuHere(){
  if (ui.teamPage) return 'teams';
  if (ui.stand) return 'standings';
  if (ui.board) return ui.av ? 'avscores' : ui.state ? 'state' : 'scores';
  if (ui.county){
    if (STATE_STATS) return 'sstats';
    const t = county.view === 'team';
    return AV_STATS ? (t ? 'avteam' : 'avstats') : (t ? 'team' : 'stats');
  }
  return '';
}
// The menus: open on hover with a mouse, on a tap on a phone, and mark the page you're on. Opening one closes the rest.
(function navMenus(){
  const bar = document.querySelector('.navbar'); if (!bar) return;
  const shut = [];
  document.querySelectorAll('.navdrop').forEach(btn => {
  const menu = document.getElementById(btn.getAttribute('aria-controls'));
  if (!menu) return;
  const hover = matchMedia('(hover: hover)').matches;
  let t = 0;
  const close = () => { clearTimeout(t); menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  shut.push(close);
  const open = () => {
    clearTimeout(t);
    if (!menu.hidden) return;
    shut.forEach(f => { if (f !== close) f(); });
    const cur = menuHere();
    menu.querySelectorAll('[data-menu]').forEach(x => x.classList.toggle('on', x.dataset.menu === cur));
    menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
    // Under the name and on screen, with the notch pointing up at the name.
    const b = btn.getBoundingClientRect(), r = bar.getBoundingClientRect();
    const left = Math.max(8, Math.min(b.left - r.left, r.width - menu.offsetWidth - 8));
    menu.style.left = `${left}px`;
    menu.style.setProperty('--notch', `${b.left - r.left + b.width / 2 - left - 8}px`);
  };
  btn.addEventListener('click', e => { e.stopPropagation(); if (hover || menu.hidden) open(); else close(); });
  if (hover) [btn, menu].forEach(el => { el.addEventListener('mouseenter', open); el.addEventListener('mouseleave', () => { clearTimeout(t); t = setTimeout(close, 200); }); });
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  btn.parentElement.addEventListener('scroll', close, {passive:true});
  addEventListener('resize', close);
  });
})();

function renderScores(){
  const box = $('#scores'); if (!box) return;
  const key = shownWeek(); watchWeek(key);
  const games = weekGames(key);
  // The scorer always gets the strip, for its Add a score button; fans only when there's something to show.
  const any = !ui.viewer || games.length > 0;
  box.hidden = !any;
  if (!any) return;
  const old = box.querySelector('.sc-list'), keep = old ? old.scrollLeft : 0;
  box.innerHTML = `<div class="scores-in">
    <div class="sc-wk"><select id="scweek" aria-label="Week">${weekOptions(key).map(k => `<option value="${k}"${k === key ? ' selected' : ''}>${esc(weekLabel(k))}</option>`).join('')}</select></div>
    <div class="sc-wrap"><div class="sc-list">${games.length ? games.map(scoreCard).join('') : `<div class="sc-empty">No games for ${esc(weekLabel(key))} yet.</div>`}</div>
      <button type="button" class="sc-arrow l" data-scroll="-1" aria-label="Earlier games" hidden>${chev('M9 1L1 9l8 8')}</button>
      <button type="button" class="sc-arrow r" data-scroll="1" aria-label="More games" hidden>${chev('M1 1l8 8-8 8')}</button></div>
    <a class="sc-full" href="?scores=${key}">Full Scoreboard »</a>
    ${ui.viewer ? '' : `<button type="button" class="sc-add" data-qs-new aria-label="Add a score from another game"><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M9 2v14M2 9h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Score</span></button>`}</div>`;
  const sel = box.querySelector('#scweek');
  fitSelect(sel); sel.addEventListener('change', () => fitSelect(sel));
  const list = box.querySelector('.sc-list');
  // A redraw keeps the strip where it was; a new week brings the open game into view.
  if (scores.seen === key) list.scrollLeft = keep;
  else { scores.seen = key; const c = list.querySelector('.sc-game.cur'); if (c) list.scrollLeft = Math.max(0, c.offsetLeft - (list.clientWidth - c.offsetWidth) / 2); }
  list.addEventListener('scroll', scoreArrows, {passive:true});
  scoreArrows();
  tickerSetup(list);
}

/* ---------- the scores strip scrolls itself like a ticker, and stops while someone's over it ---------- */
const TICK_PX = 28;                                    // pixels a second: about one game every 6-7 seconds
const ticker = {raf:0, last:0, pos:0, until:0};
// Off while we see whether the constant scrolling was costing anything: it writes scrollLeft every animation
// frame and doubles the cards in the strip to loop them. Set TICKER_ON back to true to bring it back.
const TICKER_ON = false;
function tickerSetup(list){
  if (!TICKER_ON) return;
  if (!list || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (list.scrollWidth <= list.clientWidth + 24) return;          // everything fits: nothing to scroll
  // A second copy of the cards right after the first, so it loops without jumping back. Screen readers and
  // the Tab key skip the copies.
  [...list.children].forEach(c => {
    const d = c.cloneNode(true);
    d.classList.add('sc-dup'); d.setAttribute('aria-hidden', 'true'); d.setAttribute('tabindex', '-1');
    list.appendChild(d);
  });
  ticker.pos = list.scrollLeft;
  // A swipe or a wheel nudge takes over for a few seconds.
  const pause = () => { ticker.until = Date.now() + 4000; };
  list.addEventListener('touchstart', pause, {passive:true});
  list.addEventListener('wheel', pause, {passive:true});
  if (!ticker.raf) ticker.raf = requestAnimationFrame(tickerStep);
}
function tickerStep(t){
  ticker.raf = requestAnimationFrame(tickerStep);
  const dt = ticker.last ? Math.min(100, t - ticker.last) : 0; ticker.last = t;
  const list = $('#scores .sc-list'), dup = list && list.querySelector('.sc-dup');
  if (!dup) return;
  const wrap = list.parentElement, sel = $('#scweek');
  // Held: the mouse is over it, something in it has focus, the week picker is open, the tab is hidden, or a swipe just happened.
  if (wrap.matches(':hover') || wrap.contains(document.activeElement) || document.activeElement === sel || document.hidden || Date.now() < ticker.until){
    ticker.pos = list.scrollLeft; return;
  }
  const loop = dup.offsetLeft - list.firstElementChild.offsetLeft;   // one full set of games
  ticker.pos += TICK_PX * dt / 1000;
  if (ticker.pos >= loop) ticker.pos -= loop;
  list.scrollLeft = ticker.pos;                                       // kept as a fraction in pos, so slow speeds still move
}
// The week picker only as wide as the week showing ("Week 2"), not its longest choice ("State Championship").
function fitSelect(sel){
  if (!sel || !sel.options.length) return;
  const c = getComputedStyle(sel), cv = fitSelect.cv || (fitSelect.cv = document.createElement('canvas')), ctx = cv.getContext('2d');
  ctx.font = `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`;
  const px = k => parseFloat(c[k]) || 0;
  sel.style.width = Math.ceil(ctx.measureText(sel.options[sel.selectedIndex].text).width
    + px('paddingLeft') + px('paddingRight') + px('borderLeftWidth') + px('borderRightWidth') + 2) + 'px';
}
function scoreArrows(){
  const box = $('#scores'), list = box && box.querySelector('.sc-list'); if (!list) return;
  const max = list.scrollWidth - list.clientWidth;
  box.querySelector('.sc-arrow.l').hidden = list.scrollLeft < 4;
  box.querySelector('.sc-arrow.r').hidden = list.scrollLeft > max - 4;
}
addEventListener('resize', scoreArrows);

document.addEventListener('click', e => {
  const t = e.target; if (!t.closest) return;
  const b = t.closest('[data-scroll]');
  if (b){ const list = $('#scores .sc-list'); if (list) list.scrollBy({left:+b.dataset.scroll * list.clientWidth * .8, behavior:'smooth'}); return; }
  if (!ui.viewer){
    // Quick scores: open, pick the status, save, delete.
    const q = t.closest('[data-qs]');
    if (q){ e.preventDefault(); ui.qsId = q.dataset.qs; return openDialog('score'); }
    if (t.closest('[data-qs-new]')){ ui.qsId = null; return openDialog('score'); }
    // Start a stat game from a scheduled game or quick score: Setup opens with its schools and date.
    const ks = t.closest('[data-qs-stats]');
    if (ks){ ui.fromSched = ks.dataset.qsStats; return openDialog('new'); }
    const per = t.closest('[data-qs-per]');
    if (per){
      per.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === per)));
      const v = per.dataset.qsPer;
      $('#qs-clk').closest('.fld').hidden = !inQuarter(v);
      const ffNote = $('#qs-ff'); if (ffNote) ffNote.hidden = v !== 'ff';
      if (v === 'ff'){
        const a = $('#qs-A-pts'), h = $('#qs-H-pts');
        if (!(+a.value) && !(+h.value)){ a.value = String(FORFEIT); h.value = '0'; }
      }
      return;
    }
    const sv = t.closest('[data-qs-save]');
    if (sv) return saveScore(sv.dataset.qsSave);
    const del = t.closest('[data-qs-del]');
    if (del){
      const id = del.dataset.qsDel;
      if (ui.confirm !== 'qs:' + id){ ui.confirm = 'qs:' + id; del.textContent = 'Tap again to delete'; return; }
      ui.confirm = null; return deleteScore(id);
    }
  }
  const a = t.closest('a.sc-game');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (ui.viewer && a.classList.contains('cur')){ e.preventDefault(); return; }
  // Every game opens its own page, with its own link: for fans always, and for the scorer once it's finished (or a
  // box score). The scorer's own game still being played opens right here, to keep scoring it.
  const x = !ui.viewer && db.games[a.dataset.sc];
  if (!x || x.box || replay(x).st.final) return;
  e.preventDefault();
  if (a.classList.contains('cur')) return;
  g = x; resetUi(); setCurrent(); refresh();
});
document.addEventListener('change', e => {
  if (e.target.id !== 'scweek') return;
  ui.week = e.target.value; renderScores();
  // On the scoreboard page the page below follows the strip to that week.
  if (ui.board){ history.replaceState(null, '', `?${boardParam()}=${ui.week}`); renderScoreboard(); }
});
// Tapping a score clears it for the new one, with the old one showing faintly; leave it blank to keep it.
// (Selecting the text instead is unreliable on phones, where lifting the finger drops the selection.)
const isQsPts = el => /^qs-[AH]-pts$/.test(el.id || '');
document.addEventListener('focusin', e => { const el = e.target; if (!isQsPts(el) || el.value === '') return; el.dataset.was = el.value; el.placeholder = el.value; el.value = ''; });
document.addEventListener('focusout', e => { const el = e.target; if (isQsPts(el) && el.value.trim() === '' && el.dataset.was) el.value = el.dataset.was; });
// Live games' clocks keep moving between plays.
setInterval(() => {
  const box = $('#scores');
  if (!box || box.hidden || document.hidden || (document.activeElement && document.activeElement.id === 'scweek')) return;
  if (box.querySelector('.sc-game.live')) renderScores();
}, 5000);
