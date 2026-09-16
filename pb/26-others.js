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
  return `<div class="gitem"><div><b>${esc(A.abbr || A.name)} ${m.pre ? '' : m.score.A} at ${esc(H.abbr || H.name)} ${m.pre ? '' : m.score.H}</b>`
    + `<span class="cur-tag"${o.shared ? '' : ' style="color:var(--flag-ink)"'}>${o.shared ? 'Shared' : 'Not shared'}</span>
    <div class="meta">${esc(A.name)} at ${esc(H.name)} · ${gameDay(x).toLocaleDateString()} · ${esc(m.status)} · ${how} · scorer ${esc(o.owner.slice(0, 6))} · updated ${agoText(o.updated)}</div></div>
    <div class="acts">${watch}</div></div>`;
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
