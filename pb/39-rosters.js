/* ================================================================
   Shared rosters.

   A roster belongs to the school, not to the scorer who typed it.
   Saved teams stay private to each account ("teams-<uid>"), but the
   roster inside one is copied to a shared book every scorer reads:
   one document per school in the `rosters` collection, readable by
   anyone, writable by anyone signed in.

   Two crews who each know half a team end up with the whole team:
   a write merges into what's already there by jersey number rather
   than replacing it, and the newer entry wins a number they share.
   ================================================================ */
const rosterBook = {got:{}, sent:{}, busy:false};

// Everything this scorer has, published for everyone else. Called after a team is saved.
function shareRosters(){
  if (!sync.user || !sync.api) return;
  Object.values(teamLib()).forEach(t => {
    if (!t || t.deleted || !t.name) return;
    const n = Object.keys(t.roster || {}).length; if (!n) return;
    const key = teamKey(t.name), stamp = `${n}:${t.updated || 0}`;
    if (rosterBook.sent[key] === stamp) return;          // already up there as it stands
    rosterBook.sent[key] = stamp;
    shareOne(key, t).catch(() => { delete rosterBook.sent[key]; });
  });
}

// One school. Read what's there, put our numbers over it, write the lot back.
async function shareOne(key, t){
  const {fsM, fsdb} = sync.api, ref = fsM.doc(fsdb, 'rosters', key);
  let had = {}, theirs = {};
  try {
    const d = await fsM.getDoc(ref);
    if (d.exists()){ had = d.data() || {}; try { theirs = JSON.parse(had.json || '{}') || {}; } catch (e) {} }
  } catch (e) {}
  const mine = t.roster || {}, merged = {...theirs};
  // Ours wins a number we both have only if our copy is the newer one.
  const newer = (t.updated || 0) >= (had.updated || 0);
  Object.entries(mine).forEach(([k, v]) => { if (newer || !merged[k]) merged[k] = v; });
  if (JSON.stringify(merged) === JSON.stringify(theirs)) return;   // nothing to add
  await fsM.setDoc(ref, {school:t.name, by:sync.user.uid, updated:Date.now(),
    n:Object.keys(merged).length, json:JSON.stringify(merged)});
}

// The shared roster for a school, or null. Kept once it's been read.
async function sharedRoster(name){
  const key = teamKey(name); if (!key) return null;
  if (key in rosterBook.got) return rosterBook.got[key];
  const api = sync.api || (typeof viewerApi === 'function' ? await viewerApi().catch(() => null) : null);
  if (!api) return null;
  try {
    const d = await api.fsM.getDoc(api.fsM.doc(api.fsdb, 'rosters', key));
    const r = d.exists() ? JSON.parse(d.data().json || '{}') : null;
    return (rosterBook.got[key] = r && Object.keys(r).length ? r : null);
  } catch (e) { return (rosterBook.got[key] = null); }
}

// Setup: a school with no roster of its own takes the shared one, the same way a saved team fills it in.
async function fillSharedRoster(s, name){
  const box = $(`#s-${s}-roster`), hint = $(`#s-${s}-lib`);
  if (!box || (box.value.trim() && box.value !== box.dataset.auto)) return;   // typed by hand: leave it alone
  const r = await sharedRoster(name);
  if (!r) return;
  const now = $(`#s-${s}-name`); if (!now || teamKey(now.value) !== teamKey(name)) return;   // they moved on
  if (box.value.trim() && box.value !== box.dataset.auto) return;
  box.value = box.dataset.auto = rosterToText(r);
  if (hint) hint.textContent = `Filled from the shared roster book: ${plural2(Object.keys(r).length, 'player')}.`;
}
