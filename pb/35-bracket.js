/* ================================================================
   Bracketology (?bracket=4A): where the playoff bracket stands today,
   by the KSHSAA's own seeding rules for Classes 6A, 5A and 4A —
   the 16 schools in each half of the state are seeded 1-16 on:
     1. win-loss percentage, weeks 1-8
     2. head-to-head, when everyone tied has played everyone else
     3. average margin, no more than 13 points a game (1 in overtime)
     4. drawn by lot
   The higher seed hosts, and the East and West champions meet for the
   title. Week #9 pairs 1-16, 8-9, 4-13, 5-12, 2-15, 7-10, 3-14, 6-11.
   Districts (3A and down) come later, when district play starts.
   ================================================================ */
const BRACKET_PAGE = PAGE_Q.has('bracket');
// The KSHSAA's east and west sections, 2026-27 (FootballDistrictAssignments_26-27), under this site's own names.
const SECTIONS = {
  '4A': {
    East:['Labette County', 'Bonner Springs', 'Chanute', 'Field Kindley', 'Eudora', 'Fort Scott', 'Independence', 'Schlagle',
      'KC Sumner', 'Lansing', 'Louisburg', 'St. Thomas Aquinas', 'Ottawa', 'Paola', 'Bishop Miege', 'Tonganoxie'],
    West:['Abilene', 'Arkansas City', 'Augusta', 'Buhler', 'El Dorado', 'Great Bend', 'McPherson', 'Mulvane', 'Rose Hill',
      'Rock Creek', 'Highland Park', 'Circle', 'Ulysses', 'Wamego', 'Wellington', 'Winfield']},
  '5A': {
    East:['Basehor-Linwood', 'De Soto', 'JC Harmon', 'Piper', 'Turner', 'Washington', 'Leavenworth', 'St. James Academy',
      'Blue Valley', 'Blue Valley North', 'Blue Valley Southwest', 'Pittsburg', 'Spring Hill', 'Shawnee Heights', 'Seaman', 'Topeka West'],
    West:['Andover', 'Andover Central', 'Emporia', 'Goddard', 'Eisenhower', 'Hays', 'Hutchinson', 'Liberal', 'Maize South', 'Newton',
      'Salina Central', 'Salina South', 'Valley Center', 'Bishop Carroll', 'Kapaun Mt. Carmel', 'Wichita West']},
  '6A': {
    East:['Gardner-Edgerton', 'Wyandotte', 'Lawrence', 'Olathe East', 'Olathe North', 'Olathe Northwest', 'Olathe South', 'Olathe West',
      'BV Northwest', 'BV West', 'Shawnee Mission East', 'Shawnee Mission North', 'Shawnee Mission Northwest', 'Shawnee Mission South',
      'Shawnee Mission West', 'Mill Valley'],
    West:['Derby', 'Dodge City', 'Garden City', 'Campus', 'Junction City', 'Lawrence Free State', 'Maize', 'Manhattan', 'Topeka High',
      'Washburn Rural', 'Wichita East', 'Wichita Heights', 'Wichita North', 'Wichita Northwest', 'Wichita South', 'Wichita Southeast']}};
const BK_PAIRS = [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]];
const bk = {cls:'4A'};

async function startBracket(){
  ui.viewer = true; ui.bracket = true; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  const want = String(PAGE_Q.get('bracket') || '4A').toUpperCase();
  if (SECTIONS[want]) bk.cls = want;
  loadLogos();
  renderBracket();
  try {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-`;
    const [appM, fsM] = await Promise.all(['app', 'firestore'].map(m => import(base + m + '.js')));
    const fsdb = fsM.getFirestore(appM.initializeApp(firebaseConfig));
    scoresReady({fsM, fsdb});
  } catch (e) { allGames.err = 'Can’t reach the games. Check your connection and reload.'; renderBracket(); }
}

// One school's season so far: record, and the average margin the KSHSAA counts (13 a game, 1 in overtime).
function bkTeam(name){
  const t = {name, w:0, l:0, t:0, gp:0, marg:0, beat:new Set(), lost:new Set(), games:[]};
  schoolRows(name).forEach(({x, side, opp}) => {
    const f = finalOf(x); if (!f.fin || !f.score) return;
    const mine = +f.score[side], theirs = +f.score[opp], other = x.teams[opp].name;
    const ot = (f.q || 0) > 4, cap = ot ? 1 : 13;
    const d = Math.max(-cap, Math.min(cap, mine - theirs));
    t.gp++; t.marg += d; t.games.push({opp:other, mine, theirs, ot});
    if (mine > theirs){ t.w++; t.beat.add(canonSchool(other)); }
    else if (mine < theirs){ t.l++; t.lost.add(canonSchool(other)); }
    else t.t++;
  });
  t.pct = t.gp ? (t.w + t.t / 2) / t.gp : 0;
  t.avg = t.gp ? t.marg / t.gp : 0;
  return t;
}

// Seeds 1-16 in one section, by the manual's criteria in order.
function bkSeed(names){
  const teams = names.map(bkTeam);
  const byPct = {};
  teams.forEach(t => { (byPct[t.pct.toFixed(4)] = byPct[t.pct.toFixed(4)] || []).push(t); });
  const out = [];
  Object.keys(byPct).sort((a, b) => b - a).forEach(k => {
    let tied = byPct[k];
    if (tied.length === 1) return out.push(Object.assign(tied[0], {how:''}));
    // Head-to-head counts only when everyone tied has played everyone else.
    const all = tied.every(a => tied.every(b => a === b || a.beat.has(canonSchool(b.name)) || a.lost.has(canonSchool(b.name))));
    if (all){
      tied = tied.slice().sort((a, b) => tied.filter(x => a.beat.has(canonSchool(x.name))).length - tied.filter(x => b.beat.has(canonSchool(x.name))).length);
      tied.reverse();
      tied.forEach(t => out.push(Object.assign(t, {how:'head-to-head'})));
      return;
    }
    tied.slice().sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name))
      .forEach(t => out.push(Object.assign(t, {how:'13-point margin'})));
  });
  return out.slice(0, 16).map((t, i) => Object.assign(t, {seed:i + 1}));
}

const bkRec = t => `${t.w}-${t.l}${t.t ? `-${t.t}` : ''}`;
const bkMark = name => markFor({name, abbr:shortName(name), color:'#4A4B4D'}, 22);
// One team inside a bracket game. A seed with no games on file says so instead of pretending to a record.
function bkTeamRow(t, win){
  if (!t) return `<div class="bk-row empty"><span class="bk-seed"></span><span class="bk-nm">—</span></div>`;
  return `<div class="bk-row${win ? ' win' : ''}"><span class="bk-seed">${t.seed}</span>${bkMark(t.name)}
    <a class="bk-nm" href="?team=${encodeURIComponent(t.name)}" title="${esc(t.name)}">${esc(t.name)}</a>
    <span class="bk-rec">${t.gp ? esc(bkRec(t)) : '<i>no games</i>'}</span></div>`;
}
const bkGame = (a, b) => {
  const win = !a ? null : !b ? a : (a.seed <= b.seed ? a : b);   // the projection: the higher seed moves on
  return {a, b, win, html:`<div class="bk-game">${bkTeamRow(a, win === a)}${bkTeamRow(b, win === b)}</div>`};
};

// LOOK 2: the bracket. Each team its own pill, the pair joined by a connector into the next round.
function bkPill(t){
  if (!t) return `<div class="bkp empty"><span class="bk-nm">—</span></div>`;
  return `<div class="bkp"><span class="bk-seed">${t.seed}</span>${bkMark(t.name)}
    <a class="bk-nm" href="?team=${encodeURIComponent(t.name)}">${esc(t.name)}</a>
    <span class="bk-rec">${t.gp ? esc(bkRec(t)) : '<i>no games</i>'}</span></div>`;
}
function bkTreeHtml(seeds, side){
  const byNo = {}; seeds.forEach(t => { byNo[t.seed] = t; });
  const pairs = BK_PAIRS.map(([x, y]) => `<div class="bkt-pair">${bkPill(byNo[x])}${bkPill(byNo[y])}</div>`);
  return `<div class="bkt"><h3>${side}</h3>
    <div class="bkt-cols"><div class="bkt-col"><span class="bkt-h">Week 9</span><div class="bkt-pairs">${pairs.join('')}</div></div></div></div>`;
}
function bkListHtml(seeds, side){
  return `<div class="bk-list"><h3>${side}</h3>
    <div class="tbl-wrap"><table class="ctbl bks-tbl"><thead><tr>
      <th class="c-seed">SEED</th><th class="nm">TEAM</th><th class="num c-wl">W-L</th>
      <th class="num c-pct">PCT</th><th class="num c-marg">MARGIN</th><th class="nm c-tb">TIEBREAK</th></tr></thead>
    <tbody>${seeds.map(t => `<tr><td class="c-seed"><b>${t.seed}</b></td>
      <td class="nm"><div class="cn-in">${bkMark(t.name)}<a class="tlink" href="?team=${encodeURIComponent(t.name)}">${esc(t.name)}</a></div></td>
      <td class="num c-wl">${t.gp ? esc(bkRec(t)) : '—'}</td>
      <td class="num c-pct">${t.gp ? t.pct.toFixed(3).replace(/^0/, '') : '—'}</td>
      <td class="num c-marg">${t.gp ? (t.avg > 0 ? '+' : '') + t.avg.toFixed(1) : '—'}</td>
      <td class="nm c-tb">${esc(t.how || '')}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderBracket(){
  if (!ui.bracket) return;
  const box = $('#board'), S = SECTIONS[bk.cls];
  document.title = `Class ${bk.cls} Bracketology · Kansas Media Stats`;
  const head = `<section class="bcard bhead"><div class="bhead-top"><h1>Class ${bk.cls} Bracketology</h1></div>
    <p class="h-note" style="margin:0 0 10px">Where the playoff bracket would stand if the season ended today, seeded the way the KSHSAA does it:
      win-loss percentage first, then head-to-head when everyone tied has played everyone else, then average margin (13 points a game, 1 in overtime).
      The higher seed hosts, and the East and West champions meet for the title.</p>
    <div class="tp-links">${Object.keys(SECTIONS).map(c => `<a class="h-btn${c === bk.cls ? ' on' : ''}" href="?bracket=${c}">Class ${c}</a>`).join('')}</div></section>`;
  if (!allGames.list && !allGames.err) return void (box.innerHTML = head + '<section class="bcard"><p class="bempty">Loading the season…</p></section>');
  if (allGames.err) return void (box.innerHTML = head + `<section class="bcard"><p class="bempty">${esc(allGames.err)}</p></section>`);
  const east = bkSeed(S.East), west = bkSeed(S.West);
  const body = `<div class="bk-wrap bkt-wrap">${bkTreeHtml(east, 'East')}${bkTreeHtml(west, 'West')}</div>`;
  box.innerHTML = head
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>Week 9 matchups</h2></div>
        ${body}
        <p class="h-note pl-note">The higher seed hosts. Games are set after week 8, so these move every Friday.</p></section>`
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>How they're seeded</h2></div>${bkListHtml(east, 'East')}${bkListHtml(west, 'West')}</section>`;
}
