/* ================================================================
   Every logo school's full schedule, from KPreps.

   .github/kp/schedule.py writes /schedule.json after each crawl: every
   2026 game with a logo school in it, in this site's own school names.
   A game the site already has — tracked, scored by hand, or entered from
   a county schedule — always wins; anything missing fills in from here
   as a schedule entry, with its final when KPreps has one. They show
   on the scoreboards, team pages and records like any other game.
   ================================================================ */
const sched = {rows:null, stubs:null, byId:null, want:false, logos:-1};
function loadSchedFile(){
  if (sched.want) return;
  sched.want = true;
  fetch('/schedule.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(d => {
    if (!d || !Array.isArray(d.games)) return;
    sched.rows = d.games; sched.stubs = null;
    if (allGames.list) indexGames();
    renderScores(); renderScoreboard(); renderTeamPage(); renderHome(); if (ui.preview) renderPreview();
  }).catch(() => {});
}
// The file's games, shaped like a schedule entry. Built once, and again if the logo list grows (short names
// and colors come from it).
function schedStubs(){
  const n = (logoLib.list || []).length;
  if (sched.stubs && sched.logos === n) return sched.stubs;
  sched.logos = n;
  const team = name => { const t = findTeam(name); return {name, abbr:(t && t.abbr) || shortName(name), color:(t && t.color) || '#4A4B4D'}; };
  sched.stubs = (sched.rows || []).map(r => {
    const fin = r.hp != null && r.ap != null;
    return {id:r.id, kind:'score', sched:true, opp:true, file:true, created:0, updated:0, date:r.d,
      teams:{A:team(r.an), H:team(r.hn)}, A:fin ? r.ap : 0, H:fin ? r.hp : 0,
      per:fin ? (r.ot ? 'fot' : 'final') : 'pre', clk:'', ...(fin ? {kp:true} : {})};
  });
  sched.byId = new Map(sched.stubs.map(x => [x.id, x]));
  return sched.stubs;
}
const schedById = id => { if (!sched.rows) return null; schedStubs(); return sched.byId.get(id) || null; };
// The same two schools in the same week, however either side spells them.
const schedPair = x => `${gameWeek(x)}|${[kpAlias(x.teams.A.name), kpAlias(x.teams.H.name)].sort().join('|')}`;
// The schedule's games that the site doesn't already have: nothing already there is ever replaced, and a game
// the admin took off the schedules stays off.
function schedMissing(have, week){
  if (!sched.rows) return [];
  const taken = new Set(), ids = new Set();
  have.forEach(x => { if (x && x.teams && x.teams.A && x.teams.H){ taken.add(schedPair(x)); ids.add(x.id); } });
  return schedStubs().filter(x => (!week || gameWeek(x) === week) && !ids.has(x.id) && !hideList.ids.has(x.id) && !taken.has(schedPair(x)));
}
// Take a schedule game off for good. It has no document of its own to delete, so it joins the admin's hidden
// list, which every page already reads; showing it again on a scoreboard brings it back.
async function schedRemove(id){
  if (!ui.admin || !hideList.api) return false;
  const ids = new Set(hideList.ids), shown = new Set(hideList.shown);
  ids.add(id); shown.delete(id);
  hideList.ids = ids; hideList.shown = shown; hiddenChanged();
  const {fsM, fsdb} = hideList.api;
  try {
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', HIDE_DOC), {owner:ADMIN_UID, updated:Date.now(), public:true, kind:'hidden',
      title:'Hidden from the scoreboards', json:JSON.stringify({ids:[...ids], shown:[...shown]})});
    if (!hideList.unsub) watchHidden(hideList.api);
    return true;
  } catch (e) { return false; }
}
