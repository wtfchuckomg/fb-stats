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

   Classes 3A, 2A and 1A, and both 8-player divisions, play for district
   places, and the top four in each district go on. A district's order:
     1. win-loss percentage in district games
     2. head-to-head, when everyone tied has played everyone else
     3. average margin in district games, 21 a game (1 in overtime);
        with three or more tied and no one who beat them all, the best
        margin takes the first place and the rest start over
     4. drawn by lot
   3A-1A: each half is seeded 1-16 by place — the champions 1-4, the
   runners-up 5-8, thirds 9-12, fourths 13-16 — and within a place by
   the 4A-6A order; the same week 9 pairs, the higher seed hosts.
   8-player: no seeding, the manual's bracket goes straight from the
   district places (D5 #1 plays D6 #4 …), and the #1 and #2 teams host.
   6-player isn't here: the manual's bracket is the 2025 one, drawn
   for districts of other sizes than 2026's four districts of seven.
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
// Classes 3A-1A and both 8-player divisions, district by district (FootballDistrictAssignments_26-27, this site's
// names). Districts 1-4 are the East, 5-8 the West.
const DISTRICTS = {
  '3A':[
    ["Columbus", "Frontenac", "Girard", "Iola", "Parsons"],
    ["Burlington", "Anderson County", "Prairie View", "Osawatomie", "Wellsville"],
    ["Baldwin", "Bishop Ward", "Perry-Lecompton", "Santa Fe Trail", "Hayden"],
    ["Atchison", "Hiawatha", "Holton", "Jefferson West", "Nemaha Central"],
    ["Chapman", "Clay Center", "Concordia", "Hesston", "Smoky Valley"],
    ["Andale", "Cheney", "Clearwater", "Wichita Collegiate", "Wichita Trinity"],
    ["Hoisington", "Larned", "Lyons", "Nickerson", "Pratt"],
    ["Colby", "Goodland", "Holcomb", "Hugoton", "Scott City"],
  ],
  '2A':[
    ["Baxter Springs", "Caney Valley", "Cherryvale", "Galena", "Riverton"],
    ["Fredonia", "Humboldt", "Neodesha", "Jayhawk-Linn", "Central Heights"],
    ["Osage City", "Oskaloosa", "West Franklin", "Maranatha", "Silver Lake"],
    ["Pleasant Ridge", "Horton", "Royal Valley", "Riverside", "Sabetha"],
    ["Council Grove", "Southeast of Saline", "Marysville", "Minneapolis", "Riley County"],
    ["Beloit", "Ellsworth", "Norton", "Phillipsburg", "Russell"],
    ["Douglass", "Garden Plain", "Halstead", "Haven", "Marion"],
    ["Chaparral", "Cimarron", "Kingman", "Southwestern Heights", "Lakin"],
  ],
  '1A':[
    ["Northeast", "Eureka", "Olpe", "St Mary's Colgan", "Uniontown"],
    ["Mission Valley", "Rossville", "St Marys", "Wabaunsee"],
    ["Maur Hill-Mount", "Atchison County", "Doniphan West", "McLouth", "Jefferson County North"],
    ["Valley Heights", "Centralia", "Jackson Heights", "Onaga", "Valley Falls"],
    ["Hillsboro", "Hutch Trinity", "Inman", "Moundridge", "Remington"],
    ["Republic County", "Thomas More Prep", "Plainville", "Sacred Heart", "Smith Center"],
    ["Belle Plaine", "Conway Springs", "Bluestem", "Sedgwick"],
    ["Ellinwood", "Medicine Lodge", "Sterling", "Syracuse"],
  ],
  '8M-I':[
    ["Southeast (Cherokee)", "Erie", "West Elk", "Oswego", "Yates Center"],
    ["Central Burden", "Cedar Vale-Dexter", "Oxford", "South Sumner", "Udall"],
    ["Northern Heights", "Chase County", "Lyndon", "Pleasanton", "Cair Paravel"],
    ["Canton-Galva", "Clifton-Clyde", "Herington", "Solomon", "Washington County"],
    ["Bennington", "Ell-Saline", "Lincoln", "Rock Hills", "WaKeeney-Trego"],
    ["Rawlins County", "Hill City", "Hoxie", "Oakley", "Decatur"],
    ["Central Plains", "Kiowa County", "South Central", "Spearville", "St John"],
    ["Elkhart", "Stanton County", "Wichita County", "South Gray", "Sublette"],
  ],
  '8M-II':[
    ["Colony-Crest", "Madison", "Marmaton Valley", "Flinthills", "Sedan", "St Paul"],
    ["Attica-Argonia", "Cunningham", "Hutch Central Christian", "Fairfield", "Norwich", "Pretty Prairie"],   // Wichita Independent isn't playing in 2026
    ["Burlingame", "Goessel", "Hartford", "Lebo", "Rural Vista", "Wakefield", "Waverly"],
    ["Axtell", "Frankfort", "Hanover", "Linn", "BV Randolph", "Troy"],
    ["Hodgman County", "Kinsley", "Macksville", "Meade", "Minneola", "Skyline"],
    ["Ellis", "La Crosse", "Little River", "Stafford", "Sylvan-Lucas Unified", "Victoria"],
    ["St John's", "Lakeside", "Thunder Ridge", "Osborne", "Pike Valley", "Stockton"],
    ["Dighton", "Ness City", "Quinter", "Wallace County", "St Francis", "Greeley County"],
  ],
};
const BK_CLASSES = ['6A', '5A', '4A', '3A', '2A', '1A', '8M-I', '8M-II'];
const bkTab = c => c === '8M-I' ? '8-Man I' : c === '8M-II' ? '8-Man II' : `Class ${c}`;
const bkLabel = c => c === '8M-I' ? '8-Man Division I' : c === '8M-II' ? '8-Man Division II' : `Class ${c}`;
// 8-player week 9, from the manual's bracket: [district, place] against [district, place].
const BK_8M = {
  East:[[[1, 1], [2, 4]], [[4, 2], [3, 3]], [[2, 1], [1, 4]], [[3, 2], [4, 3]], [[3, 1], [4, 4]], [[2, 2], [1, 3]], [[4, 1], [3, 4]], [[1, 2], [2, 3]]],
  West:[[[5, 1], [6, 4]], [[8, 2], [7, 3]], [[6, 1], [5, 4]], [[7, 2], [8, 3]], [[7, 1], [8, 4]], [[6, 2], [5, 3]], [[8, 1], [7, 4]], [[5, 2], [6, 3]]]};
const bk = {cls:'4A'};

async function startBracket(){
  ui.viewer = true; ui.bracket = true; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  const want = String(PAGE_Q.get('bracket') || '4A').toUpperCase();
  if (SECTIONS[want] || DISTRICTS[want]) bk.cls = want;
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

// Teams in the 4A-6A order: season percentage, head-to-head, 13-point margin.
function bkOrder(teams){
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
  return out;
}
// Seeds 1-16 in one section, by the manual's criteria in order.
const bkSeed = names => bkOrder(names.map(bkTeam)).slice(0, 16).map((t, i) => Object.assign(t, {seed:i + 1}));

// One district in place order (the criteria at the top). No district games yet reads as .500, as the league
// tables do. Past the margin the KSHSAA draws lots; before district play has settled much that's nearly everyone,
// so the projection goes on to the season's record and margin.
function bkDistrict(names){
  const inD = new Set(names.map(canonSchool));
  const teams = names.map(n => {
    const t = Object.assign(bkTeam(n), {dw:0, dl:0, dt:0, dgp:0, dmarg:0, dbeat:new Set(), dlost:new Set()});
    t.games.forEach(g => {
      const k = canonSchool(g.opp); if (!inD.has(k)) return;
      const cap = g.ot ? 1 : 21;
      t.dgp++; t.dmarg += Math.max(-cap, Math.min(cap, g.mine - g.theirs));
      if (g.mine > g.theirs){ t.dw++; t.dbeat.add(k); } else if (g.mine < g.theirs){ t.dl++; t.dlost.add(k); } else t.dt++;
    });
    t.dpct = t.dgp ? (t.dw + t.dt / 2) / t.dgp : .5;
    t.davg = t.dgp ? t.dmarg / t.dgp : 0;
    return t;
  });
  const settle = tied => {
    const done = []; let left = tied.slice(), how = '';
    while (left.length > 1){
      const k = t => canonSchool(t.name);
      const played = left.every(a => left.every(b => a === b || a.dbeat.has(k(b)) || a.dlost.has(k(b))));
      const top = played && left.find(a => left.every(b => a === b || a.dbeat.has(k(b))));
      const by = left.slice().sort((a, b) => b.davg - a.davg);
      let pick;
      if (top){ pick = top; how = 'head-to-head'; }
      else if (by[0].davg > by[1].davg){ pick = by[0]; how = '21-point margin'; }
      else { pick = by.filter(t => t.davg === by[0].davg).sort((a, b) => b.pct - a.pct || b.avg - a.avg || a.name.localeCompare(b.name))[0]; how = 'season record'; }
      done.push(Object.assign(pick, {dhow:how})); left = left.filter(t => t !== pick);
    }
    return done.concat(left.map(t => Object.assign(t, {dhow:how})));
  };
  const byPct = {};
  teams.forEach(t => { (byPct[t.dpct.toFixed(4)] = byPct[t.dpct.toFixed(4)] || []).push(t); });
  const out = [];
  Object.keys(byPct).sort((a, b) => b - a).forEach(p => {
    const g = byPct[p];
    if (g.length === 1) out.push(Object.assign(g[0], {dhow:''})); else out.push(...settle(g));
  });
  return out.map((t, i) => Object.assign(t, {place:i + 1}));
}
// 3A-1A: a half's four districts, already in place order, seeded 1-16 — a place at a time, by the 4A-6A order.
function bkDistrictSeeds(dists){
  const seeds = [];
  for (let p = 1; p <= 4; p++) bkOrder(dists.map(d => d[p - 1]).filter(Boolean)).forEach(t => seeds.push(t));
  return seeds.map((t, i) => Object.assign(t, {seed:i + 1}));
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
  return `<div class="bkp"><span class="bk-seed${t.tag ? ' tag' : ''}">${t.tag || t.seed}</span>${bkMark(t.name)}
    <a class="bk-nm" href="?team=${encodeURIComponent(t.name)}">${esc(t.name)}</a>
    <span class="bk-rec">${t.gp ? esc(bkRec(t)) : '<i>no games</i>'}</span></div>`;
}
function bkTreeHtml(seeds, side){
  const byNo = {}; seeds.forEach(t => { byNo[t.seed] = t; });
  const pairs = BK_PAIRS.map(([x, y]) => `<div class="bkt-pair">${bkPill(byNo[x])}${bkPill(byNo[y])}</div>`);
  return `<div class="bkt"><h3>${side}</h3>
    <div class="bkt-cols"><div class="bkt-col"><span class="bkt-h">Week 9</span><div class="bkt-pairs">${pairs.join('')}</div></div></div></div>`;
}
// 8-player: the manual's own pairs, each team shown by its district place.
function bk8Tree(by, side){
  const pill = ([d, p]) => { const t = by[d] && by[d][p - 1]; return bkPill(t ? Object.assign(t, {tag:`D${d} #${p}`}) : null); };
  return `<div class="bkt"><h3>${side}</h3>
    <div class="bkt-cols"><div class="bkt-col"><span class="bkt-h">Week 9</span><div class="bkt-pairs">${BK_8M[side].map(([a, b]) =>
      `<div class="bkt-pair">${pill(a)}${pill(b)}</div>`).join('')}</div></div></div></div>`;
}
// A district's standings; the teams past fourth don't go on.
function bkDistrictHtml(d, teams){
  return `<div class="bk-list"><h3>District ${d}</h3>
    <div class="tbl-wrap"><table class="ctbl bks-tbl"><thead><tr>
      <th class="c-seed">#</th><th class="nm">TEAM</th><th class="num c-wl">DIST</th>
      <th class="num c-pct">W-L</th><th class="num c-marg">MARGIN</th><th class="nm c-tb">TIEBREAK</th></tr></thead>
    <tbody>${teams.map(t => `<tr${t.place > 4 ? ' class="out"' : ''}><td class="c-seed"><b>${t.place}</b></td>
      <td class="nm"><div class="cn-in">${bkMark(t.name)}<a class="tlink" href="?team=${encodeURIComponent(t.name)}">${esc(t.name)}</a></div></td>
      <td class="num c-wl">${t.dw}-${t.dl}${t.dt ? `-${t.dt}` : ''}</td>
      <td class="num c-pct">${t.gp ? esc(bkRec(t)) : '—'}</td>
      <td class="num c-marg">${t.dgp ? (t.davg > 0 ? '+' : '') + t.davg.toFixed(1) : '—'}</td>
      <td class="nm c-tb">${esc(t.dhow || '')}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function bkListHtml(seeds, side){
  return `<div class="bk-list"><h3>${side}</h3>
    <div class="tbl-wrap"><table class="ctbl bks-tbl"><thead><tr>
      <th class="c-seed">SEED</th><th class="nm">TEAM</th><th class="num c-wl">W-L</th>
      <th class="num c-pct">PCT</th><th class="num c-marg">MARGIN</th><th class="nm c-tb">TIEBREAK</th></tr></thead>
    <tbody>${seeds.map(t => `<tr><td class="c-seed"><b>${t.seed}</b></td>
      <td class="nm"><div class="cn-in">${bkMark(t.name)}<a class="tlink" href="?team=${encodeURIComponent(t.name)}">${esc(t.name)}</a>${t.dtag ? `<span class="bk-dt">${esc(t.dtag)}</span>` : ''}</div></td>
      <td class="num c-wl">${t.gp ? esc(bkRec(t)) : '—'}</td>
      <td class="num c-pct">${t.gp ? t.pct.toFixed(3).replace(/^0/, '') : '—'}</td>
      <td class="num c-marg">${t.gp ? (t.avg > 0 ? '+' : '') + t.avg.toFixed(1) : '—'}</td>
      <td class="nm c-tb">${esc(t.how || '')}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderBracket(){
  if (!ui.bracket) return;
  const box = $('#board'), S = SECTIONS[bk.cls];
  document.title = `${bkLabel(bk.cls)} Bracketology · ${SITE_TITLE}`;
  const head = `<section class="bcard bhead"><div class="bhead-top"><h1>${bkLabel(bk.cls)} Bracketology</h1></div>
    <div class="tp-links">${BK_CLASSES.map(c => `<a class="h-btn${c === bk.cls ? ' on' : ''}" href="?bracket=${c}">${bkTab(c)}</a>`).join('')}</div></section>`;
  if (!allGames.list && !allGames.err) return void (box.innerHTML = head + '<section class="bcard"><p class="bempty">Loading the season…</p></section>');
  if (allGames.err) return void (box.innerHTML = head + `<section class="bcard"><p class="bempty">${esc(allGames.err)}</p></section>`);
  if (DISTRICTS[bk.cls]) return renderDistricts(box, head);
  const east = bkSeed(S.East), west = bkSeed(S.West);
  const body = `<div class="bk-wrap bkt-wrap">${bkTreeHtml(east, 'East')}${bkTreeHtml(west, 'West')}</div>`;
  box.innerHTML = head
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>Week 9 matchups</h2></div>
        ${body}
        <p class="h-note pl-note">The higher seed hosts. Games are set after week 8, so these move every Friday.</p></section>`
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>How they're seeded</h2></div>${bkListHtml(east, 'East')}${bkListHtml(west, 'West')}</section>`;
}
// 3A-1A and 8-player: the districts first, then the bracket they make.
function renderDistricts(box, head){
  const D = DISTRICTS[bk.cls].map((names, i) => bkDistrict(names).map(t => Object.assign(t, {dtag:`D${i + 1} #${t.place}`})));
  const eight = bk.cls.startsWith('8M');
  let trees, seeded = '';
  if (eight){
    const by = {}; D.forEach((d, i) => { by[i + 1] = d; });
    trees = bk8Tree(by, 'East') + bk8Tree(by, 'West');
  } else {
    const east = bkDistrictSeeds(D.slice(0, 4)), west = bkDistrictSeeds(D.slice(4, 8));
    trees = bkTreeHtml(east, 'East') + bkTreeHtml(west, 'West');
    seeded = `<section class="bcard ccard"><div class="ccard-hd"><h2>How they're seeded</h2></div>${bkListHtml(east, 'East')}${bkListHtml(west, 'West')}</section>`;
  }
  box.innerHTML = head
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>Week 9 matchups</h2></div>
        <div class="bk-wrap bkt-wrap">${trees}</div>
        <p class="h-note pl-note">${eight ? 'District champions and runners-up host.' : 'The higher seed hosts.'} Games are set after week 8, so these move every Friday.</p></section>`
    + seeded
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>District standings</h2></div>${D.map((d, i) => bkDistrictHtml(i + 1, d)).join('')}</section>`;
}
