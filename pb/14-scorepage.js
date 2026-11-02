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
// Every game goes on the State and AVCTL boards: tracked, scored by hand or from KPreps, played or still to come.
const onStateBoard = x => !!x;
const SEASON_WEEKS = 13;   // nine regular-season weeks, then regionals, sectionals, sub-state and state
const board = {err:'', seen:null, cls:new URLSearchParams(location.search).get('class') || '', lg:new URLSearchParams(location.search).get('lg') || ''};
// The State Scoreboard one class at a time (Chuck, 2026-10-30): a game is in a class when either school is.
const BOARD_CLASSES = ['6A', '5A', '4A', '3A', '2A', '1A', '8-Man I', '8-Man II', '6-Man'];
// And one league at a time (Chuck, 2026-11-01), the same way: the list is the Leagues menu's, AVCTL first.
const BOARD_LEAGUES = [{slug:'avctl', name:'AVCTL'}, ...LEAGUES.filter(l => lgDivs(l)[0] === l).map(l => ({slug:l.slug, name:lgPlain(l.name)}))];
const boardLeague = () => BOARD_LEAGUES.find(l => l.slug === board.lg) || null;
function inBoardLeague(x){
  const l = ui.state && boardLeague(); if (!l) return true;
  if (l.slug === 'avctl') return inAvctl(x);
  const teams = new Set(lgDivs(LEAGUES.find(y => y.slug === l.slug)).flatMap(d => d.teams).map(canonSchool));
  return ['A', 'H'].some(s => teams.has(canonSchool(x.teams[s].name)));
}
// Schools the poll's class lists spell another way.
const BOARD_CLASS_AKA = {'Lakeside':'Lakeside Downs', 'Madison':'Madison/Hamilton', "St John's":"St. John's/Tipton Catholic", 'Elkhart':'Elkhart/Rolla',
  'Skyline':'Pratt Skyline', 'Maranatha':'Maranatha Academy', 'Plainville':'Plainville/Natoma', 'Perry-Lecompton':'Perry-Lecompton/Bishop Seabury',
  'St John':'St. John-Hudson', 'Maur Hill-Mount':'Maur Hill-Mount Academy'};
// Its own index, made again once the school list (and with it every school's other names) has arrived: one made
// before then only knows the names exactly as the class lists spell them.
const boardCls = {idx:null, lib:undefined};
function boardClassOf(n){
  if (!boardCls.idx || boardCls.lib !== logoLib.list){
    boardCls.lib = logoLib.list; boardCls.idx = new Map();
    Object.entries(RANK_CLASSES).forEach(([cls, list]) => list.forEach(x => boardCls.idx.set(canonSchool(x), cls)));
  }
  return boardCls.idx.get(canonSchool(n)) || boardCls.idx.get(canonSchool(BOARD_CLASS_AKA[n] || '')) || null;
}
const inBoardClass = x => !board.cls || !ui.state || ['A', 'H'].some(s => boardClassOf(x.teams[s].name) === board.cls);
const boardUrl = () => `?${boardParam()}=${ui.week}${board.cls && ui.state ? '&class=' + encodeURIComponent(board.cls) : ''}${board.lg && ui.state ? '&lg=' + encodeURIComponent(board.lg) : ''}`;
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
  document.title = `${SITE_AV ? '' : boardName() + ' '}Scoreboard · ${SITE_TITLE}`;
  const want = new URLSearchParams(location.search).get(boardParam()) || '';
  ui.week = /^\d{4}-\d\d-\d\d$/.test(want) ? weekKey(fromYmd(want).getTime()) : boardDefaultWeek();
  loadLogos(); loadFiles(); loadStatsFile(); loadRatings(); renderScoreboard();
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
// The full name behind a leader's short one, for the link to his page.
function leaderFull(x, s, n){
  if (n === 'team') return '';
  const num = /^\d+$/.test(n);
  return playerName(rosterGet(x.teams[s].roster, n, s) || (num ? fillName(x.teams[s].name, n, s) : n)) || '';
}
function leaderName(x, s, n){
  if (n === 'team') return 'TEAM';
  // A box score's players are keyed by name and have no number.
  const num = /^\d+$/.test(n), full = playerName(rosterGet(x.teams[s].roster, n, s) || (num ? fillName(x.teams[s].name, n, s) : n));
  if (!full) return `#${n}`;
  const p = full.split(/\s+/);
  return `${p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : full}${num ? ` #${n}` : ''}`;
}
function boardLeaders(x, S){
  // The game's best in each group, whichever side he's on, ESPN style; the school's logo stands where ESPN has a headshot.
  const best = (s, k) => { let top = null; Object.values(S.pl[s]).forEach(p => { if (p.n !== 'team' && p[k] > 0 && (!top || p[k] > top[k])) top = p; }); return top; };
  const td = (n, w) => n ? `, <b>${n}</b> ${w}` : '';
  return [
    ['Pass', 'py', p => `<b>${p.pc}/${p.pa}</b>, <b>${p.py}</b> YDS${td(p.ptd, 'TD')}${td(p.pint, 'INT')}`],
    ['Rush', 'ry', p => `<b>${p.ru}</b> CAR, <b>${p.ry}</b> YDS${td(p.rtd, 'TD')}`],
    ['Rec', 'rey', p => `<b>${p.re}</b> REC, <b>${p.rey}</b> YDS${td(p.retd, 'TD')}`]
  ].map(([k, key, line]) => {
    const o = ['A', 'H'].map(s => ({s, p:best(s, key)})).filter(o => o.p).sort((a, b) => b.p[key] - a.p[key])[0];
    if (!o) return '';
    const [nm, no] = leaderName(x, o.s, o.p.n).split(/ (?=#\d+$)/);
    return `<div class="bp"><span class="bp-k">${k}</span>${markFor(x.teams[o.s], 30)}<div class="bp-body">
      <div class="bp-who">${plLink(leaderFull(x, o.s, o.p.n), x.teams[o.s].name, esc(nm))} <span>${no ? `${esc(no)} - ` : ''}${esc(x.teams[o.s].abbr || shortName(x.teams[o.s].name))}</span></div>
      <div class="bp-line">${line(o.p)}</div></div></div>`;
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
      <div class="bl-who">${plLink(o.p.name, x.teams[o.s].name, esc(shortPlayer(o.p.name)))} <span>- ${esc(x.teams[o.s].abbr || shortName(x.teams[o.s].name))}</span></div>
      <div class="bl-line">${line(o.p)}</div></div>`).join('')}</div></div>`;
  }).join('');
  return rows ? `<div class="bl-hd">Season leaders</div>${rows}` : '';
}
/* ---------- a final's headline and first line, the way a recap opens (Chuck, 2026-10-31, ESPN's scoreboard) ----------
   Written here from the game's own numbers, so it costs nothing and never says what the numbers don't. */
const storyTd = n => n === 1 ? 'a touchdown' : `${['', '', 'two', 'three', 'four', 'five', 'six'][n] || n} touchdowns`;
// The winner's best day with the ball: yards, and 20 for each touchdown. Under 50 of those isn't worth a mention.
function storyStar(x, S, s){
  let top = null;
  Object.values(S.pl[s]).forEach(p => {
    const name = p.n === 'team' ? '' : leaderFull(x, s, p.n);
    if (!name || name.startsWith('#')) return;
    [['threw for', p.py, p.ptd], ['ran for', p.ry, p.rtd], [`caught ${p.re === 1 ? 'a pass' : `${p.re} passes`} for`, p.rey, p.retd]].forEach(([did, y, t]) => {
      const v = (y || 0) + (t || 0) * 20;
      if (v >= 50 && (!top || v > top.v)) top = {v, name, line:`${did} ${plural2(y || 0, 'yard')}${t ? ` and ${storyTd(t)}` : ''}`};
    });
  });
  return top;
}
// Last season's state champions, from playoffs/years/2025.json. A new list each year.
const STORY_CHAMPS = {'Manhattan':'6A', 'Salina Central':'5A', 'Kapaun Mt Carmel':'4A', 'Andale':'3A', 'Nemaha Central':'2A', 'Sterling':'1A',
  'South Central':'8-Man I', 'Hanover':'8-Man II', 'Cunningham':'6-Man'};
const storyChamp = n => { const k = canonSchool(n), hit = Object.keys(STORY_CHAMPS).find(c => canonSchool(c) === k); return hit ? STORY_CHAMPS[hit] : ''; };
// What a score can't say: the two schools, then the line to run under their game.
const STORY_NOTES = [['Herington', 'Northern Heights', 'The game was called in the fourth quarter because of weather.']];
const storyPair = (a, b) => [a, b].map(canonSchool).sort().join('|');
const storyNote = x => (STORY_NOTES.find(([a, b]) => storyPair(a, b) === storyPair(x.teams.A.name, x.teams.H.name)) || [])[2] || '';
// The two schools' other games this season, by pair; made again once the games or the school list change.
const storyMeets = {list:null, lib:undefined, map:null};
function earlierMeeting(x){
  const list = allGames.list; if (!list) return null;
  if (storyMeets.list !== list || storyMeets.lib !== logoLib.list){
    storyMeets.list = list; storyMeets.lib = logoLib.list; storyMeets.map = new Map();
    list.forEach(y => { if (!y || !y.teams) return; const k = storyPair(y.teams.A.name, y.teams.H.name); (storyMeets.map.get(k) || storyMeets.map.set(k, []).get(k)).push(y); });
  }
  const day = gameDay(x).getTime(), xs = (storyMeets.map.get(storyPair(x.teams.A.name, x.teams.H.name)) || []).filter(y => y.id !== x.id && gameDay(y).getTime() < day);
  xs.sort((p, q) => gameDay(q) - gameDay(p));
  for (const y of xs){
    const m = summary(y); if (!m.fin || m.ff) continue;
    const same = canonSchool(y.teams.A.name) === canonSchool(x.teams.A.name);
    const d = gameDay(y);
    return {A:+m.score[same ? 'A' : 'H'], H:+m.score[same ? 'H' : 'A'], day:`${['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'][d.getMonth()]} ${d.getDate()}`};
  }
  return null;
}
function gameStory(x, m, po){
  const a = +m.score.A, b = +m.score.H, hi = Math.max(a, b), lo = Math.min(a, b);
  if (!m.fin) return null;
  // A forfeit (Chuck, 2026-11-01): one marked as one, or a 1-0, a score no game can end on. A bare 2-0 is left alone: it could be played.
  if (a !== b && (m.ff || /forfeit/i.test(m.status || '') || (!lo && hi === 1))){
    const s = a > b ? 'A' : 'H', r = (recordText(x.teams[s], s, false, gameWeek(x), m.score) || '').split(',')[0];
    return {head:`${schoolName(x.teams[s].name)} won by forfeit${/^\d+-\d+/.test(r) ? ` and improves to ${r}` : ''}`, text:''};
  }
  if (!lo && hi <= 2) return null;
  if (a === b) return {head:`${schoolName(x.teams.A.name)} and ${schoolName(x.teams.H.name)} play to a tie`, text:storyNote(x)};
  const W = a > b ? 'A' : 'H', L = W === 'A' ? 'H' : 'A', gap = hi - lo, won = schoolName(x.teams[W].name), lost = schoolName(x.teams[L].name);
  const ot = m.q > 4 || /OT/.test(m.status || '');
  const three = s => m.lines ? m.lines[s].slice(0, 3).reduce((n, v) => n + (+v || 0), 0) : 0;
  const hash = [...x.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0) >>> 0, pick = l => l[hash % l.length];
  const rec = s => { const r = (recordText(x.teams[s], s, false, gameWeek(x), m.score) || '').split(',')[0]; return /^\d+-\d+/.test(r) ? r : ''; };
  const wr = rec(W), lr = rec(L), [ww, wl] = wr.split('-').map(Number), [lw, ll] = lr.split('-').map(Number);
  const [cls, round] = po ? po.label.split(' Playoffs · ') : [];
  // The clock ran out on a blowout before the fourth quarter did: only a game scored by quarters can show that.
  const mercy = !ot && m.q >= 1 && m.q < 4 && !m.quick && gap >= 35;
  // An upset: the ratings still have the loser ahead after counting this game, or the seeds or records going in say so.
  // Not one when the winner came in with the better record, whatever the ratings think.
  const line = !m.pre && pre.rat ? ourLine(x.teams.A.name, x.teams.H.name) : null;
  const dog = line && !line.thin ? (L === 'H' ? line.spread : -line.spread) : 0;
  const sw = po && po.seed(x.teams[W].name), sl = po && po.seed(x.teams[L].name);
  const pct = (w, l) => w / (w + l), games = wr && lr ? [ww - 1 + wl, lw + ll - 1] : [0, 0];
  const recUpset = games[0] >= 4 && games[1] >= 4 && pct(lw, ll - 1) - pct(ww - 1, wl) >= .4;
  const worse = games[0] && games[1] && pct(ww - 1, wl) < pct(lw, ll - 1);
  const upset = dog >= 7 && worse ? `${won} came in as the underdog.` : sw && sl && sw - sl >= 4 ? `${won}, the No. ${sw} seed, knocked off No. ${sl}.`
    : recUpset ? `${won} came in ${ww - 1}-${wl} against a ${lw}-${ll - 1} team.` : '';
  const met = earlierMeeting(x), wasW = met && (W === 'A' ? met.A : met.H), wasL = met && (W === 'A' ? met.H : met.A);
  const revenge = met && wasL > wasW;
  const champL = storyChamp(x.teams[L].name), champW = storyChamp(x.teams[W].name);
  const verb = ot ? 'outlasts' : upset ? pick(['stuns', 'upsets', 'shocks']) : revenge ? pick(['gets revenge on', 'evens the score with'])
    : three(L) > three(W) ? pick(['rallies past', 'comes back to beat']) : !lo ? pick(['shuts out', 'blanks'])
    : gap >= 28 ? pick(['rolls past', 'routs', 'cruises past']) : gap >= 14 ? pick(['beats', 'pulls away from', 'handles'])
    : gap >= 7 ? pick(['beats', 'gets past', 'tops']) : pick(['edges', 'holds off', 'slips past']);
  let where = ot ? ' in overtime' : mercy ? ' by mercy rule' : W === 'A' && round !== 'State Championship' ? ' on the road' : '';
  if (po) where += round === 'State Championship' ? ` for the ${cls} title` : ` in ${cls} ${round === 'First Round' ? 'first round' : `${round.toLowerCase()} round`}`;
  const star = m.S && storyStar(x, m.S, W), up = pick(['improved', 'moved']), next = po && BK_ROUND_NAMES[BK_ROUND_NAMES.indexOf(round) + 1];
  // The most telling things first; the card has room for two sentences, and a star's line is the first when there is one.
  const facts = [
    storyNote(x),
    mercy ? 'The mercy rule ended it early.' : '',
    champL ? (po ? `${won} ended the title defense of the ${champL} champions.` : `${lost} is the defending ${champL} champion.`) : '',
    upset,
    revenge ? `${won} avenged a ${wasL}-${wasW} loss on ${met.day}.` : met && wasW > wasL ? `${won} also won the first meeting, ${wasW}-${wasL}, on ${met.day}.` : met ? `The first meeting ended in a ${wasW}-${wasL} tie on ${met.day}.` : '',
    lr && ll === 1 && lw >= 3 ? `${lost} had been unbeaten.` : '',
    champW && wr ? `The defending ${champW} champion ${!wl && ww >= 5 ? `stays perfect at ${wr}` : `${up} to ${wr}`}.` : '',
    !champW && wr && !wl && ww >= 5 ? `${won} stays perfect at ${wr}.` : '',
    wr && ww === 1 && wl >= 3 ? `${won} got its first win of the season.` : '',
    next ? `${won} moves on to the ${next === 'State Championship' ? 'state championship' : `${next.toLowerCase()} round`}.` : ''
  ].filter(Boolean);
  const said = [];
  if (star) said.push(`${star.name} ${star.line}${facts.length || !wr ? '' : ` as ${won} ${up} to ${wr}`}.`);
  said.push(...facts);
  if (!said.length && wr) said.push(`${won} ${up} to ${wr}${lr ? (po ? ` and ${lost}'s season ended at ${lr}` : ` while ${lost} fell to ${lr}`) : ''}.`);
  return {head:`${won} ${verb} ${lost}${where}`, text:said.slice(0, 2).join(' ')};
}

// Where a game stands, for a live card and the Scoreboard menu: "2nd & 7" and "SOU 29". Only a game scored play by play knows.
function gameSit(x, m){
  const r = m.rp, st = r && r.st;
  if (!st || !m.live || x.box || !(x.plays || []).length || st.final) return null;
  const FL = r.FL, pos = st.phase === 'kick' ? st.kickFrom : st.spot;
  const down = st.phase === 'kick' ? (st.kickKind === 'free' ? 'Free kick' : 'Kickoff') : st.phase === 'try' ? 'Try'
    : `${ord(st.down)} & ${st.ltg >= FL ? 'Goal' : fy(st.ltg - st.spot)}`;
  return {down, at:r.yl(st.poss, pos), pos};
}
// A live game's field, measured off ESPN's (Chuck, 2026-11-01): the team's mark on a pin with the way it's going, the
// drive so far on the bar, then the down and the last play.
function boardField(x, m){
  const sit = gameSit(x, m); if (!sit) return '';
  const r = m.rp, st = r.st, FL = r.FL, s = st.poss, play = st.phase === 'play';
  const X = v => (s === 'A' ? v : FL - v) / FL * 100, to = X(sit.pos), d = r.drives[r.drives.length - 1];
  let ticks = ''; for (let y = 0; y <= FL; y += 10) ticks += `<i class="bf-tick" style="left:${y / FL * 100}%"></i>`;
  const from = play && d && d.open && d.team === s ? X(d.start) : to, lo = Math.min(from, to);
  const last = [...r.log].reverse().find(e => e.text && !['set', 'note'].includes(e.t));
  const end = t => esc(x.teams[t].abbr || shortName(x.teams[t].name));
  const marks = [[0, end('A')], ...[20, FL / 2, FL - 20].map(y => [y, y <= FL / 2 ? y : FL - y]), [FL, end('H')]];
  return `<div class="bf"><div class="bf-chart"><i class="bf-bar"></i><div class="bf-yds">${ticks}
      <i class="bf-drive" style="left:${lo}%;width:${Math.abs(to - from)}%"></i>
      <span class="bf-pin" style="left:${to}%">${markFor(x.teams[s], 16)}</span><i class="bf-dir ${s === 'A' ? 'r' : 'l'}" style="left:${to}%"></i>
      ${marks.map(([y, t]) => `<span class="bf-mk" style="left:${y / FL * 100}%">${t}</span>`).join('')}</div></div>
    <div class="bf-sit">${esc(sit.down)} at ${esc(sit.at)}</div>
    ${last ? `<p class="bf-last"><b>Last Play:</b> ${esc(last.text)}</p>` : ''}</div>`;
}

function boardGame(x){
  const m = summary(x), T = x.teams, lead = leadOf(m), id = encodeURIComponent(x.id);
  // The admin types a final straight into the T column of a game nobody is keeping stats on.
  const canType = ui.admin && x.kind === 'score' && !hasStats(x), typing = canType && board.edit && board.edit.id === x.id;
  const tCell = s => typing ? `<div class="bt-t"><input class="inp b-in" id="bs-${s}" inputmode="numeric" maxlength="3" autocomplete="off"
        value="${esc(board.edit[s] != null ? board.edit[s] : m.pre ? '' : String(m.score[s]))}" aria-label="${esc(schoolName(T[s].name))} final"></div>`
    : canType ? `<button type="button" class="bt-t b-type" data-bscore="${esc(x.id)}" data-side="${s}" title="Type the final">${m.pre ? '' : m.score[s]}</button>`
    : `<div class="bt-t">${m.pre ? `<span class="bt-rec">${esc((recordText(T[s], s, true, gameWeek(x), m.score) || '').split(',')[0])}</span>` : m.score[s]}</div>`;
  // Quarters played so far (every one, once it's final; OT when there was one); a quick score has no line score.
  // Four quarters, plus a column for each overtime the game went to.
  const idx = m.lines ? lineCols({q:m.q, lines:m.lines}) : [];
  const nq = idx.length, played = m.fin ? nq : Math.min(m.q, nq);
  const cells = f => idx.map((i, n) => `<span>${f(i, n)}</span>`).join('');
  const po = bkGameInfo(x);   // a playoff game: seeds before the names, the round under the teams
  const story = gameStory(x, m, po);
  const team = s => {
    const cls = m.fin && lead ? (lead === s ? ' won' : ' lose') : '', sd = po && po.seed(T[s].name);
    // The record as entered, ESPN style "(1-2, 0-1 Away)"; until then the mascot and Away or Home.
    const rec = recordText(T[s], s, !m.fin, gameWeek(x), m.score), sub = rec ? `(${rec})` : [T[s].mascot || listMascot(T[s].name), s === 'A' ? 'Away' : 'Home'].filter(Boolean).join(' · ');
    return `<div class="bt${cls}"><div class="bt-team">${markFor(T[s], 32)}<div class="bt-id">
        <div class="bt-name"><span>${sd ? `<b class="bt-seed">${sd}</b>` : ''}<a class="tlink" href="?team=${encodeURIComponent(schoolName(T[s].name))}">${esc(schoolName(T[s].name))}</a></span>${m.poss === s ? '<i class="sc-ball" title="Has the ball"></i>' : ''}</div><div class="bt-sub${rec ? ' rec' : ''}">${esc(sub)}</div></div></div>
      <div class="bt-q">${cells((i, n) => m.lines[s][i] == null ? 'X' : m.typed ? m.lines[s][i] : (i < 4 && m.fin && i >= (m.qPlayed || 0)) ? 'X' : n < played ? m.lines[s][i] : '')}</div>${tCell(s)}<i class="sc-win"></i></div>`;
  };
  const status = `${esc(m.status)}${m.men === 8 ? ' <span class="sc-8">8-man</span>' : ''}`;
  // No click-through until stats are being kept (live or entered afterward): schedule entries and quick scores never.
  const acts = m.pre ? `<a class="bbtn" href="?preview=${id}">Preview</a>` : m.quick || !hasStats(x) ? '' : x.box ? `<a class="bbtn" href="?game=${id}&amp;tab=box">Box Score</a>` : `<a class="bbtn" href="?game=${id}">Gamecast</a><a class="bbtn box" href="?game=${id}&amp;tab=box">Box Score</a><a class="bbtn box" href="?game=${id}&amp;tab=pbp">Play-By-Play</a>`;
  const typeActs = typing ? `<label class="b-ot"><input type="checkbox" id="bs-ot"${board.edit.ot ? ' checked' : ''}> OT/F</label>
    <button type="button" class="bbtn" data-bsave>Save final</button><button type="button" class="bhide" data-bcancel>Cancel</button>` : '';
  // ESPN's four columns: the score, the story or the field, the leaders, the buttons. Either middle column takes
  // the other's room when it has nothing to show.
  const leaders = m.pre ? preLeaders(x) : m.S ? boardLeaders(x, m.S) : '';
  const field = boardField(x, m), mid = field || (story ? `<div class="bs-h">${esc(story.head)}</div>${story.text ? `<p class="bs-t">— ${esc(story.text)}</p>` : ''}` : '');
  return `<article class="bgame${m.live ? ' live' : ''}${typing ? ' btyping' : ''}${mid && leaders ? '' : ' one'}${mid ? '' : ' nomid'}">
    <div class="b-main"><div class="b-hd"><span class="b-st">${status}</span><div class="bt-q b-qh">${cells(i => i < 4 ? i + 1 : 'OT')}</div><span class="b-th">T</span><i></i></div>
      ${team('A')}${team('H')}${po ? `<div class="b-round">${esc(po.label)}</div>` : ''}</div>
    ${mid ? `<div class="b-mid${field ? '' : ' story'}">${mid}</div>` : ''}${leaders ? `<div class="b-lead">${leaders}</div>` : ''}
    <div class="b-acts"><span class="b-st2">${status}</span>${typing ? typeActs : acts}</div></article>`;
}

/* ---------- beside the games: a league's standings and the quick links ---------- */
const RAIL_KEY = 'pressbox.railLeague';
function railLeagues(){
  const av = AV_NAMES.map(d => ({id:`av-${d}`, name:`AVCTL Division ${d}`, href:`${SITE_AV ? '' : AV_SITE}?standings`, rows:() => standingsRows(d)}));
  return SITE_AV ? av : av.concat(LEAGUES.map(l => ({id:l.slug, name:l.name, href:`?league=${l.slug}`, rows:() => {
    const mine = new Set(l.teams.map(canonSchool));
    return standSort(l.teams.map(name => ({name, r:avRecord(name, o => mine.has(canonSchool(o))), rec:shownRecord(name)})));
  }})));
}
function boardRail(){
  if (!matchMedia('(min-width:1200px)').matches) return '';   // no room for it: drawn only when it shows
  const all = railLeagues(), I = homeIcons();
  const table = l => allGames.list ? `<table class="rs-tbl"><thead><tr><th colspan="2"></th><th class="num">League</th><th class="num">Overall</th></tr></thead><tbody>${l.rows().map(o => `<tr><td class="rk">${cMark(o.name)}</td><td class="nm"><a class="tlink" href="?team=${encodeURIComponent(o.name)}">${esc(o.name)}</a></td>
      <td class="num">${avRec(o.r.dw, o.r.dl, o.r.dt)}</td><td class="num">${esc((o.rec && o.rec.rec) || avRec(o.r.w, o.r.l, o.r.t))}</td></tr>`).join('')}</tbody></table>` : '';
  const quick = l => `<section class="hcard"><h2 class="h-rail">${homeIcon(I.link)}Quick Links</h2>
      <nav class="h-links" aria-label="Quick links">${l.map(([t, h, d]) => `<a href="${esc(h)}">${homeIcon(d)}${esc(t)}</a>`).join('')}</nav></section>`;
  const cards = l => l.map(o => `<section class="hcard"><h2 class="h-rail">${homeIcon(I.list)}${esc(o.name.replace('AVCTL ', ''))}</h2>${table(o)}<a class="rs-more" href="${esc(o.href)}">Full standings</a></section>`).join('');
  // The AVCTL site has four divisions and no more: all of them, each time (Chuck, 2026-11-01).
  if (SITE_AV) return `${cards(all)}
    ${quick([['Standings', '?standings', I.list], ['Player Stats', '?avstats', I.stats], ['Team Stats', '?avstats=team', I.team], ['Teams', '?teams', I.team]])}`;
  // A league picked above the games stays here until it's cleared (Chuck, 2026-11-01): every division of it.
  const picked = ui.state && boardLeague();
  if (picked) return `${cards(all.filter(l => picked.slug === 'avctl' ? l.id.startsWith('av-') : lgPlain(l.name) === picked.name))}
    ${quick(homeLinks())}`;
  // A different league each visit (Chuck, 2026-10-31), never the one shown last; it holds through this visit's redraws.
  if (board.rail == null){
    let last = ''; try { last = localStorage.getItem(RAIL_KEY) || ''; } catch (e) {}
    const rest = all.filter(l => l.id !== last);
    board.rail = rest[Math.floor(Math.random() * rest.length)].id;
    try { localStorage.setItem(RAIL_KEY, board.rail); } catch (e) {}
  }
  const on = all.find(l => l.id === board.rail) || all[0];
  return `<section class="hcard"><h2 class="h-rail">${homeIcon(I.list)}Standings</h2>
      <select class="c-sel rs-sel" id="railleague" aria-label="League">${all.map(l => `<option value="${esc(l.id)}"${l === on ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
      ${table(on)}<a class="rs-more" href="${esc(on.href)}">Full standings</a></section>
    ${quick(homeLinks())}`;
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
  // The State Scoreboard: games with stats kept on them, and games still to come.
  // The league board draws on the same pool as the State board, then keeps its own schools' games.
  const games = weekGames(key, false, ui.state || ui.av).filter(x => (!ui.state && !ui.av) ? inBuco(x) : (onStateBoard(x) && (!ui.av || inAvctl(x)) && inBoardClass(x) && inBoardLeague(x))), note = t => `<section class="bcard"><p class="bempty">${esc(t)}</p></section>`;
  let body;
  if (board.err) body = note(board.err);
  else if (scores.ready !== key && !allGames.list) body = note('Loading scores…');
  else if (!games.length) body = note(`No ${ui.state ? [board.cls, (boardLeague() || {}).name].filter(Boolean).map(t => t + ' ').join('') : ''}games for ${weekLabel(key)} yet.`);
  else {
    const days = [];
    games.forEach(x => {
      const d = gameDay(x), k = ymd(d);
      let day = days.find(y => y.k === k); if (!day) days.push(day = {k, d, games:[]});
      day.games.push(x);
    });
    // Live games first, then finals, then games still to come; a day with a game going on moves to the top.
    const rank = new Map(games.map(x => { const m = summary(x); return [x, m.live ? 0 : m.fin ? 1 : 2]; }));
    // Within a day, A to Z by the visiting school (Chuck, 2026-10-30), so the cards sit in the same order in the
    // snapshot and in the live copy that replaces it a moment later — nothing jumps under the reader's finger.
    const bySchool = x => x.teams.A.name.toLowerCase();
    days.forEach(day => { day.games.sort((a, b) => rank.get(a) - rank.get(b) || bySchool(a).localeCompare(bySchool(b)) || canonSchool(a.teams.H.name).localeCompare(canonSchool(b.teams.H.name))); day.live = rank.get(day.games[0]) === 0; });
    days.sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || a.k.localeCompare(b.k));
    // The first dozen cards now, the rest as they scroll near (a State week is 160 games); the card being typed on
    // is always drawn.
    const lk = 'board|' + boardName() + '|' + key + '|' + board.cls + '|' + board.lg;
    if (board.lazyKey !== lk){ lazyReset(); board.lazyKey = lk; }
    let room = 12;
    body = days.map((day, di) => { const first = board.edit && day.games.some(x => x.id === board.edit.id) ? day.games.length : room;
      room = Math.max(0, room - day.games.length);
      return `<section class="bcard"><h2 class="bday">${esc(day.d.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'}))}</h2>
      ${lazyList(day.games, boardGame, board.lazyKey + '|' + day.k, {first})}</section>`; }).join('');
  }
  const old = box.querySelector('.bweeks'), keep = old ? old.scrollLeft : 0;
  const act = document.activeElement, focusId = act && box.contains(act) && act.id && act.id.startsWith('bs-') ? act.id : null;
  // Live games redraw the page every few seconds: the side bar stays put unless it changed, or its list would snap shut.
  const rail = boardRail(), oldRail = box.querySelector('.b-rail');
  box.innerHTML = `<div class="bd-grid"><div class="bd-col"><section class="bcard bhead"><div class="bhead-top"><h1 class="b-title">${boardName()} Scoreboard</h1>${ui.state ? `<div class="bfilters"><select class="c-sel bcls" id="blg" aria-label="League">
      ${[{slug:'', name:'All leagues'}, ...BOARD_LEAGUES].map(l => `<option value="${esc(l.slug)}"${l.slug === board.lg ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</select><select class="c-sel bcls" id="bcls" aria-label="Class">
      ${['', ...BOARD_CLASSES].map(c => `<option value="${esc(c)}"${c === board.cls ? ' selected' : ''}>${c ? esc(c) : 'All classes'}</option>`).join('')}</select></div>` : ''}</div>
    <div class="bweeks-wrap"><button type="button" class="bw-arrow" data-bscroll="-1" aria-label="Earlier weeks">${chev('M9 1L1 9l8 8')}</button>
      <div class="bweeks">${tabs}</div>
      <button type="button" class="bw-arrow" data-bscroll="1" aria-label="Later weeks">${chev('M1 1l8 8-8 8')}</button></div></section>${body}</div><aside class="b-rail"></aside></div>`;
  if (oldRail && board.railHtml === rail) box.querySelector('.b-rail').replaceWith(oldRail);
  else { box.querySelector('.b-rail').innerHTML = rail; board.railHtml = rail; }
  lazyWatch(box);
  if (focusId){ const f = $('#' + focusId); if (f){ f.focus(); if (f.setSelectionRange && f.type !== 'checkbox') f.setSelectionRange(f.value.length, f.value.length); } }
  // A redraw keeps the week tabs where they were; a new week brings its tab into view.
  const wk = box.querySelector('.bweeks');
  if (board.seen === key) wk.scrollLeft = keep;
  else { board.seen = key; const on = wk.querySelector('.bw.on'); if (on) wk.scrollLeft = Math.max(0, on.offsetLeft - (wk.clientWidth - on.offsetWidth) / 2); }
}

document.addEventListener('click', e => {
  if (!ui.board || !e.target.closest) return;
  const w = e.target.closest('[data-bweek]');
  if (w){ ui.week = w.dataset.bweek; history.pushState(null, '', boardUrl()); renderScores(); return renderScoreboard(); }
  const ty = e.target.closest('[data-bscore]');
  if (ty){
    const x = weekGames(ui.week, ui.admin, true).find(y => y.id === ty.dataset.bscore);
    board.edit = {id:ty.dataset.bscore, A:null, H:null, ot:!!x && x.per === 'fot'};
    renderScoreboard(); const f = $('#bs-' + (ty.dataset.side || 'A')); if (f){ f.focus(); f.select(); }
    return;
  }
  if (e.target.closest('[data-bsave]')) return saveBoardFinal();
  if (e.target.closest('[data-bcancel]')){ board.edit = null; return renderScoreboard(); }
  const a = e.target.closest('[data-bscroll]');
  if (a){ const wk = $('#board .bweeks'); wk.scrollBy({left:+a.dataset.bscroll * wk.clientWidth * .7, behavior:'smooth'}); }
});
document.addEventListener('change', e => {
  if (ui.board && e.target.id === 'railleague'){
    board.rail = e.target.value;
    return renderScoreboard();
  }
  if (!ui.board || (e.target.id !== 'bcls' && e.target.id !== 'blg')) return;
  board[e.target.id === 'bcls' ? 'cls' : 'lg'] = e.target.value; history.pushState(null, '', boardUrl()); renderScoreboard();
});
// The final typed on a card: both boxes filled, then saved the same way as from a team page.
function saveBoardFinal(){
  const ed = board.edit; if (!ed) return;
  const v = s => parseInt(($('#bs-' + s) || {}).value, 10), A = v('A'), H = v('H');
  if (isNaN(A) || isNaN(H)) return toast('Enter both scores');
  const x = weekGames(ui.week, ui.admin, true).find(y => y.id === ed.id), ot = ($('#bs-ot') || {}).checked;
  board.edit = null;
  saveFinal(x, {A, H}, ot);
  renderScoreboard();
}
// What's typed survives a redraw (the board redraws itself every few seconds while a game is live).
document.addEventListener('input', e => {
  if (!ui.board || !board.edit) return;
  const id = e.target.id || '';
  if (/^bs-[AH]$/.test(id)) board.edit[id.slice(3)] = e.target.value;
  if (id === 'bs-ot') board.edit.ot = e.target.checked;
});
document.addEventListener('keydown', e => {
  if (!ui.board || !board.edit || !/^bs-[AH]$/.test((e.target && e.target.id) || '')) return;
  // Enter or Tab from the visitors' box goes to the home box; Enter there saves.
  const other = $(e.target.id === 'bs-A' ? '#bs-H' : '#bs-A');
  if ((e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) && e.target.id === 'bs-A' && other){ e.preventDefault(); other.focus(); other.select(); return; }
  if (e.key === 'Tab' && e.shiftKey && e.target.id === 'bs-H' && other){ e.preventDefault(); other.focus(); other.select(); return; }
  if (e.key === 'Enter'){ e.preventDefault(); saveBoardFinal(); }
  if (e.key === 'Escape'){ board.edit = null; renderScoreboard(); }
});
// Live games' clocks keep moving between updates.
setInterval(() => { if (ui.board && !document.hidden && $('#board .bgame.live')) renderScoreboard(); }, 5000);
