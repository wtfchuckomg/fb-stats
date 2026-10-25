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
    East:['Gardner Edgerton', 'Wyandotte', 'Lawrence', 'Olathe East', 'Olathe North', 'Olathe Northwest', 'Olathe South', 'Olathe West',
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
    // A forfeit counts the most the margin allows, +13 or -13 (manual, forfeiture policy 3) — not the 1-0 or 2-0 on
    // the scoreboard. Baldwin's forfeit win over Bishop Ward is what puts them ahead of Burlington in 3A.
    const ff = /forfeit/i.test(f.status || '') || (Math.min(mine, theirs) === 0 && Math.max(mine, theirs) <= 2);
    const ot = !ff && (f.q || 0) > 4, cap = ot ? 1 : 13;
    const d = ff ? Math.sign(mine - theirs) * cap : Math.max(-cap, Math.min(cap, mine - theirs));
    t.gp++; t.marg += d; t.games.push({opp:other, mine, theirs, ot, ff});
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
// Teams level on percentage, sorted one place at a time the KSHSAA's way (Chuck, 2026-10-23: "follow the procedure";
// 2026-10-24, after the KSHSAA's own call: "WE WERE RIGHT. OSWATOMIE IS IN" — the manual's "begin again"):
//   1. everyone still level has played everyone else: the one with the most wins over the others takes the place;
//   2. otherwise the margin (13-point here, 21-point in a district): the best one takes it;
//   3. teams still level on the margin that have played each other: head-to-head among just them;
//   4. a coin flip.
// Whoever is left starts again at 1. So two teams that played are settled by that game (Hutchinson beat Maize South);
// two that didn't, level on the margin, flip (Andover, Kapaun); three level on everything flip for the top, and the
// other two go back to head-to-head, then the margin, then another flip. A flip with games still to play is only
// where things stand, so it reads as the margin until every one of them is done.
// Ties Chuck sends straight to the coin flip, head-to-head or not: "<season>|<class>|<schools>" (2026-10-23:
// "undo the head to head with maize south" — back to a coin flip).
const BK_FLIP_ONLY = new Set(['2026|5A|hutchinson,maize-south']);
function bkSettle(group, o){
  const k = t => canonSchool(t.name), out = [];
  const flipOnly = g => BK_FLIP_ONLY.has(`${BK_WEEK8_END.slice(0, 4)}|${bk.cls}|${g.map(k).sort().join(',')}`);
  const played = g => !flipOnly(g) && g.every(a => g.every(b => a === b || a[o.beat].has(k(b)) || a[o.lost].has(k(b))));
  const wins = (t, g) => g.filter(x => x !== t && t[o.beat].has(k(x))).length;
  const best = (g, f) => { const m = Math.max(...g.map(f)); return g.filter(t => bkSame(f(t), m)); };
  let rest = group.slice(), how = '';
  while (rest.length > 1){
    let pick = null;
    if (played(rest)){ const top = best(rest, t => wins(t, rest)); if (top.length === 1){ pick = top[0]; how = 'head-to-head'; } }
    if (!pick){
      const top = best(rest, o.marg);
      if (top.length === 1){ pick = top[0]; how = o.mhow; }
      else if (played(top)){ const t2 = best(top, t => wins(t, top)); if (t2.length === 1){ pick = t2[0]; how = 'head-to-head'; } }
      if (!pick){
        const done = !top.some(t => o.left(t).length), f = done ? flipOrder(top) : null;
        const won = f && top.filter(t => f.order.includes(k(t))).sort((a, b) => f.order.indexOf(k(a)) - f.order.indexOf(k(b)))[0];
        if (won){ pick = Object.assign(won, {flipKey:f.key}); how = 'coin flip'; }
        else {
          bkLot(top, o.left);
          // Not flipped yet: the line carries them all; the projection goes on to the season's record and margin.
          pick = top.slice().sort((a, b) => b.pct - a.pct || b.avg - a.avg || a.name.localeCompare(b.name))[0];
          how = done ? 'coin flip' : o.proj || o.mhow;
        }
      }
    }
    out.push(Object.assign(pick, {how})); rest = rest.filter(t => t !== pick);
  }
  return out.concat(rest.map(t => Object.assign(t, {how})));
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
// The KSHSAA's own seeds, once a bracket is out: they stand over ours (Chuck, 2026-10-24: "we messed up in 5A fix it" —
// KSHSAA had Salina Central-Goddard 40-30, not 34-20, then fixed it: Andover Central 10, Goddard 11).
const BK_OFFICIAL = [
  'Andover, Kapaun Mt. Carmel, Hays, Bishop Carroll, Salina South, Eisenhower, Salina Central, Emporia, Hutchinson, Andover Central, Goddard, Maize South, Liberal, Valley Center, Newton, Wichita West',
  'Frontenac, Wellsville, Jefferson West, Hayden, Baldwin, Burlington, Nemaha Central, Columbus, Iola, Perry-Lecompton, Holton, Anderson County, Girard, Santa Fe Trail, Atchison, Osawatomie',
  'Andale, Holcomb, Hesston, Hoisington, Chapman, Hugoton, Wichita Collegiate, Pratt, Cheney, Goodland, Lyons, Concordia, Clay Center, Scott City, Wichita Trinity, Larned',
  // 5A East, only 14-16 sent so far ("*" keeps our order there).
  '*, *, *, *, *, *, *, *, *, *, *, *, *, Shawnee Heights, Turner, Topeka West',
].map(l => l.split(', ').map(n => n === '*' ? null : canonSchool(n)));
// Teams in the KSHSAA's order when one of their brackets covers them all; otherwise as they came.
function bkOfficial(teams){
  const ks = teams.map(t => canonSchool(t.name));
  const o = BK_OFFICIAL.find(l => l.every(k => !k || ks.includes(k)));
  if (!o) return null;
  const rest = teams.filter(t => !o.includes(canonSchool(t.name)));
  return o.map(k => k ? Object.assign(teams[ks.indexOf(k)], {lock:true}) : rest.shift()).filter(Boolean).concat(rest);
}
// Seeds 1-16 in one section, by the manual's criteria in order.
function bkSeed(names){
  let all = bkOrder(names.map(bkTeam)), locks = bkLocks(all, bkPctAfter, t => t.left);
  const ks = bkOfficial(all); if (ks){ all = ks; ks.forEach(t => { if (t.lock) locks.add(canonSchool(t.name)); }); }
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
      t.dgp++; t.dmarg += g.ff ? Math.sign(g.mine - g.theirs) * cap : Math.max(-cap, Math.min(cap, g.mine - g.theirs));
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
  // No district split: the 2026 3A bracket kept the straight order (5 Chapman v 12 Concordia, 8 Columbus v 9 Iola are
  // district rematches in week 9), though the manual's playoff information point 4 reads otherwise.
  return (bkOfficial(seeds) || seeds).map((t, i) => Object.assign(t, {seed:i + 1}));
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
// A matchup opens its game, not the teams (Chuck, 2026-10-24: "make the bracket pairing go to the preview… They can go
// to the team profiles when they are in the preview"): the preview until there are stats, then the gamecast or box.
function bkPairHref(a, b){
  if (!a || !b || a.bye || b.bye || a.lotWith || b.lotWith) return '';
  const want = canonSchool(b.name), after = fromYmd(BK_WEEK8_END);
  const r = schoolRows(a.name).find(r => gameDay(r.x) > after && canonSchool(r.x.teams[r.opp].name) === want);
  if (!r) return '';
  const id = encodeURIComponent(r.x.id);
  return hasStats(r.x) ? `?game=${id}${r.x.box ? '&tab=box' : ''}` : `?preview=${id}`;
}
const bkPair = (a, b, html, cls = '') => { const h = bkPairHref(a, b);
  return `<div class="bkt-pair${cls}${h ? ' go' : ''}"${h ? ` data-bk-go="${esc(h)}" role="link" tabindex="0"` : ''}>${html}</div>`; };
document.addEventListener('click', e => {
  if (!ui.bracket || !e.target.closest || e.target.closest('[data-flip-key]')) return;
  const p = e.target.closest('[data-bk-go]'); if (!p) return;
  e.preventDefault(); location.href = p.dataset.bkGo;
});
function bkTreeHtml(seeds, side){
  const byNo = {}; seeds.forEach(t => { byNo[t.seed] = t; });
  const pairs = BK_PAIRS.map(([x, y]) => bkPair(byNo[x], byNo[y], bkPill(byNo[x]) + bkPill(byNo[y])));
  return `<div class="bkt"><h3>${side}</h3>
    <div class="bkt-cols"><div class="bkt-col"><span class="bkt-h">Week 9</span><div class="bkt-pairs">${pairs.join('')}</div></div></div></div>`;
}
// 8-player: the manual's own pairs, each team shown by its district place.
function bk8Tree(by, side, pairs = BK_8M){
  const team = slot => { if (!slot) return {bye:true}; const [d, p] = slot, t = by[d] && by[d][p - 1]; return t ? Object.assign(t, {tag:`D${d} #${p}`, lock:t.placeLock}) : null; };
  const pill = t => t && t.bye ? `<div class="bkp bye"><span class="bk-nm">Bye</span></div>` : bkPill(t);
  return `<div class="bkt"><h3>${side}</h3>
    <div class="bkt-cols"><div class="bkt-col"><span class="bkt-h">Week 9</span><div class="bkt-pairs">${pairs[side].map(([a, b]) => {
      const A = team(a), B = team(b); return bkPair(A, B, pill(A) + pill(B)); }).join('')}</div></div></div></div>`;
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
/* ---------- playoff games on the team schedules (Chuck, 2026-10-24: "when there are playoff games, add them
   immediately to the team schedules" — "not the kshsaa brackets, our brackets") ----------
   Once the regular season is in, every matchup on our bracket with both teams known goes on both schedules: the
   better seed at home, on that round's Friday; State is on the 27th. Not yet played only — a final is a real game
   already. A game anyone enters, or KPreps lists, for the same two schools that week takes its place. */
const BK_ROUND_DAYS = ['2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27'];
// Week 9 games on Thursday the 29th, by a school in them (Chuck, 2026-10-24), and the two played away from either school.
const BK_THURSDAY = new Set(['Olathe North', 'Olathe Northwest', 'Salina Central', 'Spring Hill', 'Otis-Bison', 'Marais des Cygnes Valley',
  'Centre', 'Logan', 'Sylvan-Lucas Unified', 'Thunder Ridge', 'Quinter', 'Marmaton Valley', 'Axtell', 'Flinthills', 'Hoxie', 'Hill City',
  'Washington County', 'Silver Lake', 'Sabetha'].map(canonSchool));
const BK_SITES = {'olathe-north':'ODAC', 'olathe-northwest':'CBAC'};
// The same days and sites on KPreps' copy of a week-9 game (schedule.json lists them all on the Friday).
function bkWeek9Fix(x){
  if (!/^2026-10-(29|30)$/.test(x.date || '')) return x;
  const ks = [canonSchool(x.teams.A.name), canonSchool(x.teams.H.name)], site = ks.map(k => BK_SITES[k]).find(Boolean);
  if (ks.some(k => BK_THURSDAY.has(k))) x.date = '2026-10-29';
  if (site) x.site = site;
  return x;
}
function bkSides(cls){
  if (!DISTRICTS[cls]){ const S = SECTIONS[cls]; return [bkSlots(bkSeed(S.East)), bkSlots(bkSeed(S.West))]; }
  const D = DISTRICTS[cls].map(names => bkDistrict(names, bkCut(cls)));
  if (cls.startsWith('8M') || cls === '6M'){
    const by = {}, pairs = cls === '6M' ? BK_6M : BK_8M; D.forEach((d, i) => { by[i + 1] = d; });
    return [bk8Slots(by, 'East', pairs), bk8Slots(by, 'West', pairs)];
  }
  return [bkSlots(bkDistrictSeeds(D.slice(0, 4))), bkSlots(bkDistrictSeeds(D.slice(4, 8)))];
}
// A playoff game's place in our bracket: {label: "Class 5A Playoffs · First Round", seed: school -> seed} (Chuck,
// 2026-10-24: "On week 9 and beyond, we need to see what round it is"). Null for a regular-season game.
const BK_ROUND_NAMES = ['First Round', 'Regional', 'Sectional', 'Sub-State', 'State Championship'];
function bkGameInfo(x){
  if (!bkSched.info || !x || !x.teams || !x.teams.A || !x.teams.H || gameDay(x) <= fromYmd(BK_WEEK8_END)) return null;
  const i = bkSched.info.get([canonSchool(x.teams.A.name), canonSchool(x.teams.H.name)].sort().join('|'));
  return i ? {label:`${bkLabel(i.cls)} Playoffs · ${BK_ROUND_NAMES[i.r]}`, seed:n => i.seed[canonSchool(n)] || null} : null;
}
function bkSchedRefresh(){
  const out = [], info = new Map();
  // Each playoff pairing's class, round and seeds, played or not, for the scoreboards (bkGameInfo).
  const note = (cls, r, a, b) => { if (a && b && !a.bye && !b.bye) info.set([canonSchool(a.name), canonSchool(b.name)].sort().join('|'),
    {cls, r, seed:{[canonSchool(a.name)]:a.tag ? null : a.seed, [canonSchool(b.name)]:b.tag ? null : b.seed}}); };
  if (allGames.idx && Date.now() >= fromYmd(BK_WEEK8_END).getTime()){
    const was = bk.cls;
    const rank = t => t.tag ? +t.tag.split('#')[1] : t.seed || 99;
    const team = name => { const t = findTeam(name); return {name, abbr:(t && t.abbr) || shortName(name), color:(t && t.color) || '#4A4B4D'}; };
    const add = (cls, r, a, b) => {
      if (!a || !b || a.bye || b.bye) return;   // past week 8 by the calendar: a week-1 game with no final on file doesn't hold it up
      const [H, A] = r < 4 && rank(b) < rank(a) ? [b, a] : [a, b];
      out.push(bkWeek9Fix({id:`bk26-${cls}-${r}-${canonSchool(A.name)}-${canonSchool(H.name)}`, kind:'score', sched:true, opp:true, file:true, playoff:true,
        created:0, updated:0, date:BK_ROUND_DAYS[r], teams:{A:team(A.name), H:team(H.name)}, A:0, H:0, per:'pre', clk:''}));
    };
    try {
      BK_CLASSES.forEach(cls => {
        bk.cls = cls;
        const champs = bkSides(cls).map(slots => {
          let cur = slots;
          for (let r = 0; r < 4; r++){
            const {next, games} = bkAdvance(cur);
            for (let i = 0; i < cur.length; i += 2){ note(cls, r, cur[i], cur[i + 1]); if (!games[i / 2]) add(cls, r, cur[i], cur[i + 1]); }
            cur = next;
          }
          return cur[0] || null;
        });
        note(cls, 4, champs[0], champs[1]);
        if (champs[0] && champs[1] && !bkPlayed(champs[0], champs[1])) add(cls, 4, champs[0], champs[1]);
      });
    } catch (e) { console.warn('playoff schedule', e); }
    bk.cls = was;
  }
  bkSched.info = info;
  const sig = out.map(x => x.id).sort().join();
  if (sig === bkSched.sig) return false;
  bkSched.list = out; bkSched.sig = sig;
  return true;
}
function bkLine(t, game, small){
  if (t && t.bye) return `<div class="bkp bye"><span class="bk-nm">Bye</span></div>`;
  if (!t) return `<div class="bkp empty"><span class="bk-nm">&nbsp;</span></div>`;
  if (!small && !game) return bkPill(t);
  const won = game && game.win === t, lost = game && game.win !== t;
  // A short code in the narrow rounds: the school's own if it is one ("AND"), otherwise its initials ("ING", "PB").
  const code = n => { const a = listAbbr(n); return a && a.length <= 4 ? a : initialsOf(n).slice(0, 4); };
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
    bkPair(c.slots[2 * i], c.slots[2 * i + 1], bkLine(c.slots[2 * i], gm, r > 0) + bkLine(c.slots[2 * i + 1], gm, r > 0))).join('')}</div></div>`;
  const fin = bkPlayed(E.champ, W.champ), state = bkPair(E.champ, W.champ, bkLine(E.champ, fin, true) + bkLine(W.champ, fin, true), ' st');
  // A phone (Chuck, 2026-10-25: "shrink it… so we can see multiple rounds at the same time"): each side's four rounds
  // across in small boxes, the logo and short name, then State under both.
  const mcol = (c, r) => `<div class="bkm-col"><span class="bkt-h">${ROUNDS[r]}</span><div class="bkm-pairs">${c.games.map((gm, i) =>
    bkPair(c.slots[2 * i], c.slots[2 * i + 1], bkLine(c.slots[2 * i], gm, true) + bkLine(c.slots[2 * i + 1], gm, true))).join('')}</div></div>`;
  const mside = (S, name) => `<div class="bkm-side"><h3>${name}</h3><div class="bkm-grid">${S.cols.map(mcol).join('')}</div></div>`;
  return `<div class="bkf">${E.cols.map((c, r) => col(c, r, false)).join('')}
    <div class="bkf-col st"><span class="bkt-h">State</span><div class="bkf-pairs">${state}</div></div>
    ${W.cols.map((c, r) => col(c, r, true)).reverse().join('')}</div>
    <div class="bkf-sides"><span>East</span><span>West</span></div>
    <div class="bkm">${mside(E, 'East')}${mside(W, 'West')}<div class="bkm-side bkm-st"><h3>State</h3>${state}</div></div>`;
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
// It sits atop the standings it explains (2026-10-24: "move this down here").
const bkLegend = (districts, outs = districts) => `<div class="bk-legend"><span><b class="lg-lock">Bold</b> Locked into its spot</span>${districts
  ? '<span><b class="lg-lock lg-win">Underlined</b> Clinched the district</span>' : ''}${outs ? '<span><b class="lg-out">Struck through</b> Eliminated</span>' : ''}</div>`;
function renderBracket(){
  if (!ui.bracket) return;
  const box = $('#board'), S = SECTIONS[bk.cls];
  // The 2026 Playoffs tab (Chuck, 2026-10-23): with the regular season done, the page is the playoff bracket.
  const title = `${BK_WEEK8_END.slice(0, 4)} ${bkLabel(bk.cls)} Playoffs`;
  document.title = `${title} · ${SITE_TITLE}`;
  const head = `<section class="bcard bhead"><div class="bhead-top"><h1>${title}</h1></div>
    <div class="tp-links">${BK_CLASSES.map(c => `<a class="h-btn${c === bk.cls ? ' on' : ''}" href="?bracket=${c}">${bkTab(c)}</a>`).join('')}</div></section>`;
  if (!allGames.list && !allGames.err) return void (box.innerHTML = head + '<section class="bcard"><p class="bempty">Loading the season…</p></section>');
  if (allGames.err) return void (box.innerHTML = head + `<section class="bcard"><p class="bempty">${esc(allGames.err)}</p></section>`);
  if (DISTRICTS[bk.cls]) return renderDistricts(box, head);
  const east = bkSeed(S.East), west = bkSeed(S.West);
  const body = `<div class="bk-wrap bkt-wrap has-full">${bkTreeHtml(east, 'East')}${bkTreeHtml(west, 'West')}</div>${bkFullHtml(bkSlots(east), bkSlots(west))}`;
  box.innerHTML = head
    + `<section class="bcard ccard">
        ${body}</section>`
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>How they're seeded</h2></div>${bkLegend(false)}${bkListHtml(east, 'East')}${bkListHtml(west, 'West')}</section>`;
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
    + `<section class="bcard ccard">
        <div class="bk-wrap bkt-wrap has-full">${trees}</div>${full}</section>`
    + seeded
    + `<section class="bcard ccard"><div class="ccard-hd"><h2>District standings</h2></div>${bkLegend(true, bkCut(bk.cls) < 7)}${D.map((d, i) => bkDistrictHtml(i + 1, d)).join('')}</section>`;
}
