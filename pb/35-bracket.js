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
    ["Northeast-Arma", "Eureka", "Olpe", "St Mary's Colgan", "Uniontown"],
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
    ["Hodgeman County", "Kinsley", "Macksville", "Meade", "Minneola", "Skyline"],
    ["Ellis", "La Crosse", "Little River", "Stafford", "Sylvan-Lucas Unified", "Victoria"],
    ["St John's", "Lakeside", "Thunder Ridge", "Osborne", "Pike Valley", "Stockton"],
    ["Dighton", "Ness City", "Quinter", "Wallace County", "St Francis", "Greeley County"],
  ],
  // 6-player: four districts of seven, and all 28 go to the playoffs (Chuck, 2026-10-23; KSHSAA bracket 6442).
  // The district list spells Satanta "Santana".
  '6M':[
    ["Altoona-Midway", "Chetopa", "Southern Coffey County", "Centre", "Elyria Christian", "Marais des Cygnes Valley", "Peabody-Burns"],
    ["Chase", "Logan", "Otis-Bison", "Palco", "Western Plains", "Pawnee Heights", "Tescott"],
    ["Ashland", "Bucklin", "Deerfield", "Ingalls", "South Barber", "Moscow", "Satanta"],
    ["Northern Valley", "Cheylin", "Brewster", "Wheatland-Grinnell", "Golden Plains", "Weskan", "Winona-Triplains"],
  ],
};
const BK_CLASSES = ['6A', '5A', '4A', '3A', '2A', '1A', '8M-I', '8M-II', '6M'];
const bkTab = c => c === '8M-I' ? '8-Man I' : c === '8M-II' ? '8-Man II' : c === '6M' ? '6-Man' : `Class ${c}`;
const bkLabel = c => c === '8M-I' ? '8-Man Division I' : c === '8M-II' ? '8-Man Division II' : c === '6M' ? '6-Man' : `Class ${c}`;
// How many from each district go on: four, except 6-player, where all seven do.
const bkCut = c => c === '6M' ? 7 : 4;
// 8-player week 9, from the manual's bracket: [district, place] against [district, place].
const BK_8M = {
  East:[[[1, 1], [2, 4]], [[4, 2], [3, 3]], [[2, 1], [1, 4]], [[3, 2], [4, 3]], [[3, 1], [4, 4]], [[2, 2], [1, 3]], [[4, 1], [3, 4]], [[1, 2], [2, 3]]],
  West:[[[5, 1], [6, 4]], [[8, 2], [7, 3]], [[6, 1], [5, 4]], [[7, 2], [8, 3]], [[7, 1], [8, 4]], [[6, 2], [5, 3]], [[8, 1], [7, 4]], [[5, 2], [6, 3]]]};
// 6-player week 9, KSHSAA's 2026 bracket (6442): each district champion has a bye (null). Districts 1-2 are the
// East, 3-4 the West; the KSHSAA draws the West on top.
const BK_6M = {
  East:[[[1, 1], null], [[2, 4], [1, 5]], [[2, 2], [1, 7]], [[1, 3], [2, 6]], [[2, 1], null], [[1, 4], [2, 5]], [[1, 2], [2, 7]], [[2, 3], [1, 6]]],
  West:[[[3, 1], null], [[4, 4], [3, 5]], [[4, 2], [3, 7]], [[3, 3], [4, 6]], [[4, 1], null], [[3, 4], [4, 5]], [[3, 2], [4, 7]], [[4, 3], [3, 6]]]};
const bk = {cls:'4A'};

async function startBracket(){
  ui.viewer = true; ui.bracket = true; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  const want = String(PAGE_Q.get('bracket') || '4A').toUpperCase();
  if (SECTIONS[want] || DISTRICTS[want]) bk.cls = want;
  loadLogos();
  renderBracket();
  // On the site itself the address becomes the brackets' link card (po/?c=<class>), so the link people copy shows
  // the card and still opens this class. The base keeps the page's own links pointing at the site.
  if (location.hostname === 'stats.kansasmediarankings.com' && !location.pathname.startsWith('/po/')){
    if (!document.querySelector('base')){ const b = document.createElement('base'); b.href = '/'; document.head.prepend(b); }
    history.replaceState(null, '', `/po/?c=${encodeURIComponent(bk.cls)}`);
  }
  // The admin's own devices sign in here too, to settle coin flips.
  let admin = false; try { admin = localStorage.getItem('pressbox.admin') === '1'; } catch (e) {}
  try {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-`;
    const [appM, fsM, authM] = await Promise.all(['app', 'firestore', ...(admin ? ['auth'] : [])].map(m => import(base + m + '.js')));
    const app = appM.initializeApp(firebaseConfig);
    if (authM) authM.onAuthStateChanged(authM.getAuth(app), u => { ui.admin = !!u && u.uid === ADMIN_UID; renderBracket(); });
    const fsdb = fsM.getFirestore(app);
    scoresReady({fsM, fsdb});
    watchFlips({fsM, fsdb});
  } catch (e) { allGames.err = 'Can’t reach the games. Check your connection and reload.'; renderBracket(); }
}

/* ---------- coin flips, as the KSHSAA calls them ----------
   The admin taps the team that won each flip on the bracketology page (Chuck, 2026-10-23: "a button as admin").
   One shared list, like the team records: only the admin's account writes it, anyone reads it. Each tie is
   "<season>|<class>|<schools in it>" and holds the schools in the order the flips put them (the winner first;
   in a three-way, the next one tapped is second, and so on). */
const FLIPS_DOC = 'bracket-flips';
const flips = {map:{}, api:null};
function watchFlips(api){
  flips.api = api;
  const {fsM, fsdb} = api;
  fsM.onSnapshot(fsM.doc(fsdb, 'pressbox', FLIPS_DOC), snap => {
    const d = snap.exists() ? snap.data() : null;
    let map = {}; if (d && d.owner === ADMIN_UID && !d.deleted){ try { map = JSON.parse(d.json).flips || {}; } catch (e) {} }
    flips.map = map; renderBracket();
  }, () => {});
}
const flipKey = group => `${BK_WEEK8_END.slice(0, 4)}|${bk.cls}|${group.map(t => canonSchool(t.name)).sort().join(',')}`;
// The order the flips gave for a tie among `group`, from a settled tie that takes them all in (a three-way flip
// covers the two-way tie left after it). Null when none has been settled.
function flipOrder(group){
  const want = group.map(t => canonSchool(t.name)), pre = `${BK_WEEK8_END.slice(0, 4)}|${bk.cls}|`;
  for (const [k, order] of Object.entries(flips.map)){
    if (!k.startsWith(pre)) continue;
    const names = k.slice(pre.length).split(',');
    if (want.every(n => names.includes(n)) && order.some(n => want.includes(n))) return {key:k, order};
  }
  return null;
}
async function saveFlips(map){
  if (!ui.admin || !flips.api) return toast('Sign in on the Game Tracker to settle a coin flip');
  flips.map = map; renderBracket();
  const {fsM, fsdb} = flips.api;
  try {
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', FLIPS_DOC), {owner:ADMIN_UID, updated:Date.now(), public:true, kind:'flips',
      title:'Coin flips', json:JSON.stringify({flips:map})});
  } catch (e) { toast('Couldn’t save that. Sign in on the Game Tracker, then try again.'); }
}
document.addEventListener('click', e => {
  if (!ui.bracket || !ui.admin || !e.target.closest) return;
  const b = e.target.closest('[data-flip-key]'); if (!b) return;
  e.preventDefault();
  const k = b.dataset.flipKey, map = Object.assign({}, flips.map);
  if (b.dataset.flipWin){
    const order = (map[k] || []).filter(n => n !== b.dataset.flipWin);
    map[k] = order.concat(b.dataset.flipWin);
    toast(`${b.dataset.flipName} won the flip`);
  } else { delete map[k]; toast('Coin flip cleared'); }
  saveFlips(map);
});

// One school's season so far: record, and the average margin the KSHSAA counts (13 a game, 1 in overtime).
function bkTeam(name){
  const t = {name, w:0, l:0, t:0, gp:0, marg:0, beat:new Set(), lost:new Set(), games:[], left:[]};
  schoolRows(name).forEach(({x, side, opp}) => {
    const f = finalOf(x);
    // Not played yet (or no final on file): one of the games that can still move it, through week 8.
    if (!f.fin || !f.score){ if (gameDay(x) <= fromYmd(BK_WEEK8_END)) t.left.push({opp:x.teams[opp].name, key:`${ymd(gameDay(x))}|${[canonSchool(name), canonSchool(x.teams[opp].name)].sort().join('|')}`}); return; }
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
// A tie nothing in the manual can break once the games are done goes to the KSHSAA's coin flip (Chuck,
// 2026-10-23): every team in it is marked, and its line in the bracket carries all of them ("AND / KMC").
// Only once each of them has played its last game: an exact tie with games left is just where things stand.
const bkSame = (a, b) => Math.abs(a - b) < 1e-9;
function bkLot(group, left){
  if (group.length < 2 || group.some(t => left(t).length)) return false;
  // A flip that leads into another tie (three level, the flip picks one, the other two are level again) is one
  // flip as far as the bracket goes: any of them can end up on any of those lines, so the groups join.
  const all = new Set(group); group.forEach(t => (t.lotWith || []).forEach(x => all.add(x)));
  const joined = [...all];
  joined.forEach(t => Object.assign(t, {lotWith:joined}));
  return true;
}
function bkOrder(teams){
  const byPct = {};
  teams.forEach(t => { (byPct[t.pct.toFixed(4)] = byPct[t.pct.toFixed(4)] || []).push(t); });
  const out = [];
  Object.keys(byPct).sort((a, b) => b - a).forEach(k => {
    const tied = byPct[k];
    if (tied.length === 1) return out.push(Object.assign(tied[0], {how:''}));
    out.push(...bkSettle(tied, {beat:'beat', lost:'lost', marg:t => t.avg, mhow:'13-point margin', left:t => t.left}));
  });
  return out;
}
// Teams level on percentage, sorted the KSHSAA's way (Chuck, 2026-10-23: "follow the procedure"):
//   1. head-to-head, while everyone still level has played everyone else and one of them has the most wins over
//      the rest: that one takes the place (two teams that played: the winner);
//   2. otherwise the margin (13-point here, 21-point in a district) orders all of them at once;
//   3. teams level on the margin as well go to a coin flip;
//   4. after a flip, the ones left go back to 1: head-to-head, then the margin, then another flip.
// The margin is never followed by head-to-head: Anderson County, Osawatomie and Prairie View (3A District 2) each
// beat one of the others, so the margin ranks all three — Anderson County, Prairie View, Osawatomie — and
// Osawatomie's win over Prairie View doesn't come back into it; Hutchinson and Maize South, level on the margin,
// flip. A flip with games still to play is only where things stand, so it reads as the margin until all are done.
// Ties Chuck sends straight to the coin flip, head-to-head or not: "<season>|<class>|<schools>" (2026-10-23:
// "undo the head to head with maize south"). Under the procedure above they flip anyway; kept so his call stands.
const BK_FLIP_ONLY = new Set(['2026|5A|hutchinson,maize-south']);
function bkSettle(group, o){
  const k = t => canonSchool(t.name), out = [];
  const flipOnly = g => BK_FLIP_ONLY.has(`${BK_WEEK8_END.slice(0, 4)}|${bk.cls}|${g.map(k).sort().join(',')}`);
  const played = g => !flipOnly(g) && g.every(a => g.every(b => a === b || a[o.beat].has(k(b)) || a[o.lost].has(k(b))));
  const wins = (t, g) => g.filter(x => x !== t && t[o.beat].has(k(x))).length;
  let rest = group.slice();
  // 1. Head-to-head, one place at a time while it decides.
  while (rest.length > 1 && played(rest)){
    const m = Math.max(...rest.map(t => wins(t, rest))), top = rest.filter(t => wins(t, rest) === m);
    if (top.length !== 1) break;
    out.push(Object.assign(top[0], {how:'head-to-head'})); rest = rest.filter(t => t !== top[0]);
  }
  if (rest.length === 1) return out.concat(Object.assign(rest[0], {how:out.length ? 'head-to-head' : ''}));
  // 2. The margin, all of them at once; 3. a flip among any still level on it.
  const runs = [];
  rest.slice().sort((a, b) => o.marg(b) - o.marg(a) || a.name.localeCompare(b.name)).forEach(t => {
    const r = runs.length && bkSame(o.marg(runs[runs.length - 1][0]), o.marg(t)) ? runs[runs.length - 1] : null;
    if (r) r.push(t); else runs.push([t]);
  });
  runs.forEach(run => {
    if (run.length === 1) return out.push(Object.assign(run[0], {how:o.mhow}));
    const done = !run.some(t => o.left(t).length), f = done ? flipOrder(run) : null;
    const won = f && run.filter(t => f.order.includes(k(t))).sort((a, b) => f.order.indexOf(k(a)) - f.order.indexOf(k(b)))[0];
    if (won){
      // 4. Settled by the admin: the winner takes the place, and the rest start over.
      out.push(Object.assign(won, {how:'coin flip', flipKey:f.key}));
      const left = run.filter(t => t !== won);
      if (left.length === 1) out.push(Object.assign(left[0], {how:'coin flip'}));
      else out.push(...bkSettle(left, o));
      return;
    }
    bkLot(run, o.left);
    // Not flipped yet: the line carries them all; the projection goes on to the season's record and margin.
    run.sort((a, b) => b.pct - a.pct || b.avg - a.avg || a.name.localeCompare(b.name))
      .forEach(t => out.push(Object.assign(t, {how:done ? 'coin flip' : o.proj || o.mhow})));
  });
  return out;
}
// The last day of week 8: games after it don't count toward seeding (the manual's weeks 1-8).
const BK_WEEK8_END = '2026-10-24';
// Locked (Chuck, 2026-10-22): a team that stays exactly where it is whatever happens in the games still to play.
// val(t, w, l) is the number it's ranked by after w more wins and l more losses; games(t) the games that can change
// it; B names its head-to-head sets ('beat'/'lost', or 'dbeat'/'dlost' in a district). Teams whose best and worst
// can't reach this one's are always above or below it. The rest, and every game any of them has left, are played
// out every way: locked means each finishes on the same side of it every time. Level on percentage is settled by
// head-to-head when all the tied teams have played each other and it puts them in a clear order; otherwise it
// goes to a margin nobody can know yet, and the team isn't locked.
function bkLocks(teams, val, games, B = ['beat', 'lost']){
  const out = new Set(), key = t => canonSchool(t.name);
  const lo = t => val(t, 0, games(t).length), hi = t => val(t, games(t).length, 0);
  teams.forEach(x => {
    const near = teams.filter(y => y !== x && !(lo(y) > hi(x) || hi(y) < lo(x)));
    if (!near.length) return out.add(key(x));
    // Its record final, and every record it could be level with too: nothing left to play can move it (Chuck,
    // 2026-10-23: "all teams should be bold if their record is finalized"). A tie still to be broken is broken by
    // what's already happened — head-to-head, the margin, or the KSHSAA's coin flip.
    if (!games(x).length && near.every(y => !games(y).length)) return out.add(key(x));
    const who = [x, ...near], gm = new Map();
    who.forEach(t => games(t).forEach(g => gm.set(g.key, g)));
    const list = [...gm.keys()];
    if (list.length > 14) return;          // too many to play out: leave it unmarked
    const side = new Map();
    for (let m = 0; m < 1 << list.length; m++){
      // Bit i set: the first school in game i's key wins it, otherwise the second.
      const won = new Map(list.map((k, i) => { const p = k.split('|'); return [k, m >> i & 1 ? p[1] : p[2]]; }));
      const v = new Map(who.map(t => { const mine = games(t), w = mine.filter(g => won.get(g.key) === key(t)).length;
        return [t, val(t, w, mine.length - w).toFixed(6)]; }));
      const beats = (a, b) => a[B[0]].has(key(b)) || list.some(k => won.get(k) === key(a) && k.split('|').includes(key(b)));
      const tied = who.filter(t => v.get(t) === v.get(x));
      const clear = tied.every(a => tied.every(b => a === b || beats(a, b) || beats(b, a)));
      const h2h = t => tied.filter(o => o !== t && beats(t, o)).length;
      for (const y of near){
        let d;
        if (v.get(y) !== v.get(x)) d = Math.sign(v.get(y) - v.get(x));
        else { if (!clear || h2h(y) === h2h(x)) return; d = Math.sign(h2h(y) - h2h(x)); }
        if (!side.has(y)) side.set(y, d); else if (side.get(y) !== d) return;
      }
    }
    out.add(key(x));
  });
  return out;
}
// Out (Chuck, 2026-10-22): a district team that can't finish in the top `cut` (four go to the playoffs) however the
// games left go. Played out the same way as bkLocks: in every outcome at least `cut` teams finish ahead of it, a tie
// counting as ahead only when head-to-head puts them in front for certain — a tie that goes to margin could go its way.
function bkOut(teams, val, games, B, cut = 4){
  const out = new Set(), key = t => canonSchool(t.name);
  const lo = t => val(t, 0, games(t).length), hi = t => val(t, games(t).length, 0);
  teams.forEach(x => {
    const above = teams.filter(y => y !== x && lo(y) > hi(x)).length;
    if (above >= cut) return out.add(key(x));
    const near = teams.filter(y => y !== x && !(lo(y) > hi(x) || hi(y) < lo(x)));
    if (above + near.length < cut) return;
    const who = [x, ...near], gm = new Map();
    who.forEach(t => games(t).forEach(g => gm.set(g.key, g)));
    const list = [...gm.keys()];
    if (list.length > 14) return;
    for (let m = 0; m < 1 << list.length; m++){
      const won = new Map(list.map((k, i) => { const p = k.split('|'); return [k, m >> i & 1 ? p[1] : p[2]]; }));
      const v = new Map(who.map(t => { const mine = games(t), w = mine.filter(g => won.get(g.key) === key(t)).length;
        return [t, val(t, w, mine.length - w).toFixed(6)]; }));
      const beats = (a, b) => a[B[0]].has(key(b)) || list.some(k => won.get(k) === key(a) && k.split('|').includes(key(b)));
      const tied = who.filter(t => v.get(t) === v.get(x));
      const clear = tied.every(a => tied.every(b => a === b || beats(a, b) || beats(b, a)));
      const h2h = t => tied.filter(o => o !== t && beats(t, o)).length;
      const ahead = near.filter(y => v.get(y) !== v.get(x) ? +v.get(y) > +v.get(x) : clear && h2h(y) > h2h(x)).length;
      if (above + ahead < cut) return;      // this way it gets in
    }
    out.add(key(x));
  });
  return out;
}
// Season percentage after more results, and the district's (no district games yet is .500, as bkDistrict has it).
const bkPctAfter = (t, w, l) => { const n = t.gp + w + l; return n ? (t.w + w + t.t / 2) / n : 0; };
const bkDpctAfter = (t, w, l) => { const n = t.dgp + w + l; return n ? (t.dw + w + t.dt / 2) / n : .5; };
// Seeds 1-16 in one section, by the manual's criteria in order.
function bkSeed(names){
  const all = bkOrder(names.map(bkTeam)), locks = bkLocks(all, bkPctAfter, t => t.left);
  return all.slice(0, 16).map((t, i) => Object.assign(t, {seed:i + 1, lock:locks.has(canonSchool(t.name))}));
}

// One district in place order (the criteria at the top). No district games yet reads as .500, as the league
// tables do. Past the margin the KSHSAA draws lots; before district play has settled much that's nearly everyone,
// so the projection goes on to the season's record and margin.
function bkDistrict(names, cut = 4){
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
    t.dleft = t.left.filter(g => inD.has(canonSchool(g.opp)));   // district games still to play
    t.davg = t.dgp ? t.dmarg / t.dgp : 0;
    return t;
  });
  // The same procedure as the 4A-6A seeds (bkSettle), on district games and the 21-point margin.
  const settle = tied => bkSettle(tied, {beat:'dbeat', lost:'dlost', marg:t => t.davg, mhow:'21-point margin', proj:'season record', left:t => t.dleft})
    .map(t => Object.assign(t, {dhow:t.how}));
  const byPct = {};
  teams.forEach(t => { (byPct[t.dpct.toFixed(4)] = byPct[t.dpct.toFixed(4)] || []).push(t); });
  const out = [];
  Object.keys(byPct).sort((a, b) => b - a).forEach(p => {
    const g = byPct[p];
    if (g.length === 1) out.push(Object.assign(g[0], {dhow:''})); else out.push(...settle(g));
  });
  const locks = bkLocks(out, bkDpctAfter, t => t.dleft, ['dbeat', 'dlost']), gone = bkOut(out, bkDpctAfter, t => t.dleft, ['dbeat', 'dlost'], cut);
  // Every district game played: below the cut is out, unless a coin flip still to come could lift it over the line.
  if (out.every(t => !t.dleft.length)) out.forEach((t, i) => {
    const flipIn = t.lotWith && t.lotWith.some(x => out.indexOf(x) < cut);
    if (i >= cut && !flipIn) gone.add(canonSchool(t.name));
  });
  return out.map((t, i) => Object.assign(t, {place:i + 1, placeLock:locks.has(canonSchool(t.name)), elim:gone.has(canonSchool(t.name))},
    t.lotWith ? {dhow:'coin flip'} : {}));
}
// 3A-1A: a half's four districts, already in place order, seeded 1-16 — a place at a time, by the 4A-6A order.
function bkDistrictSeeds(dists){
  const seeds = [];
  for (let p = 1; p <= 4; p++){
    // A seed is locked once every district's team at this place is, and the order among them can't change.
    const tier = dists.map(d => d[p - 1]).filter(Boolean);
    const locks = tier.length === dists.length && tier.every(t => t.placeLock) ? bkLocks(tier, bkPctAfter, t => t.left) : new Set();
    bkOrder(tier).forEach(t => seeds.push(Object.assign(t, {lock:locks.has(canonSchool(t.name))})));
  }
  return seeds.map((t, i) => Object.assign(t, {seed:i + 1}));
}

// The admin can take back a settled flip from the standings (a tap on the wrong team).
const bkUndo = t => ui.admin && t.flipKey ? ` <button type="button" class="bk-undo" data-flip-key="${esc(t.flipKey)}">Undo</button>` : '';
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
  // Going to a coin flip: this line belongs to any of them, so it carries them all.
  if (t.lotWith){
    const L = t.lotWith, recs = [...new Set(L.map(bkRec))];
    return `<div class="bkp lot" title="${esc(L.map(x => x.name).join(' or ') + ': KSHSAA coin flip')}"><span class="bk-seed${t.tag ? ' tag' : ''}">${t.tag || t.seed}</span>${L.map(x => bkMark(x.name)).join('')}
      <span class="bk-nm">${L.map(x => ui.admin
        ? `<button type="button" class="bk-flipbtn" data-flip-key="${esc(flipKey(L))}" data-flip-win="${esc(canonSchool(x.name))}" data-flip-name="${esc(x.name)}" title="${esc(x.name)} won the flip">${esc(listAbbr(x.name) || shortName(x.name))}</button>`
        : `<a href="?team=${encodeURIComponent(x.name)}">${esc(listAbbr(x.name) || shortName(x.name))}</a>`).join(' / ')}</span>
      <span class="bk-rec">${recs.length === 1 ? esc(recs[0]) : ''}</span></div>`;
  }
  return `<div class="bkp"><span class="bk-seed${t.tag ? ' tag' : ''}">${t.tag || t.seed}</span>${bkMark(t.name)}
    <a class="bk-nm${t.lock ? ' locked' : ''}" href="?team=${encodeURIComponent(t.name)}">${esc(t.name)}</a>
    <span class="bk-rec">${t.gp ? esc(bkRec(t)) : '<i>no games</i>'}</span></div>`;
}
function bkTreeHtml(seeds, side){
  const byNo = {}; seeds.forEach(t => { byNo[t.seed] = t; });
  const pairs = BK_PAIRS.map(([x, y]) => `<div class="bkt-pair">${bkPill(byNo[x])}${bkPill(byNo[y])}</div>`);
  return `<div class="bkt"><h3>${side}</h3>
    <div class="bkt-cols"><div class="bkt-col"><span class="bkt-h">Week 9</span><div class="bkt-pairs">${pairs.join('')}</div></div></div></div>`;
}
// 8-player: the manual's own pairs, each team shown by its district place.
function bk8Tree(by, side, pairs = BK_8M){
  const pill = slot => { if (!slot) return `<div class="bkp bye"><span class="bk-nm">Bye</span></div>`;
    const [d, p] = slot, t = by[d] && by[d][p - 1]; return bkPill(t ? Object.assign(t, {tag:`D${d} #${p}`, lock:t.placeLock}) : null); };
  return `<div class="bkt"><h3>${side}</h3>
    <div class="bkt-cols"><div class="bkt-col"><span class="bkt-h">Week 9</span><div class="bkt-pairs">${pairs[side].map(([a, b]) =>
      `<div class="bkt-pair">${pill(a)}${pill(b)}</div>`).join('')}</div></div></div></div>`;
}
/* ---------- the whole bracket, on a desktop (Chuck, 2026-10-23: "a left and a right bracket when it's full on a
   desktop computer now that we're finalizing") ----------
   East on the left reading right, West on the right reading left: Week 9, Regional, Sectional, Sub-State, and State
   in the middle. Each side is its 16 lines in bracket order, so neighbouring pairs meet in the next round. A pair
   moves on only when its game is final on the site (played after week 8): the winner goes through, and both lines
   show that game's score. Until then the later rounds are open. A phone, or a narrower window, keeps the list. */
const BYE = {bye:true};
const bkSlots = (seeds) => { const byNo = {}; seeds.forEach(t => { byNo[t.seed] = t; }); return BK_PAIRS.flat().map(n => byNo[n] || null); };
const bk8Slots = (by, side, pairs) => pairs[side].flat().map(slot => {
  if (!slot) return BYE;
  const [d, p] = slot, t = by[d] && by[d][p - 1];
  return t ? Object.assign(t, {tag:`D${d} #${p}`, lock:t.placeLock}) : null;
});
// The playoff game between two teams, once it's final: who won, and each one's points.
function bkPlayed(a, b){
  if (!a || !b || a.bye || b.bye) return null;
  const want = canonSchool(b.name), after = fromYmd(BK_WEEK8_END);
  for (const r of schoolRows(a.name)){
    if (gameDay(r.x) <= after || canonSchool(r.x.teams[r.opp].name) !== want) continue;
    const f = finalOf(r.x); if (!f.fin || !f.score) continue;
    const pa = +f.score[r.side], pb = +f.score[r.opp];
    if (pa === pb) continue;
    return {win:pa > pb ? a : b, pts:new Map([[a, pa], [b, pb]])};
  }
  return null;
}
// One round's lines in, the next round's lines out (a bye goes straight through), with each game's result.
function bkAdvance(slots){
  const next = [], games = [];
  for (let i = 0; i < slots.length; i += 2){
    const a = slots[i], b = slots[i + 1];
    if (a && a.bye) { next.push(b || null); games.push(null); continue; }
    if (b && b.bye) { next.push(a || null); games.push(null); continue; }
    const g2 = bkPlayed(a, b); next.push(g2 ? g2.win : null); games.push(g2);
  }
  return {next, games};
}
function bkLine(t, game, small){
  if (t && t.bye) return `<div class="bkp bye"><span class="bk-nm">Bye</span></div>`;
  if (!t) return `<div class="bkp empty"><span class="bk-nm">&nbsp;</span></div>`;
  if (!small && !game) return bkPill(t);
  const won = game && game.win === t, lost = game && game.win !== t;
  // A short code in the narrow rounds: the school's own if it is one ("AND"), otherwise its initials ("ING", "PB").
  const code = n => { const a = listAbbr(n); return a && a.length <= 5 ? a : initialsOf(n); };
  const nm = small ? esc(code(t.name)) : esc(t.name);
  // Past week 9 the boxes are narrow: the logo and short name, no seed.
  return `<div class="bkp${small ? ' sm' : ''}${lost ? ' lost' : ''}">${small ? '' : `<span class="bk-seed${t.tag ? ' tag' : ''}">${t.tag || t.seed}</span>`}${bkMark(t.name)}
    <a class="bk-nm${won ? ' locked' : ''}" href="?team=${encodeURIComponent(t.name)}" title="${esc(t.name)}">${nm}</a>
    <span class="bk-rec">${game ? `<b>${game.pts.get(t)}</b>` : small ? '' : t.gp ? esc(bkRec(t)) : ''}</span></div>`;
}
function bkFullHtml(eastSlots, westSlots){
  const ROUNDS = ['Week 9', 'Regional', 'Sectional', 'Sub-State'];
  const side = slots => { const cols = []; let cur = slots;
    for (let r = 0; r < 4; r++){ const {next, games} = bkAdvance(cur); cols.push({slots:cur, games}); cur = next; }
    return {cols, champ:cur[0] || null}; };
  const E = side(eastSlots), W = side(westSlots);
  const col = (c, r, west) => `<div class="bkf-col${west ? ' w' : ''}"><span class="bkt-h">${ROUNDS[r]}</span><div class="bkf-pairs">${c.games.map((gm, i) =>
    `<div class="bkt-pair">${bkLine(c.slots[2 * i], gm, r > 0)}${bkLine(c.slots[2 * i + 1], gm, r > 0)}</div>`).join('')}</div></div>`;
  const fin = bkPlayed(E.champ, W.champ);
  return `<div class="bkf">${E.cols.map((c, r) => col(c, r, false)).join('')}
    <div class="bkf-col st"><span class="bkt-h">State</span><div class="bkf-pairs"><div class="bkt-pair st">${bkLine(E.champ, fin, true)}${bkLine(W.champ, fin, true)}</div></div></div>
    ${W.cols.map((c, r) => col(c, r, true)).reverse().join('')}</div>
    <div class="bkf-sides"><span>East</span><span>West</span></div>`;
}
// A district's standings; the teams past fourth don't go on.
function bkDistrictHtml(d, teams){
  return `<div class="bk-list"><h3>District ${d}</h3>
    <div class="tbl-wrap"><table class="ctbl bks-tbl"><thead><tr>
      <th class="c-seed">#</th><th class="nm">TEAM</th><th class="num c-wl">DIST</th>
      <th class="num c-pct">W-L</th><th class="num c-marg">MARGIN</th><th class="nm c-tb">TIEBREAK</th></tr></thead>
    <tbody>${teams.map(t => `<tr${t.place > bkCut(bk.cls) ? ' class="out"' : ''}><td class="c-seed"><b>${t.place}</b></td>
      <td class="nm"><div class="cn-in">${bkMark(t.name)}<a class="tlink${t.placeLock ? ` locked${t.place === 1 && !t.lotWith ? ' dlock' : ''}` : ''}${t.elim ? ' elim' : ''}" href="?team=${encodeURIComponent(t.name)}">${esc(t.name)}</a></div></td>
      <td class="num c-wl">${t.dw}-${t.dl}${t.dt ? `-${t.dt}` : ''}</td>
      <td class="num c-pct">${t.gp ? esc(bkRec(t)) : '—'}</td>
      <td class="num c-marg">${t.dgp ? (t.davg > 0 ? '+' : '') + t.davg.toFixed(1) : '—'}</td>
      <td class="nm c-tb">${esc(t.dhow || '')}${bkUndo(t)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function bkListHtml(seeds, side){
  return `<div class="bk-list"><h3>${side}</h3>
    <div class="tbl-wrap"><table class="ctbl bks-tbl"><thead><tr>
      <th class="c-seed">SEED</th><th class="nm">TEAM</th><th class="num c-wl">W-L</th>
      <th class="num c-pct">PCT</th><th class="num c-marg">MARGIN</th><th class="nm c-tb">TIEBREAK</th></tr></thead>
    <tbody>${seeds.map(t => `<tr><td class="c-seed"><b>${t.seed}</b></td>
      <td class="nm"><div class="cn-in">${bkMark(t.name)}<a class="tlink${t.lock ? ' locked' : ''}" href="?team=${encodeURIComponent(t.name)}">${esc(t.name)}</a>${t.dtag ? `<span class="bk-dt">${esc(t.dtag)}</span>` : ''}</div></td>
      <td class="num c-wl">${t.gp ? esc(bkRec(t)) : '—'}</td>
      <td class="num c-pct">${t.gp ? t.pct.toFixed(3).replace(/^0/, '') : '—'}</td>
      <td class="num c-marg">${t.gp ? (t.avg > 0 ? '+' : '') + t.avg.toFixed(1) : '—'}</td>
      <td class="nm c-tb">${esc(t.how || '')}${bkUndo(t)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

// What the marks mean (Chuck, 2026-10-23): bold everywhere; underline and strikethrough only where districts are.
const bkLegend = (districts, outs = districts) => `<div class="bk-legend"><span><b class="lg-lock">Bold</b> Locked into its spot</span>${districts
  ? '<span><b class="lg-lock lg-win">Underlined</b> Clinched the district</span>' : ''}${outs ? '<span><b class="lg-out">Struck through</b> Eliminated</span>' : ''}</div>`;
function renderBracket(){
  if (!ui.bracket) return;
  const box = $('#board'), S = SECTIONS[bk.cls];
  // The 2026 Playoffs tab (Chuck, 2026-10-23): with the regular season done, the page is the playoff bracket.
  const title = `${BK_WEEK8_END.slice(0, 4)} ${bkLabel(bk.cls)} Playoffs`;
  document.title = `${title} · ${SITE_TITLE}`;
  const head = `<section class="bcard bhead"><div class="bhead-top"><h1>${title}</h1></div>
    <div class="tp-links">${BK_CLASSES.map(c => `<a class="h-btn${c === bk.cls ? ' on' : ''}" href="?bracket=${c}">${bkTab(c)}</a>`).join('')}</div>
    ${bkLegend(!!DISTRICTS[bk.cls], !!DISTRICTS[bk.cls] && bkCut(bk.cls) < 7)}</section>`;
  if (!allGames.list && !allGames.err) return void (box.innerHTML = head + '<section class="bcard"><p class="bempty">Loading the season…</p></section>');
  if (allGames.err) return void (box.innerHTML = head + `<section class="bcard"><p class="bempty">${esc(allGames.err)}</p></section>`);
  if (DISTRICTS[bk.cls]) return renderDistricts(box, head);
  const east = bkSeed(S.East), west = bkSeed(S.West);
  const body = `<div class="bk-wrap bkt-wrap has-full">${bkTreeHtml(east, 'East')}${bkTreeHtml(west, 'West')}</div>${bkFullHtml(bkSlots(east), bkSlots(west))}`;
  box.innerHTML = head
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>Week 9 matchups</h2></div>
        ${body}</section>`
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>How they're seeded</h2></div>${bkListHtml(east, 'East')}${bkListHtml(west, 'West')}</section>`;
}
// 3A-1A and 8-player: the districts first, then the bracket they make.
function renderDistricts(box, head){
  const D = DISTRICTS[bk.cls].map((names, i) => bkDistrict(names, bkCut(bk.cls)).map(t => Object.assign(t, {dtag:`D${i + 1} #${t.place}`})));
  const eight = bk.cls.startsWith('8M') || bk.cls === '6M';
  let trees, seeded = '', full = '';
  if (eight){
    const by = {}; D.forEach((d, i) => { by[i + 1] = d; });
    const pairs = bk.cls === '6M' ? BK_6M : BK_8M;
    trees = bk8Tree(by, 'East', pairs) + bk8Tree(by, 'West', pairs);
    full = bkFullHtml(bk8Slots(by, 'East', pairs), bk8Slots(by, 'West', pairs));
  } else {
    const east = bkDistrictSeeds(D.slice(0, 4)), west = bkDistrictSeeds(D.slice(4, 8));
    trees = bkTreeHtml(east, 'East') + bkTreeHtml(west, 'West');
    full = bkFullHtml(bkSlots(east), bkSlots(west));
    seeded = `<section class="bcard ccard"><div class="ccard-hd"><h2>How they're seeded</h2></div>${bkListHtml(east, 'East')}${bkListHtml(west, 'West')}</section>`;
  }
  box.innerHTML = head
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>Week 9 matchups</h2></div>
        <div class="bk-wrap bkt-wrap has-full">${trees}</div>${full}</section>`
    + seeded
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>District standings</h2></div>${D.map((d, i) => bkDistrictHtml(i + 1, d)).join('')}</section>`;
}
