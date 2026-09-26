/* ================================================================
   Saved teams: each school's short name, color and roster, kept so a
   new game fills itself in. Saved in this browser and, when signed in,
   to the account as one private "teams-<uid>" document in the same
   pressbox collection (so the existing Firestore rules already cover it).
   ================================================================ */
const teamKey = s => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const DEFAULT_TEAM_NAMES = ['', 'visitors', 'home'];
const teamLib = () => db.teams || (db.teams = {});
const savedTeams = () => Object.values(teamLib()).filter(t => !t.deleted && t.name).sort((a, b) => a.name.localeCompare(b.name));
function findTeam(name){ const t = teamLib()[teamKey(name)]; return t && !t.deleted ? t : null; }
const rosterToText = r => Object.entries(r || {}).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([n, v]) => `${n} ${v}`).join('\n');
function parseRosterText(txt){
  const o = {};
  // "7/82 Brett Lemonds SR": a player who wears 7 at home and 82 on the road, kept as "7/82" (home first).
  // A line copied from a spreadsheet has its columns (class, positions, height, weight): the name and class are kept.
  String(txt || '').split('\n').forEach(l => {
    const m = l.match(/^\s*#?(\d{1,2})(?:\s*\/\s*(\d{1,2}))?\s*[-–,.:)]?\s*(.+?)\s*$/); if (!m) return;
    const name = rosterNameCase(splitClass(m[3]).name), yr = splitClass(m[3]).yr;
    if (name) o[m[2] && m[2] !== m[1] ? `${m[1]}/${m[2]}` : m[1]] = yr ? `${name} ${yr}` : name;
  });
  return o;
}
// "BRETT LEMONDS" reads as "Brett Lemonds" in the play-by-play; a name typed in ordinary capitals is left alone.
function rosterNameCase(s){
  if (!/[A-Z]{2}/.test(s) || /[a-z]/.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bMc([a-z])/g, (m, a) => 'Mc' + a.toUpperCase());
}
// From a game's Setup. A newer save wins, and an empty roster or mascot never wipes out a saved one.
function rememberTeam(t, when = Date.now()){
  const k = teamKey(t.name); if (DEFAULT_TEAM_NAMES.includes(k)) return false;
  const cur = teamLib()[k];
  if (cur && (cur.updated || 0) > when) return false;
  const keep = cur && !cur.deleted ? cur : {};
  teamLib()[k] = {name:t.name, mascot:t.mascot || keep.mascot || '', abbr:t.abbr, color:t.color,
    roster:{...(Object.keys(t.roster || {}).length ? t.roster : keep.roster)}, updated:when};
  return true;
}
function forgetTeam(k){ teamLib()[k] = {deleted:true, name:'', updated:Date.now()}; }
// First run: teams from games already set up go into the library (never over a deletion).
function seedTeamLibrary(){
  let added = false;
  Object.values(db.games).forEach(x => {
    // A record saved without teams (a half-finished game, or one that arrived from another device mid-write) must
    // not take the whole page down on the way in.
    if (!x || x.sample || !x.teams || !x.teams.A || !x.teams.H) return;
    ['A', 'H'].forEach(s => { if (!teamLib()[teamKey(x.teams[s].name)]) added = rememberTeam(x.teams[s], x.updated || x.created || 0) || added; });
  });
  if (added) persist();
}

/* ---------- sync: one document per account ---------- */
const teamsDocId = () => 'teams-' + (sync.user ? sync.user.uid : '');
let teamTimer = null;
function syncTeams(delay = 700){
  if (!sync.user || !sync.api) return;
  clearTimeout(teamTimer);
  teamTimer = setTimeout(() => {
    const {fsM, fsdb} = sync.api;
    fsM.setDoc(fsM.doc(fsdb, 'pressbox', teamsDocId()), {owner:sync.user.uid, updated:Date.now(), public:false, kind:'teams', json:JSON.stringify(teamLib())})
      .catch(e => { sync.err = friendlySync(e); sync.state = 'error'; renderSync(); });
    shareRosters();          // the rosters themselves belong to the schools: everyone gets them
  }, delay);
}
// Team by team, whichever copy was saved last wins.
function mergeTeams(json){
  let remote; try { remote = JSON.parse(json || '{}') || {}; } catch (e) { return; }
  const lib = teamLib(); let changed = false, mineNewer = false;
  for (const k of new Set([...Object.keys(lib), ...Object.keys(remote)])){
    const a = lib[k], b = remote[k];
    if (b && (!a || (b.updated || 0) > (a.updated || 0))){ lib[k] = b; changed = true; }
    else if (a && (!b || (a.updated || 0) > (b.updated || 0))) mineNewer = true;
  }
  // Teams arriving from another device refresh whichever window is showing them.
  if (changed){ persist(); if (dlg().open && (ui.dlg === 'teams' || ui.dlg === 'games')) dlg().innerHTML = ui.dlg === 'teams' ? dlgTeams() : dlgGames(); }
  if (mineNewer) syncTeams(0);
}

/* ---------- the Games screen's Saved teams section, and the team editor ---------- */
function teamsBlock(){
  const list = savedTeams();
  return `<div class="grp"><h3>Saved teams</h3>
    <p class="hint">A school's short name, color and roster are saved whenever you set up a game. Type a saved school's name in a new game and they fill in.</p>
    ${list.length ? `<div class="glist">${list.map(t => { const k = teamKey(t.name);
      return `<div class="gitem"><div><b>${esc(t.name)}</b><div class="meta">${esc(t.abbr || '')}${t.mascot ? ' · ' + esc(t.mascot) : ''} · ${plural2(Object.keys(t.roster || {}).length, 'player')}</div></div>
        <div class="acts"><button class="btn small" data-team-edit="${esc(k)}">Edit</button><button class="btn small danger" data-team-del="${esc(k)}">${ui.confirm === 't:' + k ? 'Tap again' : 'Delete'}</button></div></div>`; }).join('')}</div>`
      : '<p class="hint">No saved teams yet.</p>'}
    <div class="line"><button class="btn small" data-team-edit="">Add a team</button></div></div>`;
}
// Saved teams get their own window: the games list runs long, and teams shouldn't be buried under it.
function dlgTeams(){
  return `${dlgHead('Teams')}<div class="dlg-bd">${teamsBlock()}</div>
    <div class="dlg-ft"><button type="button" class="btn" data-open="games">Games</button><button type="button" class="btn primary" data-close>Done</button></div>`;
}
function dlgTeam(key){
  const t = (key && findTeam(key)) || {name:'', mascot:'', abbr:'', color:'#1F4E9C', roster:{}};
  return `${dlgHead(key ? 'Edit team' : 'Add a team')}<div class="dlg-bd"><div class="grp"><div class="teamset">
      <div class="fld"><label class="eyebrow" for="t-name">School</label>${schoolPicker('t-name', t.name, 'School name')}</div>
      <div class="fld"><label class="eyebrow" for="t-mascot">Mascot</label><input class="inp" id="t-mascot" value="${esc(t.mascot || '')}" placeholder="e.g. Bulldogs"></div>
      <div class="fld"><label class="eyebrow" for="t-abbr">Short</label><input class="inp" id="t-abbr" maxlength="5" value="${esc(t.abbr || '')}"></div>
      <div class="fld"><label class="eyebrow" for="t-color">Color</label><input type="color" id="t-color" value="${esc(t.color || '#1F4E9C')}"></div></div>
    <div class="fld"><label class="eyebrow" for="t-roster">Roster · one player per line, number then name</label>
      <textarea class="inp" id="t-roster" rows="10" placeholder="7 Cole Brandt&#10;22 Mason Ortiz">${esc(rosterToText(t.roster))}</textarea></div></div></div>
    <div class="dlg-ft"><button type="button" class="btn" data-open="teams">Back</button><button type="button" class="btn primary" data-team-save="${esc(key || '')}">Save team</button></div>`;
}
function saveTeamDialog(oldKey){
  const name = $('#t-name').value.trim();
  if (!name) return toast('Give the team a name');
  if (!schoolsSettled(['t-name'], () => saveTeamDialog(oldKey))) return;
  const t = {name, mascot:$('#t-mascot').value.trim(), abbr:($('#t-abbr').value.trim() || name.replace(/[^A-Za-z]/g, '').slice(0, 4)).toUpperCase(), color:$('#t-color').value, roster:parseRosterText($('#t-roster').value)};
  if (oldKey && oldKey !== teamKey(name)) forgetTeam(oldKey);
  teamLib()[teamKey(name)] = {...t, updated:Date.now()};   // an edit here replaces the saved roster outright
  persist(); syncTeams(); shareRoster(t); openDialog('teams'); toast('Team saved');
}

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('button'); if (!b || ui.viewer) return;
  const d = b.dataset;
  if ('teamEdit' in d){ ui.teamKey = d.teamEdit; return openDialog('team'); }
  if (d.teamDel){
    const k = d.teamDel;
    if (ui.confirm !== 't:' + k){ ui.confirm = 't:' + k; dlg().innerHTML = dlgGames(); return; }
    forgetTeam(k); ui.confirm = null; persist(); syncTeams(); dlg().innerHTML = dlgGames(); return toast('Team removed');
  }
  if ('teamSave' in d) return saveTeamDialog(d.teamSave);
  if (d.useroster){
    const s = d.useroster, t = findTeam($(`#s-${s}-name`).value);
    if (t){ $(`#s-${s}-roster`).value = rosterToText(t.roster); $(`#s-${s}-lib`).textContent = 'Using the saved roster.'; }
  }
});
// Typing a saved school's name in Setup fills its mascot, short name, color and (if the box is empty) roster.
document.addEventListener('input', e => {
  const el = e.target; if (!el.id || !/^s-[AH]-name$/.test(el.id)) return;
  const s = el.id[2], t = findTeam(el.value), hint = $(`#s-${s}-lib`);
  // Nothing saved for this school here — someone else may still have put its roster up.
  if (!t){ if (hint) hint.textContent = ''; fillSharedRoster(s, el.value); return; }
  $(`#s-${s}-mascot`).value = t.mascot || '';
  $(`#s-${s}-abbr`).value = t.abbr || '';
  $(`#s-${s}-color`).value = t.color || '#1F4E9C';
  const box = $(`#s-${s}-roster`), n = Object.keys(t.roster || {}).length;
  if (!n){ hint.textContent = 'Filled from your saved teams.'; fillSharedRoster(s, el.value); }
  else if (!box.value.trim() || box.value === box.dataset.auto){ box.value = box.dataset.auto = rosterToText(t.roster); hint.textContent = `Filled from your saved teams: ${plural2(n, 'player')}.`; }
  else hint.innerHTML = `Saved roster has ${plural2(n, 'player')}. <button type="button" class="linkbtn" data-useroster="${s}">Use it</button>`;
});
