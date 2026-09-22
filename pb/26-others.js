/* ================================================================
   Others (admin only): every other scorer's games, shared or not, in
   their own window beside Games. Read-only: open one to watch it.
   The database lets only the admin's account read the unshared ones
   (fb stats/firestore.rules, isAdmin).
   ================================================================ */
const others = {list:null, err:'', unsub:null, show:'all'};
const agoText = ms => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`;
};
// Every game another scorer keeps: tracked games, box scores and quick scores (not their saved rosters or team
// lists). Live, so a game in progress updates while the window is open.
function watchOthers(){
  if (others.unsub || !sync.api || !sync.user || sync.user.uid !== ADMIN_UID) return;
  const {fsM, fsdb} = sync.api;
  const redraw = () => { if (ui.dlg === 'others' && dlg().open) dlg().innerHTML = dlgOthers(); };
  others.unsub = fsM.onSnapshot(fsM.collection(fsdb, 'pressbox'), snap => {
    const list = [];
    snap.forEach(d => {
      const v = d.data();
      if (v.deleted || !v.json || v.owner === ADMIN_UID || ['roster', 'teams', 'hidden', 'records'].includes(v.kind)) return;
      try {
        const x = Object.assign(JSON.parse(v.json), {id:d.id});
        if (x.teams && x.teams.A && x.teams.H) list.push({x, owner:v.owner || '', shared:!!v.public, updated:v.updated || x.updated || 0});
      } catch (e) {}
    });
    others.list = list.sort((a, b) => b.updated - a.updated); others.err = ''; redraw();
  }, e => {
    others.unsub = null;   // opening the window again tries again
    others.err = String((e && e.code) || '').includes('permission')
      ? 'The database isn’t letting your account read other scorers’ unshared games yet. Paste the updated rules (fb stats/firestore.rules) into the Firebase console and Publish, then open this again.'
      : 'Can’t load other scorers’ games right now. Check your connection and try again.';
    redraw();
  });
}
function othersRow(o){
  const {x} = o, A = x.teams.A, H = x.teams.H;
  let m; try { m = summary(Object.assign({plays:[]}, x)); } catch (e) { m = {score:{A:0, H:0}, status:'—', pre:true}; }
  const how = x.kind === 'score' ? 'quick score' : x.box ? 'box score' : `${(x.plays || []).length} plays`;
  // A quick score is just a score: there's no game behind it to watch.
  const watch = x.kind === 'score' ? '' : `<a class="btn small" href="?game=${encodeURIComponent(x.id)}" target="_blank" rel="noopener">Watch</a>`;
  // A quick score is a score and nothing else; there are no plays to fix.
  const mine = db.games[x.id] && db.games[x.id].foreign;
  const edit = x.kind === 'score' ? '' : `<button class="btn small${mine ? ' primary' : ''}" data-adopt="${esc(x.id)}">${mine ? 'Back to editing' : 'Edit'}</button>`;
  // Put another scorer's game on the scoreboards, or take it off again. It stays their game and keeps updating
  // as they enter plays; this only says whether everyone can see it.
  const live = `<button class="btn small${o.shared ? '' : ' primary'}" data-golive="${esc(x.id)}">${o.shared ? 'Take off' : 'Push live'}</button>`;
  return `<div class="gitem"><div><b>${esc(A.abbr || A.name)} ${m.pre ? '' : m.score.A} at ${esc(H.abbr || H.name)} ${m.pre ? '' : m.score.H}</b>`
    + `<span class="cur-tag"${o.shared ? '' : ' style="color:var(--flag-ink)"'}>${o.shared ? 'Shared' : 'Not shared'}</span>
    <div class="meta">${esc(A.name)} at ${esc(H.name)} · ${gameDay(x).toLocaleDateString()} · ${esc(m.status)} · ${how} · scorer ${esc(o.owner.slice(0, 6))} · updated ${agoText(o.updated)}</div></div>
    <div class="acts">${watch}${edit}${live}</div></div>`;
}
function dlgOthers(){
  let body;
  if (!sync.user || sync.user.uid !== ADMIN_UID) body = '<p class="hint">Only the admin account can see other scorers’ games. Sign in with it under Games.</p>';
  else if (others.err) body = `<p class="hint">${esc(others.err)}</p>`;
  else if (!others.list){ watchOthers(); body = '<p class="hint">Loading every scorer’s games…</p>'; }
  else {
    const L = others.list, notShared = L.filter(o => !o.shared).length, scorers = new Set(L.map(o => o.owner)).size;
    const rows = L.filter(o => others.show === 'all' || (others.show === 'private' ? !o.shared : o.shared));
    const pick = (k, label) => `<button type="button" class="btn small${others.show === k ? ' primary' : ''}" data-others-show="${k}">${label}</button>`;
    body = `<p class="hint">${L.length} game${L.length === 1 ? '' : 's'} from ${scorers} other scorer${scorers === 1 ? '' : 's'}${notShared ? ` · ${notShared} not shared` : ''}. Only you can see this list.</p>
      <div class="line">${pick('all', 'All')}${pick('private', 'Not shared')}${pick('shared', 'Shared')}</div>
      <div class="glist">${rows.map(othersRow).join('') || '<p class="hint">None here.</p>'}</div>`;
  }
  return `${dlgHead('Others')}<div class="dlg-bd">${body}</div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-others-show]'); if (!b) return;
  others.show = b.dataset.othersShow; dlg().innerHTML = dlgOthers();
});

/* ---------- editing someone else's game ----------
   A game opened from this window is a copy on this device, marked with whose
   it is. It syncs nowhere on its own: the admin saves it back to the scorer's
   own record on purpose, and only after the database agrees that the scorer
   hasn't changed it in the meantime. */
function adoptGame(id){
  // Already editing it: go back to that copy rather than throwing away the work in it.
  if (db.games[id] && db.games[id].foreign){
    g = db.games[id]; resetUi(); setCurrent(); closeDialog(); refresh();
    return toast('Back to your copy of their game');
  }
  const o = (others.list || []).find(v => v.x.id === id);
  if (!o) return toast('That game isn’t loaded any more');
  let copy; try { copy = soundGame(JSON.parse(JSON.stringify(o.x))); } catch (e) { copy = null; }
  if (!copy) return toast('That game can’t be opened');
  copy.foreign = {uid:o.owner, base:o.updated || copy.updated || 0};
  db.games[id] = copy; g = copy; resetUi(); setCurrent(); closeDialog(); refresh();
  toast(`Editing ${scorerName(o.owner)}’s game`);
}
const scorerName = uid => `scorer ${String(uid || '').slice(0, 6)}`;

/* ---------- putting someone else's game on the scoreboards ----------
   The database lets the admin change another scorer's game as long as it stays theirs (firestore.rules,
   isAdmin), so this sets the one field that decides who can see it. Nothing else about the game is touched:
   they go on keeping it, and every play they enter shows up live. The week goes in alongside, because that is
   what the scoreboards ask the database for, and a game saved before weeks existed hasn't got one. */
async function pushOthersLive(id){
  const o = (others.list || []).find(v => v.x.id === id);
  if (!o || !sync.api || !sync.user) return toast('That game isn’t loaded any more');
  const on = !o.shared;
  try {
    const {fsM, fsdb} = sync.api;
    await fsM.updateDoc(fsM.doc(fsdb, 'pressbox', id), {public:on, week:gameWeek(o.x)});
    // A game taken off the scoreboards by hand shouldn't come back as hidden as well.
    if (on && hideList.ids.has(id)) toggleHide(id);
    toast(on ? `${o.x.teams.A.name} at ${o.x.teams.H.name} is live on the scoreboards` : 'Taken off the scoreboards');
  } catch (e) {
    toast(String((e && e.code) || '').includes('permission')
      ? 'The database wouldn’t allow that. Publish the updated rules (fb stats/firestore.rules), then try again.'
      : 'Couldn’t change that game. Check your connection and try again.');
  }
}

// Said plainly, above the game, the whole time it is open.
function renderForeign(){
  const el = $('#foreign'); if (!el) return;
  const f = !ui.viewer && g && g.foreign;
  el.hidden = !f;
  if (!f) return;
  const saved = (g.updated || 0) <= f.base;
  el.innerHTML = `<span>Editing <b>${esc(scorerName(f.uid))}</b>’s game. Changes stay on this device until you save them back.</span>`
    + `<button type="button" class="${saved ? 'done' : ''}" data-foreign="save">${ui.confirm === 'foreign' ? 'Save anyway' : saved ? 'Saved' : 'Save to their game'}</button>`
    + `<button type="button" class="done" data-foreign="drop">${ui.confirm === 'drop' ? 'Tap again to close' : 'Close their game'}</button>`;
}

async function saveForeign(force){
  const f = g && g.foreign; if (!f) return;
  if (!sync.api || !sync.user || sync.user.uid !== ADMIN_UID) return toast('Sign in with the admin account first');
  const {fsM, fsdb} = sync.api, game = g, ref = fsM.doc(fsdb, 'pressbox', game.id);
  try {
    const snap = await fsM.getDoc(ref);
    if (!snap.exists()) return toast('That game is no longer in the database');
    const d = snap.data();
    // The scorer has been at it since this copy was taken: say so rather than wiping their work.
    if (!force && (d.updated || 0) > f.base){
      ui.confirm = 'foreign'; renderForeign();
      return toast('They’ve changed this game since you opened it — Save anyway to replace theirs');
    }
    const now = Date.now();
    const out = Object.assign({}, game, {updated:now}); delete out.foreign;
    await fsM.setDoc(ref, {owner:d.owner, updated:now, public:!!d.public, week:gameWeek(out),
      title:`${out.teams.A.abbr} at ${out.teams.H.abbr}`, card:shareCard(out), json:JSON.stringify(out)});
    game.updated = now; f.base = now; ui.confirm = null;
    setCurrent(); renderForeign();
    toast('Saved to their game');
  } catch (e) {
    const code = String((e && e.code) || '');
    toast(code.includes('permission')
      ? 'The database won’t let you change another scorer’s game yet. Publish the updated rules (firestore.rules) in the Firebase console.'
      : friendlySync(e) || 'Couldn’t save to their game');
  }
}

function dropForeign(){
  if (!g || !g.foreign) return;
  const unsaved = (g.updated || 0) > g.foreign.base;
  if (unsaved && ui.confirm !== 'drop'){ ui.confirm = 'drop'; renderForeign(); return toast('Close without saving? Tap Close again'); }
  delete db.games[g.id]; ui.confirm = null;
  g = newestGame() || sampleGame(); resetUi(); ui.start = idleGame(g); setCurrent(); refresh();
  toast('Closed their game');
}

document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('[data-adopt]');
  if (a) return adoptGame(a.dataset.adopt);
  const L = e.target.closest && e.target.closest('[data-golive]');
  if (L) return void pushOthersLive(L.dataset.golive);
  const b = e.target.closest && e.target.closest('[data-foreign]'); if (!b) return;
  if (b.dataset.foreign === 'save') return saveForeign(ui.confirm === 'foreign');
  if (b.dataset.foreign === 'drop') return dropForeign();
});
