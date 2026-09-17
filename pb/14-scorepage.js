/* ================================================================
   Scoreboard page (?scores, or ?scores=<week>): every shared game and
   quick score for a week, grouped by day, the way ESPN's scoreboard
   lays it out — line scores and stat leaders on a computer, just the
   scores on a phone. Everyone sees the same page: shared games only.
   That is the BUCO Scoreboard; ?state (or ?state=<week>) is the State
   Scoreboard: the games someone kept stats on, from anywhere, and the
   scheduled games still to come.
   ================================================================ */
const STATE_BOARD = new URLSearchParams(location.search).has('state');
const BOARD = new URLSearchParams(location.search).has('scores') || STATE_BOARD || AV_BOARD;
const boardParam = () => ui.av ? 'avctl' : ui.state ? 'state' : 'scores';
// What each board is called, and which games it keeps.
// A Butler County game: at least one of the county's schools is playing.
const inBuco = x => !!x && !!x.teams && ['A', 'H'].some(s => x.teams[s] && COUNTY.some(n => canonSchool(n) === canonSchool(x.teams[s].name)));
const boardName = () => ui.av ? 'AVCTL' : ui.state ? 'State' : 'BUCO';
const fullyTracked = x => x.kind !== 'score' && ((x.plays && x.plays.length) || !!x.box);
// A game still to come: a schedule entry or score not yet started, or a game set up for stats with no plays yet.
// The State Scoreboard lists those too, until their day has passed; after that, only games with stats stay.
const upcoming = x => {
  const pre = x.kind === 'score' ? x.per === 'pre' : !(x.plays && x.plays.length) && !x.box;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return pre && gameDay(x) >= today;
};
const onStateBoard = x => fullyTracked(x) || upcoming(x);
const SEASON_WEEKS = 13;   // nine regular-season weeks, then regionals, sectionals, sub-state and state
const board = {err:'', seen:null};
const seasonKeys = y => Array.from({length:SEASON_WEEKS}, (_, i) => weekKey(week1(y).getTime() + i * WEEK_MS + 3 * 864e5));
// This week, kept inside the season: before Week 1 it opens Week 1, after the finals the last week.
function boardDefaultWeek(){
  const now = weekKey(Date.now()), n = weekNum(now), keys = seasonKeys(new Date().getFullYear());
  return n < 1 ? keys[0] : n > SEASON_WEEKS ? keys[SEASON_WEEKS - 1] : now;
}
const monShort = d => d.toLocaleDateString('en-US', {month:'short'}).toUpperCase();
// A week's game days, Thursday through Sunday (Week 1 of 2026 is Sept. 3–6). Games still count toward the
// week from its Tuesday to the next Monday, so a make-up game early in the week stays with its Friday.
function weekRange(k){
  const a = fromYmd(k), b = fromYmd(k); a.setDate(a.getDate() + 2); b.setDate(b.getDate() + 5);
  return a.getMonth() === b.getMonth() ? `${monShort(a)} ${a.getDate()} - ${b.getDate()}` : `${monShort(a)} ${a.getDate()} - ${monShort(b)} ${b.getDate()}`;
}

async function startScoreboard(){
  ui.viewer = true; ui.board = true; ui.state = STATE_BOARD; ui.av = AV_BOARD; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  document.title = `${boardName()} Scoreboard · Kansas Media Stats`;
  const want = new URLSearchParams(location.search).get(boardParam()) || '';
  ui.week = /^\d{4}-\d\d-\d\d$/.test(want) ? weekKey(fromYmd(want).getTime()) : boardDefaultWeek();
  loadLogos(); renderScoreboard();
  // The admin's own devices (the Game Tracker marks them at sign-in) sign in here too, for the Hide buttons.
  let admin = false; try { admin = localStorage.getItem('pressbox.admin') === '1'; } catch (e) {}
  try {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-`;
    const [appM, fsM, authM] = await Promise.all(['app', 'firestore', ...(admin ? ['auth'] : [])].map(m => import(base + m + '.js')));
    const app = appM.initializeApp(firebaseConfig);
    if (authM) authM.onAuthStateChanged(authM.getAuth(app), u => { ui.admin = !!u && u.uid === ADMIN_UID; renderScoreboard(); });
    const fsdb = fsM.getFirestore(app);
    scoresReady({fsM, fsdb});
    loadStats({fsM, fsdb});   // season leaders for the games that haven't kicked off
  } catch (e) { board.err = 'Can’t reach the scores. Check your connection and reload.'; renderScoreboard(); }
}

/* ---------- one game ---------- */
// Initial and last name, then the number: "I. Ford #28".
function leaderName(x, s, n){
  if (n === 'team') return 'TEAM';
  // A box score's players are keyed by name and have no number.
  const num = /^\d+$/.test(n), full = playerName(rosterGet(x.teams[s].roster, n, s) || (num ? '' : n));
  if (!full) return `#${n}`;
  const p = full.split(/\s+/);
  return `${p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : full}${num ? ` #${n}` : ''}`;
}
function boardLeaders(x, S){
  // Each team's best in each group, side by side — the visitors first, the way the score reads.
  const best = (s, k) => { let top = null; Object.values(S.pl[s]).forEach(p => { if (p.n !== 'team' && p[k] > 0 && (!top || p[k] > top[k])) top = p; }); return top; };
  const td = (n, w) => n ? `, <b>${n}</b> ${w}` : '';
  return [
    ['Pass', 'py', p => `<b>${p.pc}/${p.pa}</b>, <b>${p.py}</b> YDS${td(p.ptd, 'TD')}${td(p.pint, 'INT')}`],
    ['Rush', 'ry', p => `<b>${p.ru}</b> CAR, <b>${p.ry}</b> YDS${td(p.rtd, 'TD')}`],
    ['Rec', 'rey', p => `<b>${p.re}</b> REC, <b>${p.rey}</b> YDS${td(p.retd, 'TD')}`]
  ].map(([k, key, line]) => {
    const sides = ['A', 'H'].map(s => ({s, p:best(s, key)})).filter(o => o.p);
    if (!sides.length) return '';
    return `<div class="bl"><span class="bl-k">${k}</span><div class="bl-body">${sides.map(o => `<div class="bl-side">
      <div class="bl-who">${esc(leaderName(x, o.s, o.p.n))} <span>- ${esc(x.teams[o.s].abbr)}</span></div>
      <div class="bl-line">${line(o.p)}</div></div>`).join('')}</div></div>`;
  }).join('');
}
// Before kickoff there's no box score to show, so the space beside the line score carries what each team
// has done this season: its passing, rushing and receiving leader.
function preLeaders(x){
  if (typeof seasonLeaders !== 'function' || !(county.games || []).length) return '';
  const L = {A:seasonLeaders(x.teams.A.name), H:seasonLeaders(x.teams.H.name)};
  const td = (n, w) => n ? `, <b>${n}</b> ${w}` : '';
  const rows = [
    ['Pass', 'pass', p => `<b>${p.pc || 0}/${p.pa || 0}</b>, <b>${p.py}</b> YDS${td(p.ptd, 'TD')}${td(p.pint, 'INT')}`],
    ['Rush', 'rush', p => `<b>${p.ru || 0}</b> CAR, <b>${p.ry}</b> YDS${td(p.rtd, 'TD')}`],
    ['Rec', 'rec', p => `<b>${p.re || 0}</b> REC, <b>${p.rey}</b> YDS${td(p.retd, 'TD')}`]
  ].map(([k, key, line]) => {
    const sides = ['A', 'H'].map(s => ({s, p:L[s] && L[s][key]})).filter(o => o.p);
    if (!sides.length) return '';
    return `<div class="bl"><span class="bl-k">${k}</span><div class="bl-body">${sides.map(o => `<div class="bl-side">
      <div class="bl-who">${esc(shortPlayer(o.p.name))} <span>- ${esc(x.teams[o.s].abbr || shortName(x.teams[o.s].name))}</span></div>
      <div class="bl-line">${line(o.p)}</div></div>`).join('')}</div></div>`;
  }).join('');
  return rows ? `<div class="bl-hd">Season leaders</div>${rows}` : '';
}
function boardGame(x){
  const m = summary(x), T = x.teams, lead = leadOf(m), id = encodeURIComponent(x.id);
  // Quarters played so far (every one, once it's final; OT when there was one); a quick score has no line score.
  // Four quarters, plus a column for each overtime the game went to.
  const idx = m.lines ? lineCols({q:m.q, lines:m.lines}) : [];
  const nq = idx.length, played = m.fin ? nq : Math.min(m.q, nq);
  const cells = f => idx.map((i, n) => `<span>${f(i, n)}</span>`).join('');
  const team = s => {
    const cls = m.fin && lead ? (lead === s ? ' won' : ' lose') : '';
    // The record as entered, ESPN style "(1-2, 0-1 Away)"; until then the mascot and Away or Home.
    const rec = recordText(T[s], s, !m.fin, gameWeek(x)), sub = rec ? `(${rec})` : [T[s].mascot, s === 'A' ? 'Away' : 'Home'].filter(Boolean).join(' · ');
    return `<div class="bt${cls}"><div class="bt-team">${markFor(T[s], 29)}<div class="bt-id">
        <div class="bt-name"><span><a class="tlink" href="?team=${encodeURIComponent(T[s].name)}">${esc(T[s].name)}</a></span>${m.poss === s ? '<i class="sc-ball" title="Has the ball"></i>' : ''}</div><div class="bt-sub${rec ? ' rec' : ''}">${esc(sub)}</div></div></div>
      <div class="bt-q">${cells((i, n) => m.lines[s][i] == null ? 'X' : m.typed ? m.lines[s][i] : (i < 4 && m.fin && i >= (m.qPlayed || 0)) ? 'X' : n < played ? m.lines[s][i] : '')}</div><div class="bt-t">${m.pre ? '' : m.score[s]}</div><i class="sc-win"></i></div>`;
  };
  // A score filled in from KPreps says so, so nobody wonders where a game nobody tracked got its final.
  const status = `${esc(m.status)}${m.men === 8 ? ' <span class="sc-8">8-man</span>' : ''}${x.kp ? ' <span class="sc-8">KPreps</span>' : ''}`;
  // No click-through until stats are being kept (live or entered afterward): schedule entries and quick scores never.
  const acts = m.pre ? `<a class="bbtn" href="?preview=${id}">Preview</a>` : m.quick || (!x.plays.length && !x.box) ? '' : x.box ? `<a class="bbtn" href="?game=${id}&amp;tab=box">Box Score</a>` : `<a class="bbtn" href="?game=${id}">Gamecast</a><a class="bbtn box" href="?game=${id}&amp;tab=box">Box Score</a>`;
  // The admin can hide any game from the scoreboards, or bring a hidden one back.
  const off = ui.admin && isHidden(x);
  const hide = ui.admin ? `${off ? '<span class="b-hidtag">Hidden</span>' : ''}<button type="button" class="bhide" data-hide="${esc(x.id)}"${x.opp ? ' data-opp="1"' : ''}>${off ? 'Show' : 'Hide'}</button>` : '';
  return `<article class="bgame${m.live ? ' live' : ''}${off ? ' bhid' : ''}">
    <div class="b-main"><div class="b-hd"><span class="b-st">${status}</span><div class="bt-q b-qh">${cells(i => i < 4 ? i + 1 : 'OT')}</div><span class="b-th">T</span><i></i></div>
      ${team('A')}${team('H')}</div>
    <div class="b-lead">${m.pre ? preLeaders(x) : m.S ? boardLeaders(x, m.S) : ''}</div>
    <div class="b-acts"><span class="b-st2">${status}</span>${acts}${hide}</div></article>`;
}

/* ---------- the page ---------- */
function renderScoreboard(){
  if (ui.preview) renderPreview();   // a game's preview follows the week's live games too
  if (!ui.board) return;
  const box = $('#board'), key = ui.week;
  watchWeek(key);
  const keys = seasonKeys(fromYmd(key).getFullYear());
  if (!keys.includes(key)){ keys.push(key); keys.sort(); }
  const tabs = keys.map(k => `<button type="button" class="bw${k === key ? ' on' : ''}" data-bweek="${k}"${k === key ? ' aria-current="true"' : ''}>
    <b>${esc(weekLabel(k).toUpperCase())}</b><span>${weekRange(k)}</span></button>`).join('');
  // The State Scoreboard: games with stats kept on them, and games still to come. The admin also sees hidden games, faded.
  // The league board draws on the same pool as the State board, then keeps its own schools' games.
  const games = weekGames(key, ui.admin, ui.state || ui.av).filter(x => (!ui.state && !ui.av) ? inBuco(x) : (onStateBoard(x) && (!ui.av || inAvctl(x)))), note = t => `<section class="bcard"><p class="bempty">${esc(t)}</p></section>`;
  let body;
  if (board.err) body = note(board.err);
  else if (scores.ready !== key) body = note('Loading scores…');
  else if (!games.length) body = note(`No games for ${weekLabel(key)} yet.`);
  else {
    const days = [];
    games.forEach(x => {
      const d = gameDay(x), k = ymd(d);
      let day = days.find(y => y.k === k); if (!day) days.push(day = {k, d, games:[]});
      day.games.push(x);
    });
    body = days.map(day => `<section class="bcard"><h2 class="bday">${esc(day.d.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'}))}</h2>
      ${day.games.map(boardGame).join('')}</section>`).join('');
  }
  const old = box.querySelector('.bweeks'), keep = old ? old.scrollLeft : 0;
  const adminNote = ui.admin ? `<p class="badmin">Signed in as the admin: Hide takes a game off both scoreboards, the scores strip and BUCO Stats for everyone.${ui.state ? ' Games between other schools stay hidden (they still count toward records) until you Show one.' : ''}</p>` : '';
  box.innerHTML = `<section class="bcard bhead"><div class="bhead-top"><h1>${boardName()} Scoreboard</h1></div>${adminNote}
    <div class="bweeks-wrap"><button type="button" class="bw-arrow" data-bscroll="-1" aria-label="Earlier weeks">${chev('M9 1L1 9l8 8')}</button>
      <div class="bweeks">${tabs}</div>
      <button type="button" class="bw-arrow" data-bscroll="1" aria-label="Later weeks">${chev('M1 1l8 8-8 8')}</button></div></section>${body}`;
  // A redraw keeps the week tabs where they were; a new week brings its tab into view.
  const wk = box.querySelector('.bweeks');
  if (board.seen === key) wk.scrollLeft = keep;
  else { board.seen = key; const on = wk.querySelector('.bw.on'); if (on) wk.scrollLeft = Math.max(0, on.offsetLeft - (wk.clientWidth - on.offsetWidth) / 2); }
}

document.addEventListener('click', e => {
  if (!ui.board || !e.target.closest) return;
  const w = e.target.closest('[data-bweek]');
  if (w){ ui.week = w.dataset.bweek; history.replaceState(null, '', `?${boardParam()}=${ui.week}`); renderScores(); return renderScoreboard(); }
  const h = e.target.closest('[data-hide]');
  if (h) return toggleHide(h.dataset.hide, !!h.dataset.opp);
  const a = e.target.closest('[data-bscroll]');
  if (a){ const wk = $('#board .bweeks'); wk.scrollBy({left:+a.dataset.bscroll * wk.clientWidth * .7, behavior:'smooth'}); }
});
// Live games' clocks keep moving between updates.
setInterval(() => { if (ui.board && !document.hidden && $('#board .bgame.live')) renderScoreboard(); }, 5000);
