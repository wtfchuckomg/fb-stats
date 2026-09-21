/* ================================================================
   A player's own page (?player=<name>&team=<school>): his season and
   career numbers laid out like ESPN's player page, and a Game Log
   button next to it, the way a team page has Schedule and Roster.
   Everything comes from the same statted games the stats pages use,
   so a player is here the moment his first game is.
   No defense: tackles and sacks are never complete on this site.
   ================================================================ */
const PLAYER_PAGE = PAGE_Q.has('player');
const ppage = {view:'stats', season:null, name:'', team:''};

async function startPlayerPage(){
  ui.viewer = true; ui.player = true; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  ppage.name = (PAGE_Q.get('player') || '').trim();
  ppage.team = (PAGE_Q.get('team') || '').trim();
  loadLogos();
  renderPlayer();
  shareAddress();
  try {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-`;
    const [appM, fsM] = await Promise.all(['app', 'firestore'].map(m => import(base + m + '.js')));
    const fsdb = fsM.getFirestore(appM.initializeApp(firebaseConfig));
    loadStats({fsM, fsdb});     // the season's numbers, the same file the stats pages read
    watchRosters({fsM, fsdb});  // for his jersey number
  } catch (e) { county.err = 'Can’t reach the stats. Check your connection and reload.'; renderPlayer(); }
}

// On the site itself the address becomes the player's preview link (/p/<school>-<name>/), so copying it and
// posting it shows his card. Only once that page exists: a player added tonight keeps ?player= until the rebuild.
function shareAddress(){
  if (location.hostname !== 'stats.kansasmediarankings.com' || location.pathname.startsWith('/p/')) return;
  const k = `${logoSlug(ppage.team)}-${logoSlug(ppage.name)}`;
  fetch(`/p/${k}/`, {method:'HEAD'}).then(r => {
    if (!r.ok || location.pathname.startsWith('/p/')) return;
    if (!document.querySelector('base')){ const b = document.createElement('base'); b.href = '/'; document.head.prepend(b); }
    history.replaceState(null, '', `/p/${k}/`);
  }).catch(() => {});
}

// Every game this player has a line in: the game, which side he was on, and his numbers from it.
function playerGames(){
  const key = String(ppage.name || '').trim().toLowerCase(), team = ppage.team;
  if (!key || !county.games) return [];
  const out = [];
  countyGames().forEach(x => {
    const n = gameNumbers(x); if (!n) return;
    ['A', 'H'].forEach(s => {
      if (!sameTeamName(n[s].name, team)) return;
      const row = (n[s].pl || []).find(p => playerName(p.name).toLowerCase() === key);
      if (row) out.push({x, s, o:s === 'A' ? 'H' : 'A', n, row});
    });
  });
  return out.sort((a, b) => gameDay(a.x) - gameDay(b.x));
}
// 2025, for a Butler County player: his season totals from the county leaderboard. There were no games behind it,
// so it is passing, rushing and receiving only — no kicking, returns or games played.
function p2025(){
  const key = String(ppage.name || '').trim().toLowerCase();
  if (!key || typeof STATS_2025 === 'undefined') return null;
  const hit = STATS_2025.find(r => sameTeamName(r.team, ppage.team) && playerName(r.name).toLowerCase() === key);
  return hit ? Object.assign({gp:null, src25:true}, zeros(C_KEYS), {pc:hit.pc, pa:hit.pa, py:hit.py, ptd:hit.ptd, pint:hit.pint,
    ru:hit.ru, ry:hit.ry, rtd:hit.rtd, re:hit.re, rey:hit.rey, retd:hit.retd}) : null;
}
const pTot = rows => { const t = Object.assign({gp:0}, zeros(C_KEYS)); rows.forEach(r => { t.gp++; C_KEYS.forEach(k => { t[k] += +r.row[k] || 0; }); }); return t; };

// The sections, in ESPN's order. Each one is shown only when he has something in it.
const P_SEC = [
  ['Passing', p => p.pa > 0, [['CMP', p => p.pc], ['ATT', p => p.pa], ['CMP%', p => per(100 * p.pc, p.pa), 1], ['YDS', p => p.py],
    ['AVG', p => per(p.py, p.pa), 1], ['TD', p => p.ptd], ['INT', p => p.pint], ['RTG', rating, 1]]],
  ['Rushing', p => p.ru > 0 || p.ry !== 0, [['CAR', p => p.ru], ['YDS', p => p.ry], ['AVG', p => per(p.ry, p.ru), 1], ['TD', p => p.rtd]]],
  ['Receiving', p => p.re > 0 || p.rey !== 0, [['REC', p => p.re], ['YDS', p => p.rey], ['AVG', p => per(p.rey, p.re), 1], ['TD', p => p.retd]]],
  ['Kicking', p => p.fga > 0 || p.xpa > 0, [['FGM', p => p.fgm], ['FGA', p => p.fga], ['FG%', p => per(100 * p.fgm, p.fga), 1],
    ['XPM', p => p.xpm], ['XPA', p => p.xpa], ['PTS', p => 3 * p.fgm + p.xpm]]],
  ['Scoring', p => ptsOf(p) > 0, [['RUSH', p => p.rtd], ['REC', p => p.retd], ['RET', p => p.ret], ['TD', tdAll],
    ['2PT', p => p.two], ['PAT', p => p.xpm], ['FG', p => p.fgm], ['PTS', ptsOf]]]];

// The 2025 leaderboard knows nothing about kicks, returns or two-point tries, so those columns stay blank for it.
const NOT_IN_25 = ['RET', '2PT', 'PAT', 'FG', 'FGM', 'FGA', 'FG%', 'XPM', 'XPA'];
const pCell = (c, t) => {
  if (t.src25 && NOT_IN_25.includes(c[0])) return '—';
  const v = num(c[1](t)); return v == null ? '—' : c[2] ? v.toFixed(c[2]) : String(Math.round(v * 10) / 10);
};
// One category: a row per season, then the career line. Season and team on the left, numbers on the right.
function pSeasonTable(title, cols, bySeason, career){
  if (title === 'Kicking') bySeason = bySeason.filter(([, t]) => !t.src25);   // nothing about kicking in 2025
  const row = (label, team, t, cls) => `<tr${cls ? ` class="${cls}"` : ''}><td class="nm"><b>${esc(label)}</b></td>
    <td class="nm">${team ? `<div class="cn-in">${cMark(team)}<span>${esc(shortName(team))}</span></div>` : ''}</td>
    ${cols.map(c => `<td class="num">${esc(pCell(c, t))}</td>`).join('')}</tr>`;
  return `<div class="pl-sec"><h3>${esc(title)}</h3>
    <div class="tbl-wrap"><table class="ctbl pl-tbl"><thead><tr><th class="nm">SEASON</th><th class="nm">TEAM</th>${cols.map(c => `<th class="num">${c[0]}</th>`).join('')}</tr></thead>
    <tbody>${bySeason.map(([y, t]) => row(String(y), ppage.team, t)).join('')}
      ${bySeason.length > 1 ? row('Career', '', career, 'pl-career') : ''}</tbody></table></div></div>`;
}

// "Fri 9/18", the opponent with its logo, and the result the way a schedule shows it.
function pLogRow(r, cols){
  // The score comes from the game's own numbers: a game read from the stats file has no plays to replay.
  const opp = r.x.teams[r.o].name, home = r.s === 'H';
  const mine = r.n[r.s].score, theirs = r.n[r.o].score;
  const res = !r.n.fin || mine == null ? '<span class="pl-res">—</span>'
    : `<span class="pl-res ${mine > theirs ? 'w' : mine < theirs ? 'l' : 't'}">${mine > theirs ? 'W' : mine < theirs ? 'L' : 'T'} ${mine}-${theirs}</span>`;
  const d = gameDay(r.x);
  return `<tr><td class="nm"><div class="cn-in">${esc(d.toLocaleDateString('en-US', {weekday:'short', month:'numeric', day:'numeric'}))}</div></td>
    <td class="nm"><div class="cn-in"><a class="pl-opp" href="?team=${encodeURIComponent(opp)}">${cMark(opp)}<b>${home ? 'vs' : '@'} ${esc(shortName(opp))}</b></a></div></td>
    <td class="nm"><div class="cn-in"><a class="pl-opp" href="?game=${encodeURIComponent(r.x.id)}">${res}</a></div></td>
    ${cols.map(c => `<td class="num">${esc(pCell(c, Object.assign(zeros(C_KEYS), r.row)))}</td>`).join('')}</tr>`;
}
function pLogTable(secs, rows){
  const cols = secs.flatMap(([, , c]) => c);
  const groups = `<tr class="cgrp"><th class="nm"></th><th class="nm"></th><th class="nm"></th>${secs.map(([t, , c]) => `<th colspan="${c.length}">${t.toUpperCase()}</th>`).join('')}</tr>`;
  const tot = pTot(rows);
  return `<div class="tbl-wrap"><table class="ctbl pl-tbl"><thead>${secs.length > 1 ? groups : ''}
      <tr><th class="nm">DATE</th><th class="nm">OPP</th><th class="nm">RESULT</th>${cols.map(c => `<th class="num">${c[0]}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => pLogRow(r, cols)).join('')}
      <tr class="pl-career"><td class="nm"><div class="cn-in"><b>Total</b></div></td><td class="nm"></td><td class="nm"></td>
        ${cols.map(c => `<td class="num">${esc(pCell(c, tot))}</td>`).join('')}</tr></tbody></table></div>`;
}

// His jersey number, from the roster saved for the school.
function pNumber(){
  const r = rosterFor(ppage.team);
  if (!r || !r.players) return '';
  const hit = r.players.find(p => playerName(p.name).toLowerCase() === ppage.name.toLowerCase());
  return hit && hit.num ? String(hit.num).split('/')[0] : '';
}

function renderPlayer(){
  if (!ui.player) return;
  const box = $('#board');
  document.title = `${ppage.name} · ${ppage.team} · Kansas Media Stats`;
  const rows = playerGames();
  const seasons = [...new Set(rows.map(r => seasonOf(r.x)))].sort((a, b) => b - a);
  if (ppage.season == null || !seasons.includes(ppage.season)) ppage.season = seasons[0] || new Date().getFullYear();
  const no = pNumber();
  const head = `<section class="bcard bhead"><div class="pl-head">${markFor({name:ppage.team, abbr:shortName(ppage.team), color:'#4A4B4D'}, 64)}
      <div><h1 class="pl-name">${esc(ppage.name)}</h1>
        <p class="pl-sub">${no ? `#${esc(no)} · ` : ''}<a href="?team=${encodeURIComponent(ppage.team)}">${esc(ppage.team)}</a></p></div></div>
    <div class="tp-links">${[['stats', 'Stats'], ['log', 'Game Log']].map(([k, l]) =>
      `<button type="button" class="h-btn${ppage.view === k ? ' on' : ''}" data-pview="${k}">${l}</button>`).join('')}</div></section>`;
  const note = t => `<section class="bcard"><p class="bempty">${esc(t)}</p></section>`;
  let body;
  if (county.err) body = note(county.err);
  else if (!county.games) body = note('Loading stats…');
  else if (!rows.length && !p2025()) body = note(`No stats for ${ppage.name} yet. A player turns up here once a game he played in has been kept on this site.`);
  else {
    const old25 = p2025();
    const career = pTot(rows);
    if (old25) C_KEYS.forEach(k => { career[k] += +old25[k] || 0; });
    const secs = P_SEC.filter(([, keep]) => keep(career));
    if (ppage.view === 'log'){
      const mine = rows.filter(r => seasonOf(r.x) === ppage.season);
      const logSecs = secs.filter(([t]) => t !== 'Scoring');      // scoring is the same touchdowns over again
      const pick = seasons.length > 1 ? `<select class="c-sel" id="pseason" aria-label="Season">${seasons.map(y =>
        `<option value="${y}"${y === ppage.season ? ' selected' : ''}>${y}</option>`).join('')}</select>` : '';
      body = `<section class="bcard ccard"><div class="ccard-hd"><h2>${ppage.season} Game Log</h2>${pick}</div>
        ${mine.length ? pLogTable(logSecs.length ? logSecs : secs, mine) : `<p class="bempty" style="padding:4px 20px 10px">No games for ${ppage.season}.</p>`}</section>`;
    } else {
      let bySeason = seasons.slice().sort((a, b) => a - b).map(y => [y, pTot(rows.filter(r => seasonOf(r.x) === y))]);
      if (old25 && !bySeason.some(([y]) => y === 2025)) bySeason = [[2025, old25], ...bySeason].sort((a, b) => a[0] - b[0]);
      body = `<section class="bcard ccard pl-stats"><div class="ccard-hd"><h2>Stats</h2></div>
        ${secs.map(([title, , cols]) => pSeasonTable(title, cols, bySeason, career)).join('')}
        ${old25 ? '<p class="h-note pl-note">2025 is the season total from the Butler County leaderboard: passing, rushing and receiving only, with no games behind it.</p>' : ''}</section>`;
    }
  }
  box.innerHTML = head + body;
  const sel = $('#pseason');
  if (sel) sel.addEventListener('change', () => { ppage.season = +sel.value; renderPlayer(); });
}
document.addEventListener('click', e => {
  if (!ui.player || !e.target.closest) return;
  const b = e.target.closest('[data-pview]'); if (!b) return;
  ppage.view = b.dataset.pview; renderPlayer();
});
// A player's name on the stats pages and in the leaders links here.
const playerHref = (name, team) => `?player=${encodeURIComponent(name)}&team=${encodeURIComponent(team)}`;
// Wrap a name in a link to his page, when we know the school and his name (not a bare "#12").
function plLink(name, team, inner){
  const n = playerName(name || '');
  if (!n || /^#/.test(n) || n === 'Team' || n === 'TEAM' || !team) return inner;
  return `<a class="tlink" href="${playerHref(n, team)}">${inner}</a>`;
}
