/* ================================================================
   The school list, as the admin keeps it. Schools come from
   logos/teams.json, and this is the layer on top: a different short
   name for a school, a school hidden from the pickers, or a school
   the list doesn't have yet. One public document the admin writes and
   everyone reads (the same trick as the hidden-games list), so no
   rules change and no editing the file by hand.
   ================================================================ */
const SCHOOLS_DOC = 'schools-list';
const schoolsDoc = {abbr:{}, hidden:[], added:[], api:null, unsub:null};
const schoolsHidden = () => new Set(schoolsDoc.hidden.map(logoSlug));

function watchSchools(api){
  schoolsDoc.api = api;
  if (schoolsDoc.unsub) return;
  const {fsM, fsdb} = api;
  // Until the admin saves one there is no document, and reading it is refused: then nothing is overridden.
  schoolsDoc.unsub = fsM.onSnapshot(fsM.doc(fsdb, 'pressbox', SCHOOLS_DOC), snap => {
    const d = snap.exists() ? snap.data() : null;
    let j = {};
    if (d && d.owner === ADMIN_UID && !d.deleted){ try { j = JSON.parse(d.json) || {}; } catch (e) {} }
    schoolsDoc.abbr = j.abbr || {}; schoolsDoc.hidden = j.hidden || []; schoolsDoc.added = j.added || [];
    schoolsChanged();
  }, () => { schoolsDoc.unsub = null; });
}
function schoolsChanged(){
  if (dlg().open && ui.dlg === 'schools') dlg().innerHTML = dlgSchools();
  renderScores(); renderScoreboard(); if (ui.county) renderCounty(); if (g && R) renderBoard();
}

// Every school the pickers offer: this site's own list plus any the admin added, minus the hidden ones.
function schoolsAll(){
  const own = (LOGO_SRC[0].list || []).map(t => t.name).filter(Boolean);
  const names = new Set([...own, ...schoolsDoc.added]);
  const hide = schoolsHidden();
  return [...names].filter(n => !hide.has(logoSlug(n))).sort((a, b) => a.localeCompare(b));
}
// A school's short name: the admin's, then the list's, then nothing (shortName() works one out).
function schoolAbbr(name){
  const k = logoSlug(name);
  for (const [n, v] of Object.entries(schoolsDoc.abbr)) if (logoSlug(n) === k && v) return v;
  return '';
}

/* ---------- the admin's Schools window ---------- */
function dlgSchools(){
  const q = (ui.schoolQ || '').trim().toLowerCase();
  const hide = schoolsHidden();
  const own = (LOGO_SRC[0].list || []).map(t => ({name:t.name, abbr:t.abbr || ''}));
  const all = [...own, ...schoolsDoc.added.map(n => ({name:n, abbr:''}))]
    .filter(t => t.name && (!q || t.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows = all.map(t => {
    const k = logoSlug(t.name), off = hide.has(k), shown = schoolAbbr(t.name) || t.abbr || shortName(t.name);
    return `<div class="sch-row${off ? ' off' : ''}"><span class="sch-nm">${esc(t.name)}</span>
      <input class="inp sch-ab" data-sch="${esc(t.name)}" value="${esc(shown)}" maxlength="12" autocomplete="off" aria-label="Short name for ${esc(t.name)}">
      <button type="button" class="btn small${off ? ' primary' : ' danger'}" data-sch-hide="${esc(t.name)}">${off ? 'Put back' : 'Remove'}</button></div>`;
  }).join('');
  return `${dlgHead('Schools')}<div class="dlg-bd">
    <p class="hint">Every school the pickers offer. Change a short name — two to four letters fits everywhere, longer is cut
      short in the scores strip — and it shows wherever that school appears. Remove the ones that don't play football and
      they're gone from the pickers; a game already played keeps its school, and Put back undoes it.</p>
    <div class="fld"><input class="inp" id="sch-q" placeholder="Search schools" value="${esc(ui.schoolQ || '')}" autocomplete="off"></div>
    <div class="sch-list">${rows || '<p class="hint">No school by that name.</p>'}</div>
    <div class="grp"><h3>Add a school</h3><div class="line">
      <input class="inp" id="sch-new" placeholder="School name" autocomplete="off" style="flex:1">
      <button type="button" class="btn small" data-sch-add>Add</button></div>
      <p class="hint">For a school the logo list doesn’t have yet. It gets a monogram until a logo is added.</p></div></div>
    <div class="dlg-ft"><button type="button" class="btn" data-close>Done</button><button type="button" class="btn primary" data-sch-save>Save short names</button></div>`;
}
async function saveSchools(patch, note){
  if (!ui.admin || !schoolsDoc.api) return toast('Sign in as the admin first');
  const next = {abbr:{...schoolsDoc.abbr}, hidden:[...schoolsDoc.hidden], added:[...schoolsDoc.added], ...patch};
  const {fsM, fsdb} = schoolsDoc.api;
  try {
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', SCHOOLS_DOC), {owner:ADMIN_UID, updated:Date.now(), public:true, kind:'schools',
      title:'The school list', json:JSON.stringify(next)});
    Object.assign(schoolsDoc, next); schoolsChanged(); toast(note);
    if (!schoolsDoc.unsub) watchSchools(schoolsDoc.api);   // the first save makes the document: follow it from now on
  } catch (e) { toast('Couldn’t save that. Sign in on the Game Tracker, then try again.'); }
}
// Only the short names that differ from the list are kept, so the file stays the source of truth.
function saveSchoolAbbrs(){
  const abbr = {...schoolsDoc.abbr};
  document.querySelectorAll('.sch-ab').forEach(el => {
    const name = el.dataset.sch, v = el.value.trim();
    const listed = ((LOGO_SRC[0].list || []).find(t => logoSlug(t.name) === logoSlug(name)) || {}).abbr || '';
    if (!v || v === listed) delete abbr[name]; else abbr[name] = v;
  });
  saveSchools({abbr}, 'Short names saved');
}
function toggleSchoolHidden(name){
  const hide = schoolsHidden(), k = logoSlug(name);
  const hidden = hide.has(k) ? schoolsDoc.hidden.filter(n => logoSlug(n) !== k) : [...schoolsDoc.hidden, name];
  saveSchools({hidden}, hide.has(k) ? `${name} is back` : `${name} removed`);
}
function addSchool(){
  const el = $('#sch-new'), name = el ? el.value.trim() : '';
  if (!name) return toast('Type the school’s name');
  if (schoolsAll().some(n => logoSlug(n) === logoSlug(name))) return toast('That school is already on the list');
  saveSchools({added:[...schoolsDoc.added, name]}, `${name} added`);
}

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if ('schSave' in d) return saveSchoolAbbrs();
  if (d.schHide) return toggleSchoolHidden(d.schHide);
  if ('schAdd' in d) return addSchool();
});
document.addEventListener('input', e => {
  if (e.target && e.target.id === 'sch-q'){ ui.schoolQ = e.target.value; const l = dlg().querySelector('.sch-list');
    if (l) l.outerHTML = dlgSchools().match(/<div class="sch-list">[\s\S]*?<\/div>\s*<div class="grp">/)[0].replace(/\s*<div class="grp">$/, ''); }
});
