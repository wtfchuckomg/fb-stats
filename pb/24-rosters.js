/* ================================================================
   Shared rosters. When a signed-in scorer saves a team's roster (in a
   game's Setup, or in Saved teams), a copy goes up for everyone:
   "roster-<school>-<uid>", public, one per scorer per school. Anyone
   setting up a game with that school sees the others' copies under the
   roster box and can use one; nothing changes unless they tap Use it.
   Only numbers and names are shared, not who saved it.
   ================================================================ */
const sharedRosters = {list:null, unsub:null};
function watchRosters(api){
  if (sharedRosters.unsub || !api) return;
  const {fsM, fsdb} = api;
  const q = fsM.query(fsM.collection(fsdb, 'pressbox'), fsM.where('public', '==', true), fsM.where('kind', '==', 'roster'));
  sharedRosters.unsub = fsM.onSnapshot(q, snap => {
    const out = [];
    snap.forEach(d => {
      const v = d.data(); if (v.deleted || !v.json) return;
      try { const r = JSON.parse(v.json); if (r.name && r.roster) out.push(Object.assign(r, {id:d.id, owner:v.owner})); } catch (e) {}
    });
    sharedRosters.list = out; refreshRosterHints();
  }, () => { sharedRosters.unsub = null; });
}
// Other scorers' rosters for a school, newest first (your own is already in your saved teams).
function rostersFor(name){
  const k = name && canonSchool(name); if (!k) return [];
  return (sharedRosters.list || []).filter(r => canonSchool(r.name) === k && Object.keys(r.roster).length && !(sync.user && r.owner === sync.user.uid))
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));
}
// The roster a new game starts with: the fullest copy there is — this device's saved team, a roster saved on the
// school's page, or another scorer's — newest on a tie. Your own shared copies count too (a page's roster is yours).
function bestRoster(name){
  const k = name && canonSchool(name); if (!k) return null;
  const all = (sharedRosters.list || []).filter(r => canonSchool(r.name) === k && Object.keys(r.roster || {}).length)
    .map(r => ({roster:r.roster, updated:r.updated || 0, from:'shared'}));
  const mine = (typeof savedTeams === 'function' ? savedTeams() : []).find(t => canonSchool(t.name) === k && Object.keys(t.roster || {}).length);
  if (mine) all.push({roster:mine.roster, updated:mine.updated || 0, from:'saved'});
  return all.sort((a, b) => Object.keys(b.roster).length - Object.keys(a.roster).length || b.updated - a.updated)[0] || null;
}
// Fill an empty roster box in Setup from bestRoster; a roster already typed or pasted is never replaced.
function fillSetupRoster(s){
  const nm = $(`#s-${s}-name`), box = $(`#s-${s}-roster`), hint = $(`#s-${s}-lib`);
  if (!nm || !box) return;
  // A box still holding what was filled in for another school follows the school; anything typed stays.
  const auto = !!box.dataset.auto && box.value === box.dataset.auto;
  if (box.value.trim() && !auto) return;
  const b = nm.value.trim() && bestRoster(nm.value.trim());
  if (!b){ if (auto){ box.value = ''; box.dataset.auto = ''; if (hint) hint.textContent = ''; } return; }
  const text = rosterToText(b.roster); if (auto && text === box.value) return;
  box.value = text; box.dataset.auto = text;
  if (hint) hint.textContent = `Roster filled in from ${b.from === 'saved' ? 'your saved teams' : 'the one saved for this school'}: ${plural2(Object.keys(b.roster).length, 'player')}.`;
}
// The best copy of a school's roster for showing on its page: the fullest, then the newest, counting this
// device's saved team as well as everyone else's shared copies.
function rosterFor(name){
  const k = name && canonSchool(name); if (!k) return null;
  const all = (sharedRosters.list || []).filter(r => canonSchool(r.name) === k && Object.keys(r.roster || {}).length)
    .map(r => ({roster:r.roster, updated:r.updated || 0}));
  const mine = (typeof savedTeams === 'function' ? savedTeams() : []).find(t => canonSchool(t.name) === k && Object.keys(t.roster || {}).length);
  if (mine) all.push({roster:mine.roster, updated:mine.updated || 0});
  const best = all.map(r => Object.assign(r, {count:Object.keys(r.roster).length}))
    .sort((a, b) => b.count - a.count || b.updated - a.updated)[0];
  if (!best) return null;
  return {players:Object.entries(best.roster).map(([num, v]) => ({num:String(num), name:playerName(v)}))
    .sort((a, b) => (parseInt(a.num) || 999) - (parseInt(b.num) || 999)), count:best.count, fromGames:false};
}

// Failing a shared roster, the players a school's own games know: a pasted box score gives names with no
// numbers, a tracked game gives numbers and whatever names its roster had.
function rosterFromGames(name){
  const k = name && canonSchool(name); if (!k || !allGames.idx) return null;
  const out = new Map();                                   // key -> {num, name}
  schoolRows(name).forEach(r => {
    const x = r.x;
    // From season.json: the names that game knew, with no numbers.
    if (x.players){
      (x.players[r.side === 'A' ? 'a' : 'h'] || []).forEach(n => { if (n && !out.has(n)) out.set(n, {num:'', name:n}); });
      return;
    }
    if (!(x.kind !== 'score' && ((x.plays && x.plays.length) || x.box))) return;
    if (x.box){
      const b = boxData(x); if (!b) return;
      Object.keys(b.pl[r.side] || {}).forEach(n => { if (n !== 'team' && !out.has(n)) out.set(n, {num:'', name:n}); });
      return;
    }
    let rep; try { rep = replay(x); } catch (e) { return; }
    const roster = (x.teams[r.side] || {}).roster || {};
    Object.values(rep.S.pl[r.side] || {}).forEach(p => {
      if (p.n === 'team') return;
      const nm = playerName(rosterGet(roster, p.n, r.side)) || '';
      const key = nm || '#' + p.n;
      if (!out.has(key)) out.set(key, {num:String(p.n), name:nm});
    });
  });
  if (!out.size) return null;
  const list = [...out.values()].sort((a, b) => (+a.num || 999) - (+b.num || 999) || a.name.localeCompare(b.name));
  return {players:list, count:list.length, fromGames:true};
}

// Put a saved roster up for everyone (only when signed in, and only a real school with players on it).
function shareRoster(t){
  if (!sync.user || !sync.api || !t || !t.name || DEFAULT_TEAM_NAMES.includes(teamKey(t.name))) return;
  const n = Object.keys(t.roster || {}).length; if (!n) return;
  const {fsM, fsdb} = sync.api, r = {name:t.name, roster:t.roster, count:n, updated:Date.now()};
  fsM.setDoc(fsM.doc(fsdb, 'pressbox', `roster-${teamKey(t.name)}-${sync.user.uid}`),
    {owner:sync.user.uid, updated:r.updated, public:true, kind:'roster', title:`${t.name} roster`, json:JSON.stringify(r)}).catch(() => {});
}
// The line under a roster box in Setup: up to three others' copies, each with Use it.
function sharedHint(s, name){
  const day = r => new Date(r.updated).toLocaleDateString('en-US', {month:'short', day:'numeric'});
  return rostersFor(name).slice(0, 3).map(r => `Shared roster: ${plural2(r.count, 'player')}, updated ${day(r)}.
    <button type="button" class="linkbtn" data-use-shared="${esc(r.id)}" data-side="${s}">Use it</button>`).join('<br>');
}
function refreshRosterHints(){
  ['A', 'H'].forEach(s => { const el = $(`#s-${s}-shared`), nm = $(`#s-${s}-name`); if (el && nm) el.innerHTML = sharedHint(s, nm.value.trim()); fillSetupRoster(s); });
  renderTeamPage();   // a school's page lists its roster too
}
document.addEventListener('input', e => { if (e.target.id && /^s-[AH]-name$/.test(e.target.id)) refreshRosterHints(); });
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-use-shared]'); if (!b || ui.viewer) return;
  const r = (sharedRosters.list || []).find(x => x.id === b.dataset.useShared), box = $(`#s-${b.dataset.side}-roster`);
  if (!r || !box) return;
  box.value = rosterToText(r.roster);
  toast(`Using the shared ${r.name} roster`);
});
/* 2025 season stats for the Butler County schools, from "2025 Butler County Leaderboard.xlsx" (its PLAYERS sheet):
   each player's season totals. No games, records, points or kicking are in it. Passing pc/pa/py/ptd/pint, rushing
   ru/ry/rtd, receiving re/rey/retd. */
const STATS_2025 = [
  {"name":"Ben Reynolds","team":"Andover","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":12,"rey":192,"retd":2},
  {"name":"Barrett Hill","team":"Andover","yr":"SR","pc":0,"pa":1,"py":0,"ptd":0,"pint":1,"ru":51,"ry":516,"rtd":3,"re":7,"rey":191,"retd":2},
  {"name":"Gatlin Tilson","team":"Andover","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":4,"rey":99,"retd":1},
  {"name":"Leland Schmaucher","team":"Andover","yr":"JR","pc":0,"pa":1,"py":0,"ptd":0,"pint":0,"ru":18,"ry":62,"rtd":2,"re":2,"rey":11,"retd":0},
  {"name":"Pete Vega","team":"Andover","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":213,"ry":1016,"rtd":7,"re":0,"rey":0,"retd":0},
  {"name":"Will Quinn","team":"Andover","yr":"JR","pc":26,"pa":40,"py":504,"ptd":5,"pint":1,"ru":118,"ry":775,"rtd":17,"re":0,"rey":0,"retd":0},
  {"name":"Nas Williams","team":"Andover","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":32,"ry":185,"rtd":5,"re":0,"rey":0,"retd":0},
  {"name":"Kaeden Stuart","team":"Andover","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":6,"ry":89,"rtd":1,"re":0,"rey":0,"retd":0},
  {"name":"Brooks Brown","team":"Andover","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":5,"ry":18,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Brody Bailey","team":"Andover","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":10,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Tyler Jones","team":"Andover","yr":"SO","pc":0,"pa":1,"py":0,"ptd":0,"pint":0,"ru":3,"ry":9,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Carson Goentzel","team":"Andover","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":2,"ry":9,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Daniel Beck","team":"Andover","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":4,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Jaxson Siroky","team":"Andover","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":1,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Cooper Mason","team":"Andover Central","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":2,"ry":4,"rtd":0,"re":27,"rey":308,"retd":3},
  {"name":"Noah Sawdy","team":"Andover Central","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":24,"rey":288,"retd":2},
  {"name":"Jett Thompson","team":"Andover Central","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":8,"rey":118,"retd":0},
  {"name":"Caden Rubio","team":"Andover Central","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":6,"rey":101,"retd":1},
  {"name":"Jaxson Green","team":"Andover Central","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":170,"ry":1314,"rtd":14,"re":6,"rey":68,"retd":1},
  {"name":"Bryce Skahan","team":"Andover Central","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":2,"rey":6,"retd":0},
  {"name":"Aiden Jordan","team":"Andover Central","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":1,"rey":3,"retd":0},
  {"name":"Bubba Hall","team":"Andover Central","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":32,"ry":85,"rtd":1,"re":0,"rey":0,"retd":0},
  {"name":"Max Olson","team":"Andover Central","yr":"SR","pc":75,"pa":156,"py":900,"ptd":7,"pint":5,"ru":54,"ry":79,"rtd":3,"re":0,"rey":0,"retd":0},
  {"name":"Bobby Sands","team":"Andover Central","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":2,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Trey DeGarmo","team":"Andover Central","yr":"FR","pc":0,"pa":1,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Brecken Albert","team":"Augusta","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":34,"rey":745,"retd":9},
  {"name":"Cade Camac","team":"Augusta","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":3,"ry":7,"rtd":0,"re":12,"rey":265,"retd":2},
  {"name":"Roman Bridwell","team":"Augusta","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":3,"ry":44,"rtd":0,"re":11,"rey":153,"retd":1},
  {"name":"Jett Highfill","team":"Augusta","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":12,"rtd":0,"re":5,"rey":101,"retd":1},
  {"name":"Bryce Schwinn","team":"Augusta","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":8,"rey":97,"retd":0},
  {"name":"Owen Roberts","team":"Augusta","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":130,"ry":816,"rtd":7,"re":9,"rey":92,"retd":0},
  {"name":"Cade Wills","team":"Augusta","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":5,"rey":86,"retd":0},
  {"name":"Rylee McMichael","team":"Augusta","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":2,"rey":40,"retd":0},
  {"name":"Jackson Ingram","team":"Augusta","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":6,"ry":9,"rtd":3,"re":4,"rey":33,"retd":1},
  {"name":"Cyrus Hubbard","team":"Augusta","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":1,"rey":8,"retd":0},
  {"name":"Gunner Highfill","team":"Augusta","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":4,"ry":8,"rtd":0,"re":1,"rey":2,"retd":0},
  {"name":"Nick Robbins","team":"Augusta","yr":"FR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":1,"rey":0,"retd":0},
  {"name":"Brody Haskell","team":"Augusta","yr":"SR","pc":97,"pa":169,"py":1628,"ptd":13,"pint":11,"ru":79,"ry":503,"rtd":5,"re":0,"rey":0,"retd":0},
  {"name":"Jaydyn Harris","team":"Augusta","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":18,"ry":118,"rtd":3,"re":0,"rey":0,"retd":0},
  {"name":"Cannon Terry","team":"Augusta","yr":"FR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":10,"ry":31,"rtd":1,"re":0,"rey":0,"retd":0},
  {"name":"Mason Skov","team":"Augusta","yr":"SO","pc":2,"pa":2,"py":2,"ptd":0,"pint":0,"ru":1,"ry":16,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Cooper Witty","team":"Bluestem","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":1,"rey":46,"retd":1},
  {"name":"Axton Vice","team":"Bluestem","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":113,"ry":769,"rtd":8,"re":5,"rey":25,"retd":0},
  {"name":"Hunter Thompson","team":"Bluestem","yr":"SR","pc":0,"pa":1,"py":0,"ptd":0,"pint":1,"ru":2,"ry":41,"rtd":1,"re":1,"rey":23,"retd":1},
  {"name":"Dallyn Ashley-Moore","team":"Bluestem","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":1,"rey":23,"retd":0},
  {"name":"Evan Worrell","team":"Bluestem","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":9,"ry":12,"rtd":0,"re":1,"rey":10,"retd":1},
  {"name":"Logan Squier","team":"Bluestem","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":51,"ry":459,"rtd":4,"re":1,"rey":3,"retd":0},
  {"name":"Emmett Brice","team":"Bluestem","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":1,"rey":3,"retd":0},
  {"name":"Ayson Shepherd","team":"Bluestem","yr":"JR","pc":11,"pa":21,"py":137,"ptd":3,"pint":1,"ru":84,"ry":385,"rtd":2,"re":0,"rey":0,"retd":0},
  {"name":"Myles Highbarger","team":"Bluestem","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":12,"ry":105,"rtd":2,"re":0,"rey":0,"retd":0},
  {"name":"Tucker Reed","team":"Bluestem","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":3,"ry":14,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Dominic Sawyer","team":"Circle","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":2,"ry":-3,"rtd":0,"re":33,"rey":555,"retd":5},
  {"name":"Jason Smith","team":"Circle","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":64,"ry":669,"rtd":7,"re":11,"rey":233,"retd":2},
  {"name":"Jay Bonewitz","team":"Circle","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":4,"ry":16,"rtd":0,"re":15,"rey":169,"retd":2},
  {"name":"Rocky Cosby","team":"Circle","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":12,"rey":128,"retd":0},
  {"name":"Bodie Janzen","team":"Circle","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":5,"rey":101,"retd":1},
  {"name":"Frank Ekue","team":"Circle","yr":"SR","pc":0,"pa":1,"py":0,"ptd":0,"pint":0,"ru":86,"ry":343,"rtd":3,"re":7,"rey":62,"retd":0},
  {"name":"Aymon Oliver","team":"Circle","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":14,"ry":25,"rtd":0,"re":3,"rey":42,"retd":0},
  {"name":"Gabe Duncan","team":"Circle","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":3,"rey":19,"retd":0},
  {"name":"Cody Hoefer","team":"Circle","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":1,"rey":1,"retd":0},
  {"name":"Cole Wilbur","team":"Circle","yr":"SO","pc":48,"pa":101,"py":632,"ptd":4,"pint":5,"ru":45,"ry":85,"rtd":1,"re":0,"rey":0,"retd":0},
  {"name":"Jarrion Johnson","team":"Circle","yr":"FR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":3,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Mason Stobart","team":"Circle","yr":"SR","pc":42,"pa":95,"py":678,"ptd":6,"pint":6,"ru":6,"ry":-39,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Bronsyn Knisley","team":"Douglass","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":22,"rey":531,"retd":7},
  {"name":"Carter Green","team":"Douglass","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":105,"ry":724,"rtd":12,"re":10,"rey":99,"retd":2},
  {"name":"Wyatt Moore","team":"Douglass","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":2,"ry":-4,"rtd":0,"re":8,"rey":82,"retd":0},
  {"name":"Brody Rush","team":"Douglass","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":2,"rey":65,"retd":0},
  {"name":"Justin West","team":"Douglass","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":8,"rey":57,"retd":0},
  {"name":"Charlie Kielhorn","team":"Douglass","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":30,"ry":140,"rtd":1,"re":2,"rey":38,"retd":0},
  {"name":"Ryan Stiner","team":"Douglass","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":14,"ry":101,"rtd":1,"re":2,"rey":37,"retd":0},
  {"name":"Hunter West","team":"Douglass","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":61,"ry":215,"rtd":0,"re":2,"rey":3,"retd":0},
  {"name":"Kane Ast","team":"Douglass","yr":"JR","pc":54,"pa":114,"py":910,"ptd":10,"pint":9,"ru":56,"ry":224,"rtd":1,"re":0,"rey":0,"retd":0},
  {"name":"Oliver Tilton","team":"Douglass","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":8,"ry":20,"rtd":1,"re":0,"rey":0,"retd":0},
  {"name":"Cooper Prather","team":"Douglass","yr":"FR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":2,"ry":5,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Jaxson Brewer","team":"Douglass","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":4,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Peyton Wight","team":"El Dorado","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":23,"ry":-18,"rtd":0,"re":16,"rey":149,"retd":0},
  {"name":"Nellieon Williams","team":"El Dorado","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":8,"rey":100,"retd":0},
  {"name":"Hunter Conrad","team":"El Dorado","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":44,"ry":160,"rtd":0,"re":8,"rey":69,"retd":1},
  {"name":"Kingston Klein","team":"El Dorado","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":4,"rey":54,"retd":0},
  {"name":"DJ Mitchell","team":"El Dorado","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":5,"ry":-6,"rtd":0,"re":3,"rey":48,"retd":0},
  {"name":"Maddix Soper","team":"El Dorado","yr":"JR","pc":0,"pa":1,"py":0,"ptd":0,"pint":0,"ru":3,"ry":4,"rtd":0,"re":5,"rey":46,"retd":1},
  {"name":"Kolby Cooper","team":"El Dorado","yr":"FR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":2,"rey":28,"retd":0},
  {"name":"Cameron Fullerton","team":"El Dorado","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":2,"rey":14,"retd":0},
  {"name":"Daniel Bowlin","team":"El Dorado","yr":"JR","pc":53,"pa":130,"py":508,"ptd":2,"pint":9,"ru":74,"ry":11,"rtd":1,"re":1,"rey":13,"retd":0},
  {"name":"Jaxson Markowitz","team":"El Dorado","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":8,"ry":3,"rtd":0,"re":1,"rey":-1,"retd":0},
  {"name":"Britton Wescott","team":"El Dorado","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":3,"rey":-3,"retd":0},
  {"name":"Skyler Demel","team":"El Dorado","yr":"SO","pc":1,"pa":2,"py":13,"ptd":0,"pint":1,"ru":2,"ry":-18,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Ty Finley","team":"Flinthills","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":11,"ry":40,"rtd":0,"re":13,"rey":201,"retd":6},
  {"name":"Beau Hall","team":"Flinthills","yr":"JR","pc":2,"pa":4,"py":13,"ptd":0,"pint":0,"ru":151,"ry":1331,"rtd":22,"re":12,"rey":159,"retd":1},
  {"name":"Hunter Davis","team":"Flinthills","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":-4,"rtd":0,"re":6,"rey":78,"retd":0},
  {"name":"Garrett Jackson","team":"Flinthills","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":4,"rey":70,"retd":0},
  {"name":"Taylor Carroll","team":"Flinthills","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":3,"ry":9,"rtd":1,"re":5,"rey":43,"retd":0},
  {"name":"Deken Girty","team":"Flinthills","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":7,"rey":40,"retd":0},
  {"name":"Jaxon Swafford","team":"Flinthills","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":4,"ry":16,"rtd":0,"re":2,"rey":25,"retd":0},
  {"name":"Tripp Carney","team":"Flinthills","yr":"JR","pc":37,"pa":86,"py":498,"ptd":6,"pint":3,"ru":47,"ry":252,"rtd":6,"re":3,"rey":19,"retd":0},
  {"name":"Cody Wells","team":"Flinthills","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":8,"rtd":0,"re":1,"rey":8,"retd":0},
  {"name":"Newell Marsh","team":"Flinthills","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":3,"ry":-9,"rtd":0,"re":3,"rey":0,"retd":0},
  {"name":"Kaleb Grunder","team":"Flinthills","yr":"SO","pc":11,"pa":24,"py":96,"ptd":1,"pint":3,"ru":14,"ry":26,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Mason Randall","team":"Flinthills","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":3,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Shawn Kenneson","team":"Flinthills","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":1,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Aiden Davis","team":"Flinthills","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":-4,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Talon Scribner","team":"Flinthills","yr":"JR","pc":2,"pa":2,"py":8,"ptd":0,"pint":0,"ru":2,"ry":-8,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Parker Sutton","team":"Flinthills","yr":"SR","pc":0,"pa":1,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Sam Tillotson","team":"Remington","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":15,"rey":200,"retd":0},
  {"name":"Elliott Hochstetler","team":"Remington","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":11,"rey":162,"retd":1},
  {"name":"Ryder Armstrong","team":"Remington","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":14,"ry":8,"rtd":0,"re":14,"rey":146,"retd":0},
  {"name":"Severo De La Rosa","team":"Remington","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":1,"ry":1,"rtd":0,"re":14,"rey":140,"retd":0},
  {"name":"Skylar Knowles","team":"Remington","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":4,"ry":14,"rtd":0,"re":10,"rey":134,"retd":0},
  {"name":"Ethan Zeurcher","team":"Remington","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":6,"ry":15,"rtd":0,"re":7,"rey":70,"retd":0},
  {"name":"Asher Irving","team":"Remington","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":4,"rey":61,"retd":0},
  {"name":"Ethan Koehn","team":"Remington","yr":"FR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":2,"ry":4,"rtd":0,"re":6,"rey":58,"retd":1},
  {"name":"Darian Schwind","team":"Remington","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":75,"ry":413,"rtd":2,"re":8,"rey":22,"retd":0},
  {"name":"Breeson George","team":"Remington","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":1,"rey":9,"retd":0},
  {"name":"Pius Graf","team":"Remington","yr":"SR","pc":92,"pa":179,"py":994,"ptd":5,"pint":12,"ru":92,"ry":244,"rtd":5,"re":0,"rey":0,"retd":0},
  {"name":"Darius Hancock","team":"Remington","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":51,"ry":207,"rtd":1,"re":0,"rey":0,"retd":0},
  {"name":"Kaden Kramer","team":"Remington","yr":"FR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":3,"ry":22,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Rueben Jury","team":"Remington","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":4,"ry":19,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Caleb Klingenberg","team":"Remington","yr":"FR","pc":4,"pa":7,"py":52,"ptd":0,"pint":0,"ru":6,"ry":-1,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Sebastian Bentley","team":"Rose Hill","yr":"SR","pc":0,"pa":1,"py":0,"ptd":0,"pint":0,"ru":7,"ry":30,"rtd":1,"re":13,"rey":185,"retd":1},
  {"name":"Cooper Dees","team":"Rose Hill","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":8,"rey":165,"retd":2},
  {"name":"KJ Jones","team":"Rose Hill","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":108,"ry":985,"rtd":17,"re":6,"rey":144,"retd":2},
  {"name":"Leven Jones","team":"Rose Hill","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":2,"rey":33,"retd":1},
  {"name":"Kai Kirchhoff-Jones","team":"Rose Hill","yr":"JR","pc":0,"pa":1,"py":0,"ptd":0,"pint":0,"ru":80,"ry":618,"rtd":7,"re":1,"rey":25,"retd":0},
  {"name":"Remington Merlau","team":"Rose Hill","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":16,"ry":32,"rtd":1,"re":2,"rey":16,"retd":0},
  {"name":"Andrew Poss","team":"Rose Hill","yr":"JR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":0,"ry":0,"rtd":0,"re":1,"rey":7,"retd":0},
  {"name":"Kaden Stuhr","team":"Rose Hill","yr":"SR","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":9,"ry":167,"rtd":2,"re":1,"rey":1,"retd":0},
  {"name":"Isaac Hill","team":"Rose Hill","yr":"JR","pc":0,"pa":2,"py":0,"ptd":0,"pint":0,"ru":8,"ry":115,"rtd":0,"re":0,"rey":0,"retd":0},
  {"name":"Zander Ford","team":"Rose Hill","yr":"JR","pc":30,"pa":75,"py":531,"ptd":6,"pint":4,"ru":34,"ry":113,"rtd":2,"re":0,"rey":0,"retd":0},
  {"name":"Elias Hernandez","team":"Rose Hill","yr":"SO","pc":0,"pa":0,"py":0,"ptd":0,"pint":0,"ru":12,"ry":34,"rtd":0,"re":0,"rey":0,"retd":0}
];

/* Names for jersey numbers a game's own roster doesn't have. A scorer may start a game with half a roster; the
   fuller one saved later for the school (on its page or in Setup) names the rest, for display only: nothing is
   written back to the game. Pages that already watch the shared rosters use them; a viewer's page asks for
   just that school's copies, and only when a game shows a number with no name. */
const rosterFill = {};
function fillName(teamName, n, s){
  const k = teamName && canonSchool(teamName); if (!k || n == null || n === '' || n === 'team') return '';
  if (sharedRosters.list){ const b = bestRoster(teamName); return b ? rosterGet(b.roster, n, s) || '' : ''; }
  if (!ui.viewer) return '';
  if (!(k in rosterFill)) loadFillRoster(teamName);
  return rosterFill[k] ? rosterGet(rosterFill[k], n, s) || '' : '';
}
async function loadFillRoster(name){
  const k = canonSchool(name); rosterFill[k] = null;
  try {
    const {fsM, fsdb} = await viewerApi();
    const snap = await fsM.getDocs(fsM.query(fsM.collection(fsdb, 'pressbox'), fsM.where('public', '==', true),
      fsM.where('kind', '==', 'roster'), fsM.where('title', '==', `${name} roster`)));
    let best = null;
    snap.forEach(d => {
      const v = d.data(); if (v.deleted || !v.json) return;
      try { const r = JSON.parse(v.json), c = Object.keys(r.roster || {}).length;
        if (c && (!best || c > best.c || (c === best.c && (r.updated || 0) > best.u))) best = {roster:r.roster, c, u:r.updated || 0}; } catch (e) {}
    });
    if (!best) return;
    rosterFill[k] = best.roster;
    clearTimeout(loadFillRoster.t); loadFillRoster.t = setTimeout(rosterFilled, 50);
  } catch (e) {}
}
function rosterFilled(){
  if (ui.county) return renderCounty();
  if (g && ui.viewer) refresh();
  if (ui.board) renderScoreboard();
}
