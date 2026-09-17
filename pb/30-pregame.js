/* ================================================================
   Pregame (?preview=<game id>): what a game looks like before anyone
   starts keeping stats on it. Both schools with their records and
   Media Rankings, a matchup predictor, each team's season leaders, its
   last five games and its league standings. Once the tracker starts the
   game, the page points to the gamecast.
   ================================================================ */
const PREVIEW_ID = new URLSearchParams(location.search).get('preview');
const pre = {meet:{}, rank:null, stats:null, err:'', hist:{}, rat:null, ratIdx:{}};

// The Media Rankings live in their own database (kansasmediarankings.com). Only published weeks are read, and
// the points are tallied the way that site does: 10 for a first-place vote down to 1 for tenth (5 in 6-Man).
const RANK_FIREBASE = {apiKey:'AIzaSyBTiNraruWtESR_ioYAEM4QaxkqBYY3ZAg', authDomain:'ks-football-poll.firebaseapp.com', projectId:'ks-football-poll',
  appId:'1:359451879003:web:36df8102763cfab727817e'};
const RANK_CLASS = {'6A':'6A', '5A':'5A', '4A':'4A', '3A':'3A', '2A':'2A', '1A':'1A', '8M-I':'8-Man I', '8M-II':'8-Man II', '6M':'6-Man'};
async function loadRankings(classes){
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-`;
  const [appM, fsM] = await Promise.all([import(base + 'app.js'), import(base + 'firestore.js')]);
  const app = appM.getApps().find(a => a.name === 'rankings') || appM.initializeApp(RANK_FIREBASE, 'rankings');
  const db = fsM.getFirestore(app);
  const settings = await fsM.getDoc(fsM.doc(db, 'meta', 'settings'));
  const weeks = (settings.exists() && settings.data().weeks) || [];
  let week = null;
  for (let i = weeks.length - 1; i >= 0; i--){
    const r = await fsM.getDoc(fsM.doc(db, 'releases', weeks[i]));
    if (r.exists() && r.data().released){ week = weeks[i]; break; }
  }
  const out = {week, byClass:{}};
  if (!week) return out;
  await Promise.all([...new Set(classes)].filter(Boolean).map(async cls => {
    const snap = await fsM.getDocs(fsM.collection(db, 'polls', `${week}__${cls}`, 'entries'));
    const count = cls === '6-Man' ? 5 : 10, points = {}, first = {};
    snap.forEach(d => (d.data().rankings || []).forEach((school, i) => {
      if (!school) return;
      points[school] = (points[school] || 0) + (count - i);
      if (i === 0) first[school] = (first[school] || 0) + 1;
    }));
    const rows = Object.keys(points).map(school => ({school, pts:points[school], fpv:first[school] || 0}))
      .sort((a, b) => b.pts - a.pts || b.fpv - a.fpv || a.school.localeCompare(b.school));
    let rank = 0;
    rows.forEach((r, i) => { if (!i || r.pts !== rows[i - 1].pts || r.fpv !== rows[i - 1].fpv) rank = i + 1; r.rank = rank; });
    out.byClass[cls] = {rows, ballots:snap.size, top:count};
  }));
  return out;
}
// A school's place in its class: {rank, pts, top} (ranked) or {votes, pts} (receiving votes), or null.
function rankOf(name){
  // The poll's own class list first: a school this site doesn't carry a class for still gets its ranking.
  const info = schoolInfo(name), cls = rankClassOf(name) || (info && RANK_CLASS[info[0]]);
  const c = cls && pre.rank && pre.rank.byClass[cls]; if (!c) return null;
  const k = canonSchool(name), row = c.rows.find(r => canonSchool(r.school) === k);
  if (!row) return null;
  return row.rank <= c.top ? {rank:row.rank, pts:row.pts, cls} : {votes:true, pts:row.pts, cls};
}

/* ---------- this site's own line, from ratings.json (.github/kp/ratings.py) ----------
   Every Kansas result since 2021 is fitted at once: each school's offense and defense in points, plus home
   field. A game's line is simply what the two are expected to score. Nothing here is a bet. */
function loadRatings(){
  if (pre.rat !== null) return;
  pre.rat = false;
  fetch('/ratings.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null)
    .then(d => { if (d && d.teams){ pre.rat = d; renderPreview(); } }).catch(() => {});
}
// The ratings are keyed the way KPreps writes a school ("towanda-circle"); match ours to them once each.
function ratingOf(name){
  const k = canonSchool(name); if (!k || !pre.rat) return null;
  if (pre.ratIdx[k] !== undefined) return pre.ratIdx[k];
  let hit = pre.rat.teams[k] ? k : null;
  if (!hit){
    let best = 0;
    Object.keys(pre.rat.teams).forEach(s => {
      const score = schoolLikeness(name, s.replace(/-/g, ' '));
      if (score > best && score >= .7){ best = score; hit = s; }
    });
  }
  pre.ratIdx[k] = hit ? Object.assign({slug:hit}, pre.rat.teams[hit]) : null;
  return pre.ratIdx[k];
}
// What each side is expected to score, home team first.
function ourLine(A, H){
  const a = ratingOf(A), h = ratingOf(H);
  if (!a || !h || a.group !== h.group) return null;
  const g = pre.rat.groups[h.group] || {mu:26, hfa:1.5};
  const hp = g.mu + h.off + a.def + g.hfa / 2, ap = g.mu + a.off + h.def - g.hfa / 2;
  const round1 = v => Math.round(v * 2) / 2;
  return {home:hp, away:ap, spread:round1(hp - ap), total:round1(hp + ap), hs:Math.round(hp), as:Math.round(ap), thin:Math.min(a.gp, h.gp) < 6};
}

/* ---------- past seasons, from KPreps by way of history/<school>.json (.github/kphistory.py) ---------- */
// The files are named the way KPreps writes a school, so try our spelling first and then theirs.
function fetchHistory(name, done){
  const tries = [logoSlug(name)], r = typeof ratingOf === 'function' ? ratingOf(name) : null;
  if (r && r.slug && !tries.includes(r.slug)) tries.push(r.slug);
  (function next(i){
    if (i >= tries.length) return done(false);
    fetch(`/history/${tries[i]}.json`, {cache:'no-cache'}).then(x => x.ok ? x.json() : null)
      .then(d => d ? done(d) : next(i + 1)).catch(() => next(i + 1));
  })(0);
}
// Older meetings, from kansashsfootballhistory.com by way of .github/khsfh: one file a school, keyed by
// our slugs. No dates and no sides in that archive, so these rows carry the year and the score only.
function loadMeetings(name){
  const k = logoSlug(name); if (!k || pre.meet[k] !== undefined) return;
  pre.meet[k] = null;
  const tries = [k], r = typeof ratingOf === 'function' ? ratingOf(name) : null;
  if (r && r.slug && !tries.includes(r.slug)) tries.push(r.slug);
  (function next(i){
    if (i >= tries.length){ pre.meet[k] = false; return renderPreview(); }
    fetch(`/meetings/${tries[i]}.json`, {cache:'no-cache'}).then(x => x.ok ? x.json() : null)
      .then(d => { if (!d) return next(i + 1); pre.meet[k] = d; renderPreview(); }).catch(() => next(i + 1));
  })(0);
}
function loadHistory(name){
  const k = logoSlug(name); if (!k || pre.hist[k] !== undefined) return;
  pre.hist[k] = null;
  fetchHistory(name, d => { pre.hist[k] = d || false; renderPreview(); });
}
// How a school has done over the seasons on file: wins, losses and points, for the predictor's longer view.
function fiveYear(name){
  const f = pre.hist[logoSlug(name)];
  if (!f || !f.seasons) return null;
  const r = {w:0, l:0, t:0, pf:0, pa:0, gp:0, years:0};
  Object.values(f.seasons).forEach(s => {
    let played = 0;
    (s.games || []).forEach(g => { if (g.us == null) return; played++;
      r.gp++; r.pf += g.us; r.pa += g.them; r[g.us > g.them ? 'w' : g.us < g.them ? 'l' : 't']++; });
    if (played) r.years++;
  });
  return r.gp ? r : null;
}

// Every meeting between two schools in the seasons on file, newest first, told from the first school's side.
const ratingSlug = n => { const r = typeof ratingOf === 'function' ? ratingOf(n) : null; return (r && r.slug) || logoSlug(n); };
function pastMeetings(a, b){
  const want = canonSchool(b), out = [], seen = new Set();
  const take = (file, flip) => {
    if (!file || !file.seasons) return;
    Object.entries(file.seasons).forEach(([year, s]) => (s.games || []).forEach(g => {
      if (g.us == null || canonSchool(g.opp) !== (flip ? canonSchool(a) : want)) return;
      const key = `${year}|${g.date}`; if (seen.has(key)) return; seen.add(key);
      out.push({year:+year, date:g.date, ot:g.ot,
        us:flip ? g.them : g.us, them:flip ? g.us : g.them,
        at:flip ? (g.at === 'home' ? 'away' : g.at === 'away' ? 'home' : g.at) : g.at});
    }));
  };
  take(pre.hist[logoSlug(a)], false);
  take(pre.hist[logoSlug(b)], true);
  // Before those seasons: the archive's rows, in whichever school's file they turn up.
  const older = (file, other, flip) => {
    const rows = file && file.opp && file.opp[other]; if (!rows) return;
    rows.forEach(([year, us, them, note]) => {
      const key = `${year}|old`; if (seen.has(key)) return; seen.add(key);
      out.push({year:+year, date:'', ot:/ot$/.test(note || ''), old:true,
        us:flip ? them : us, them:flip ? us : them, at:''});
    });
  };
  const slugA = ratingSlug(a), slugB = ratingSlug(b);
  if (slugB) older(pre.meet[logoSlug(a)], slugB, false);
  if (slugA) older(pre.meet[logoSlug(b)], slugA, true);
  return out.sort((x, y) => y.year - x.year || (y.date || '').localeCompare(x.date || ''));
}

/* ---------- the numbers behind the page ---------- */
function teamSeason(name){
  const r = {gp:0, w:0, l:0, t:0, pf:0, pa:0, last:[], opps:[]};
  schoolRows(name).forEach(row => {
    const f = finalOf(row.x); if (!f.fin) return;
    const us = f.score[row.side], them = f.score[row.opp];
    r.gp++; r.pf += us; r.pa += them; r[us > them ? 'w' : us < them ? 'l' : 't']++;
    r.last.push({row, us, them});
    r.opps.push(row.x.teams[row.opp].name);
  });
  r.last = r.last.sort((a, b) => gameDay(b.row.x) - gameDay(a.row.x)).slice(0, 5);
  return r;
}
// The predictor, in points: who's better and by how much, from what the site knows. Each part is spelled out on
// the page. Past meetings join it once the earlier seasons are loaded.
// Class sizes, for the one line of the predictor that uses them. A school on the bump list is never
// punished for playing up: in those games the class line reads even, whichever way it falls.
const CLASS_STEP = {'6A':6, '5A':5, '4A':4, '3A':3, '2A':2, '1A':1, '8M-I':0, '8M-II':-.5, '6M':-1};
const bumpSchool = n => { const r = ratingOf(n); return !!(r && r.bump); };
function predict(A, H){
  const side = n => {
    const s = teamSeason(n), g = s.w + s.l + s.t;
    const wp = (s.w + s.t / 2 + 1) / (g + 2);                  // a record, pulled toward .500 while it's short
    const margin = s.gp ? (s.pf - s.pa) / s.gp : 0;
    const info = schoolInfo(n), rk = rankOf(n);
    const cls = info ? CLASS_STEP[info[0]] : CLASS_STEP[({'8-Man I':'8M-I', '8-Man II':'8M-II', '6-Man':'6M'}[rankClassOf(n)]) || rankClassOf(n)];
    const five = fiveYear(n), fwp = five ? (five.w + five.t / 2 + 2) / (five.gp + 4) : null;
    // Who they've played: the average rating of the schools on the schedule so far. Beating a team that
    // hasn't won in two years isn't the same as beating a good one, and this is where that shows up.
    const seen = s.opps.map(o => ratingOf(o)).filter(Boolean).map(o => o.rating);
    const sos = seen.length ? seen.reduce((t, v) => t + v, 0) / seen.length : null;
    return {s, wp, margin, sos, five, fwp, cls:cls == null ? null : cls, bonus:rk ? (rk.rank ? (11 - rk.rank) * 1.2 : 1) : 0, rk};
  };
  const a = side(A), h = side(H);
  // Past meetings: the average margin of the games on file, counted lightly and never worth more than a touchdown.
  const met = pastMeetings(A, H), hh = met.length ? met.reduce((t, m) => t + (m.them - m.us), 0) / met.length : 0;
  const parts = [
    ['Scoring margin', Math.max(-12, Math.min(12, .4 * (h.margin - a.margin)))],
    // Who they beat, not just by how much: the two rows together are the margin with the schedule taken out.
    // Early in the year two games say little about a schedule, so it counts for less until more are played.
    ['Schedule faced', a.sos != null && h.sos != null
      ? Math.max(-8, Math.min(8, .4 * (h.sos - a.sos) * (g5 => g5 / (g5 + 2))(Math.min(a.s.gp, h.s.gp)))) : 0],
    ['Record', 14 * (h.wp - a.wp)],
    ['Media Rankings', h.bonus - a.bonus],
    ['Class', a.cls != null && h.cls != null && !bumpSchool(A) && !bumpSchool(H) ? 3.5 * (h.cls - a.cls) : 0],
    ['Past meetings', Math.max(-7, Math.min(7, .35 * hh))],
    // The last five seasons, when both schools have them on file: how good these programs have been, counted lightly.
    ['Last 5 seasons', a.fwp != null && h.fwp != null ? Math.max(-6, Math.min(6, 12 * (h.fwp - a.fwp))) : 0],
    ['Home field', 2.5]];
  const pts = parts.reduce((t, p) => t + p[1], 0);
  const home = Math.min(.97, Math.max(.03, 1 / (1 + Math.exp(-pts / 8))));
  return {home, away:1 - home, pts, parts, a, h};
}
// Season leaders, from the same games the stats pages use: the file, plus every game saved since it was built.
function seasonLeaders(name){
  const k = canonSchool(name), pl = {};
  (typeof countyGames === 'function' ? countyGames() : []).forEach(x => {
    const n = gameNumbers(x); if (!n) return;
    ['A', 'H'].forEach(s => {
      const T = n[s]; if (!T || canonSchool(T.name) !== k) return;
      (T.pl || []).forEach(p => { const o = pl[p.name] || (pl[p.name] = {name:p.name}); C_KEYS.forEach(c => { if (p[c]) o[c] = (o[c] || 0) + p[c]; }); });
    });
  });
  const best = key => Object.values(pl).filter(p => p[key] > 0).sort((a, b) => b[key] - a[key])[0] || null;
  return {pass:best('py'), rush:best('ry'), rec:best('rey')};
}

const shortPlayer = n => { const w = playerName(n).split(/\s+/); return w.length > 1 ? `${w[0][0]}. ${w.slice(1).join(' ')}` : w[0]; };

/* ---------- the page ---------- */
async function startPreview(id){
  ui.viewer = true; ui.preview = true; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  loadLogos(); loadRatings(); renderPreview();
  try {
    const api = await viewerApi();
    scoresReady({fsM:api.fsM, fsdb:api.fsdb});   // the scores strip, every shared game and the records
    loadStats({fsM:api.fsM, fsdb:api.fsdb});     // the season's stats: the file, then anything saved since
  } catch (e) { pre.err = 'Can’t reach the games. Check your connection and reload.'; renderPreview(); }
  // The rankings wait for the game (they need its schools' classes).
  const wait = setInterval(() => {
    const x = previewGame(); if (!x) return;
    clearInterval(wait);
    ['A', 'H'].forEach(s => { loadHistory(x.teams[s].name); loadMeetings(x.teams[s].name); });
    const classes = ['A', 'H'].map(s => { const n = x.teams[s].name, i = schoolInfo(n); return rankClassOf(n) || (i && RANK_CLASS[i[0]]); });
    loadRankings(classes).then(r => { pre.rank = r; renderPreview(); }).catch(() => { pre.rank = {week:null, byClass:{}}; renderPreview(); });
  }, 300);
}
function previewGame(){
  const x = (allGames.list || []).find(g => g.id === PREVIEW_ID) || (scores.docs && scores.docs[PREVIEW_ID]);
  return x && x.teams && x.teams.A && x.teams.H ? x : null;
}
function renderPreview(){
  if (!ui.preview) return;
  $('#board').innerHTML = previewHtml();
}
function previewHtml(){
  const x = previewGame();
  if (!x) return `<section class="bcard"><p class="bempty">${esc(pre.err || (allGames.list ? 'That game isn’t on the site.' : 'Loading the game…'))}</p></section>`;
  const T = x.teams, A = T.A.name, H = T.H.name;
  document.title = `${A} at ${H} · Preview · Kansas Media Stats`;
  const P = predict(A, H), day = gameDay(x);
  const when = `${day.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'})}`;
  const time = '7:00 PM';   // every Kansas game kicks off at 7 p.m.; a listing that says otherwise is ignored
  // A game someone is keeping stats on. Once the first play is in, a shared preview link becomes the gamecast
  // on its own — nobody has to send the link again.
  const pair = [A, H].map(canonSchool).sort().join('|');
  const tracked = [...Object.values(scores.docs || {}), ...(allGames.list || [])]
    .filter(g => g && g.teams && g.kind !== 'score' && g.id !== x.id && gameWeek(g) === gameWeek(x)
      && [g.teams.A.name, g.teams.H.name].map(canonSchool).sort().join('|') === pair);
  const live = tracked.find(g => (g.plays && g.plays.length) || g.box || g.stats);
  if (live && !pre.went){ pre.went = true; location.replace(`?game=${encodeURIComponent(live.id)}`); }
  const soon = !live && tracked[0];
  const recLine = n => { const r = shownRecord(n), info = schoolInfo(n); return [r && r.rec, info && info[1]].filter(Boolean).join(' · '); };
  const rankTag = n => { const r = rankOf(n); return r && r.rank ? `<span class="pg-rank">${r.rank}</span>` : ''; };
  const head = `<section class="bcard pg-head">
      <div class="pg-team">${markFor(T.A, 64)}<div><div class="pg-name">${rankTag(A)}<a class="tlink" href="?team=${encodeURIComponent(A)}">${esc(A)}</a></div><div class="pg-sub">${esc(recLine(A))}</div></div></div>
      <div class="pg-when"><b>${esc(when)}</b><span>${esc(time)}</span><span class="pg-at">at ${esc(H)}</span></div>
      <div class="pg-team h"><div><div class="pg-name">${rankTag(H)}<a class="tlink" href="?team=${encodeURIComponent(H)}">${esc(H)}</a></div><div class="pg-sub">${esc(recLine(H))}</div></div>${markFor(T.H, 64)}</div>
    </section>
    ${live ? `<section class="bcard pg-live"><b>This game has started.</b> <a class="bbtn" href="?game=${encodeURIComponent(live.id)}">Watch the gamecast</a></section>`
      : soon ? `<section class="bcard pg-live"><b>Someone is set to keep stats on this game.</b> This page turns into the gamecast on the first play.</section>` : ''}`;

  // Matchup predictor: a ring split between the two schools.
  const pctA = Math.round(P.away * 1000) / 10, pctH = Math.round(P.home * 1000) / 10;
  const R = 70, C = 2 * Math.PI * R, fav = P.pts >= 0 ? H : A;
  const colorA = T.A.color && T.A.color !== '#4A4B4D' ? T.A.color : '#2B2C2D', colorH = T.H.color && T.H.color !== '#4A4B4D' ? T.H.color : '#A5A6A7';
  const ring = `<svg class="pg-ring" viewBox="0 0 180 180" role="img" aria-label="${esc(A)} ${pctA} percent, ${esc(H)} ${pctH} percent">
      <circle cx="90" cy="90" r="${R}" fill="none" stroke="${esc(colorH)}" stroke-width="16"/>
      <circle cx="90" cy="90" r="${R}" fill="none" stroke="${esc(colorA)}" stroke-width="16" stroke-dasharray="${(P.away * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 90 90) scale(1 -1) translate(0 -180)"/>
    </svg>`;
  const partRows = P.parts.map(([k, v]) => `<tr><td>${k}</td><td class="num">${Math.abs(v) < .05 ? 'even' : `${esc(v > 0 ? H : A)} +${Math.abs(v).toFixed(1)}`}</td></tr>`).join('');
  const predictor = `<section class="bcard pg-card"><h2 class="pg-h">Matchup predictor</h2>
      <div class="pg-pred"><div class="pg-pct"><b>${pctA}%</b><span>${esc(T.A.abbr || shortName(A))}</span></div>
        <div class="pg-ringwrap">${ring}<div class="pg-marks">${markFor(T.A, 34)}${markFor(T.H, 34)}</div></div>
        <div class="pg-pct r"><b>${pctH}%</b><span>${esc(T.H.abbr || shortName(H))}</span></div></div>
      <details class="pg-how"><summary>How it’s figured</summary>
        <table class="pg-parts">${partRows}</table></details>
    </section>`;

  const info = n => { const i = schoolInfo(n); return i ? `Class ${i[0].replace('8M-', '8-Man ').replace('6M', '6-Man')} · ${i[1]}` : ''; };
  const gameInfo = `<section class="bcard pg-card"><h2 class="pg-h">Game information</h2>
      <div class="pg-info"><b>${esc(time)}, ${esc(day.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'}))}</b><span>At ${esc(H)}</span></div>
      ${[A, H].map(n => info(n) ? `<div class="pg-info"><b>${esc(n)}</b><span>${esc(info(n))}</span></div>` : '').join('')}
    </section>`;

  // The line: the site's own, from every Kansas result since 2021.
  const OL = ourLine(A, H);
  const oddsRow = (s, n) => {
    const ourSpread = !OL ? '&#8212;' : OL.spread === 0 ? 'PK' : (s === 'H') === (OL.spread > 0) ? `&#8722;${Math.abs(OL.spread)}` : `+${Math.abs(OL.spread)}`;
    return `<tr><td><div class="pg-oteam">${markFor(T[s], 22)}<b>${esc(T[s].abbr || shortName(n))}</b></div></td>
      <td class="num">${ourSpread}</td><td class="num">${OL ? `${s === 'A' ? 'o' : 'u'}${OL.total}` : '&#8212;'}</td></tr>`;
  };
  const odds = `<section class="bcard pg-card"><h2 class="pg-h">Game line</h2>
      <div class="pg-tbl"><table class="ctbl pg-odds"><thead><tr><th></th><th class="num">Spread</th><th class="num">Total</th></tr></thead><tbody>
        ${oddsRow('A', A)}${oddsRow('H', H)}</tbody></table></div>
      ${OL ? `<p class="hint">${OL.thin ? 'One of these teams has few games on file, so treat this lightly. ' : ''}For fun only: there's no betting here.</p>`
        : `<p class="hint">No line for this game yet: the ratings don't have both schools.</p>`}
    </section>`;

  // Season leaders, the two teams side by side.
  const LA = seasonLeaders(A), LH = seasonLeaders(H);
  const line = (p, k) => !p ? '' : k === 'pass' ? `${p.pc || 0}/${p.pa || 0}, ${p.ptd || 0} TD${p.pint ? `, ${p.pint} INT` : ''}` : k === 'rush' ? `${p.ru || 0} CAR, ${p.rtd || 0} TD` : `${p.re || 0} REC, ${p.retd || 0} TD`;
  const who = (p, key, right) => `<div class="pg-who${right ? ' r' : ''}"><b>${p ? esc(shortPlayer(p.name)) : 'No stats yet'}</b>${p ? `<span>${esc(line(p, key))}</span>` : ''}</div>`;
  const leadRow = (label, key, stat) => {
    const a = LA[key], h = LH[key];
    return `<div class="pg-lrow">${who(a, key)}<b class="num pg-n">${a ? a[stat] : '&#8212;'}</b><span class="pg-l">${label}</span><b class="num pg-n">${h ? h[stat] : '&#8212;'}</b>${who(h, key, true)}</div>`;
  };
  const noStats = county.games && !LA.pass && !LA.rush && !LA.rec && !LH.pass && !LH.rush && !LH.rec;
  const leaders = `<section class="bcard pg-card"><h2 class="pg-h">Season leaders</h2>
      <div class="pg-lhead"><span>${markFor(T.A, 26)}<b>${esc(T.A.abbr || shortName(A))}</b></span><span><b>${esc(T.H.abbr || shortName(H))}</b>${markFor(T.H, 26)}</span></div>
      <div class="pg-leaders">${!county.games ? '<p class="bempty">Loading the stats…</p>' : noStats ? '<p class="bempty">Neither team has stats on the site yet.</p>'
        : leadRow('Passing yards', 'pass', 'py') + leadRow('Rushing yards', 'rush', 'ry') + leadRow('Receiving yards', 'rec', 'rey')}</div>
    </section>`;

  // Last five games.
  // Short tags for this table: a name like "Wellington" is squeezed to WELL so the row can't run past the card.
  const tag = x => { const t = String(x || '').trim(); if (t.length <= 5) return t;
    const w = t.replace(/[^A-Za-z ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    return (w.length > 1 ? w.map(y => y[0]).join('').slice(0, 4) : w[0].slice(0, 4)).toUpperCase(); };
  const lastFive = n => {
    const s = teamSeason(n);
    const out = s.last.map(({row, us, them}) => { const o = row.x.teams[row.opp], d = gameDay(row.x);
      return {when:`${d.getMonth() + 1}/${d.getDate()}`, at:row.side, opp:o.name, abbr:tag(o.abbr || shortName(o.name)), mark:markFor(o, 20), us, them};
    });
    // Fewer than five this season: keep going back through the seasons on file.
    const H = pre.hist[logoSlug(n)];
    if (out.length < 5 && H && H.seasons){
      Object.keys(H.seasons).sort((a, b) => b - a).forEach(year => {
        (H.seasons[year].games || []).slice().reverse().forEach(g => {
          if (out.length >= 5 || g.us == null) return;
          const same = out.some(o => canonSchool(o.opp) === canonSchool(g.opp) && o.when === g.date);
          if (same) return;
          const opp = schoolName(g.opp) || g.opp;
          out.push({when:`${g.date}/${year.slice(2)}`, at:g.at === 'away' ? 'A' : 'H', opp, abbr:tag(listAbbr(opp) || shortName(opp)),
            mark:markFor({name:opp, abbr:shortName(opp), color:'#4A4B4D'}, 20), us:g.us, them:g.them, old:true});
        });
      });
    }
    const rows = out.slice(0, 5).map(r => `<tr><td class="num">${esc(r.when)}</td><td><span class="pg-opp">${r.at === 'H' ? 'vs' : '@'} ${r.mark}<a class="tlink" href="?team=${encodeURIComponent(r.opp)}">${esc(r.abbr)}</a></span></td>
        <td class="num"><b class="${r.us > r.them ? 'pg-w' : r.us < r.them ? 'pg-lo' : ''}">${r.us > r.them ? 'W' : r.us < r.them ? 'L' : 'T'}</b> ${r.us}-${r.them}</td></tr>`).join('');
    return `<div class="pg-five"><div class="pg-fhead">${markFor({name:n, abbr:shortName(n), color:'#4A4B4D'}, 26)}<b>${esc(n)}</b></div>
      ${rows ? `<div class="pg-tbl"><table class="ctbl"><thead><tr><th>Date</th><th>Opp</th><th class="num">Result</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="bempty">No finals on the site yet.</p>'}</div>`;
  };
  const five = `<section class="bcard pg-card"><h2 class="pg-h">Last five games</h2><div class="pg-fives">${lastFive(A)}${lastFive(H)}</div></section>`;

  // Past meetings, from the seasons on file for the county's schools.
  const met = pastMeetings(A, H), waiting = [A, H].some(n => pre.hist[logoSlug(n)] === null || pre.meet[logoSlug(n)] === null);
  // "2025 · at Augusta · AUG 47, CIR 6": where it was played, then the score with the winner first.
  const ab2 = {A:T.A.abbr || shortName(A), H:T.H.abbr || shortName(H)};
  const metRows = met.slice(0, 6).map(m => {
    const host = m.at === 'home' ? A : m.at === 'away' ? H : '';
    // The older archive records the score and the year, not where it was played.
    const side = s => `${esc(ab2[s])} ${s === 'A' ? m.us : m.them}`;
    const first = m.them > m.us ? side('H') : side('A'), second = m.them > m.us ? side('A') : side('H');
    return `<tr><td class="num">${m.year}</td><td>${host ? `at ${esc(host)}` : m.old ? '&#8212;' : 'neutral site'}</td>
      <td class="num">${first}, ${second}${m.ot ? ' (OT)' : ''}</td></tr>`;
  }).join('');
  const past = met.length || waiting ? `<section class="bcard pg-card"><h2 class="pg-h">Past meetings</h2>
      ${waiting && !met.length ? '<p class="bempty">Loading past seasons…</p>' : `<div class="pg-tbl"><table class="ctbl"><thead><tr><th>Year</th><th>Where</th><th class="num">Final</th></tr></thead><tbody>${metRows}</tbody></table></div>`}
    </section>` : '';

  // Standings: each team's AVCTL division (one table when they share it).
  const divs = [...new Set([A, H].map(avctlDiv).filter(Boolean))];
  const standings = divs.length ? `<section class="bcard pg-card"><h2 class="pg-h">${new Date().getFullYear()} standings</h2>
      ${divs.map(div => `<h3 class="pg-sub-h">AVCTL Division ${div}</h3><div class="pg-tbl"><table class="ctbl pg-st"><thead><tr><th>Team</th><th class="num">League</th><th class="num">Overall</th></tr></thead><tbody>
        ${standingsRows(div).map(o => `<tr class="${[A, H].some(n => canonSchool(n) === canonSchool(o.name)) ? 'pg-us' : ''}"><td><a class="tlink" href="?team=${encodeURIComponent(o.name)}">${esc(o.name)}</a></td>
          <td class="num">${avRec(o.r.dw, o.r.dl, o.r.dt)}</td><td class="num">${esc((o.rec && o.rec.rec) || avRec(o.r.w, o.r.l, o.r.t))}</td></tr>`).join('')}</tbody></table></div>`).join('')}
    </section>` : '';

  // Three columns on a computer, the way a gamecast reads: the predictor and the game's details down the left, the
  // leaders and last games in the middle, the line and standings down the right.
  return `${head}<div class="pg-grid"><div class="pg-col">${predictor}${gameInfo}</div><div class="pg-col pg-mid">${leaders}${five}${past}</div><div class="pg-col">${odds}${standings}</div></div>`;
}
