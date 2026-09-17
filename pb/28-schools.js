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
      <p class="hint">For a school the logo list doesn’t have yet. It gets a monogram until a logo is added.</p></div>
    <div class="grp"><h3>Typed records</h3><div class="line">
      <button type="button" class="btn small danger" data-recs-clear>${ui.confirm === 'recs' ? 'Tap again to clear' : `Clear typed records (${Object.keys(teamRecs.map || {}).length})`}</button></div>
      <p class="hint">A record you type by hand on a team’s page wins over the games. Clear them and every school’s record
        is worked out from the finals on the site, which is what a pasted box score adds to.</p></div></div>
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
  if (e.target.closest && e.target.closest('[data-recs-clear]')) return clearTeamRecords();
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

/* ================================================================
   A school that isn't on the list. Anyone keeping a game can type
   one in: the picker suggests schools as they type, and a name that
   looks like one already on the list ("Andover Centrl", "Derby High
   School", "Classen" for "Northwest Classen") asks first — "Did you
   mean …?" — so the same school doesn't end up under two names. A
   school they add stays on their own list (this device, and their
   account when signed in), not everyone's.
   ================================================================ */
const mySchoolLib = () => db.schools || (db.schools = {});
const mySchoolNames = () => Object.values(mySchoolLib()).filter(s => s && !s.deleted && s.name).map(s => s.name);
const mySchoolsDocId = () => 'schools-' + (sync.user ? sync.user.uid : '');
let mySchoolTimer = null;
function addMySchool(name){
  const k = logoSlug(name); if (!k || DEFAULT_TEAM_NAMES.includes(k)) return;
  const cur = mySchoolLib()[k]; if (cur && !cur.deleted) return;
  mySchoolLib()[k] = {name, updated:Date.now()};
  persist(); syncMySchools();
  toast(`${name} is on your school list now`);
}
function syncMySchools(delay = 700){
  if (!sync.user || !sync.api) return;
  clearTimeout(mySchoolTimer);
  mySchoolTimer = setTimeout(() => {
    const {fsM, fsdb} = sync.api;
    fsM.setDoc(fsM.doc(fsdb, 'pressbox', mySchoolsDocId()), {owner:sync.user.uid, updated:Date.now(), public:false, kind:'my-schools',
      json:JSON.stringify(mySchoolLib())}).catch(() => {});
  }, delay);
}
// The same school list from another of this scorer's devices: newest wins, school by school.
function mergeMySchools(json){
  let remote; try { remote = JSON.parse(json || '{}') || {}; } catch (e) { return; }
  const lib = mySchoolLib(); let changed = false, mineNewer = false;
  for (const k of new Set([...Object.keys(lib), ...Object.keys(remote)])){
    const a = lib[k], b = remote[k];
    if (b && (!a || (b.updated || 0) > (a.updated || 0))){ lib[k] = b; changed = true; }
    else if (a && (!b || (a.updated || 0) > (b.updated || 0))) mineNewer = true;
  }
  if (changed) persist();
  if (mineNewer) syncMySchools(0);
}

/* ---------- is it a school we have, or one that looks like it? ---------- */
// Words that say nothing about which school it is ("Derby High School" is Derby).
const SCH_FILLER = new Set(['high', 'school', 'hs', 'sr', 'jr', 'senior', 'junior', 'the', 'of', 'usd', 'football']);
// Words many schools share, so "Central" alone doesn't make Andover Central a match.
const SCH_COMMON = new Set(['city', 'county', 'central', 'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest',
  'valley', 'hill', 'hills', 'mount', 'saint', 'lake', 'river', 'creek', 'heights', 'park', 'springs', 'center', 'christian', 'catholic',
  'academy', 'rural', 'unified', 'prairie', 'plains', 'new', 'and', 'trail', 'ridge']);
function schoolWords(n){
  return String(n || '').toLowerCase().replace(/\bh\.\s*s\.?/g, ' ').replace(/&/g, ' and ').replace(/\bst\.?(?=\s)/g, 'saint ').replace(/\bmt\.?(?=\s)/g, 'mount ')
    .replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w && !SCH_FILLER.has(w));
}
function editDistance(a, b){
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev = Array.from({length:b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++){
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// How much a typed name looks like a school's name: 0 not at all, 1 the same school written another way.
function schoolLikeness(typed, name){
  const a = schoolWords(typed), b = schoolWords(name); if (!a.length || !b.length) return 0;
  const x = a.join(''), y = b.join('');
  if (x === y) return 1;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  // "Classen" and "Northwest Classen": every word of one is in the other, and a word that means something
  if (short.every(w => long.includes(w)) && short.some(w => !SCH_COMMON.has(w) && w.length > 2)) return short === a ? .85 : .72;
  // "Ark City" for "Arkansas City", "SM East" for "Shawnee Mission East": the same words, cut short or down to initials
  if (a.length > 1 && a.length < b.length + 1){
    let i = 0;
    const fits = a.every(w => {
      if (b[i] && (b[i] === w || (w.length >= 2 && b[i].startsWith(w)))){ i++; return true; }
      if (w.length >= 2 && i + w.length <= b.length && b.slice(i, i + w.length).map(v => v[0]).join('') === w){ i += w.length; return true; }
      return false;
    });
    if (fits && i === b.length) return .8;
  }
  // "BVW" for "Blue Valley West", or the short name the list uses
  if (a.length === 1 && a[0].length >= 2 && ((b.length >= 2 && a[0] === b.map(w => w[0]).join('')) || a[0] === logoSlug(listAbbr(name)).replace(/-/g, ''))) return .75;
  // a typo: "Andover Centrl", "El Dorada"
  if (x.length >= 4){
    const d = editDistance(x, y), ratio = 1 - d / Math.max(x.length, y.length);
    if (d === 1 || (d === 2 && x.length >= 7) || ratio >= .82) return Math.max(.7, Math.min(.95, ratio));
  }
  return 0;
}
// The school's name as the list writes it, when what was typed is a school we have (aliases count: "BVNW").
function knownSchool(v){
  const k = canonSchool(v); if (!k) return null;
  const hit = schoolList().find(n => canonSchool(n) === k);
  if (hit) return hit;
  const lib = (logoLib.list || []).find(t => logoSlug(t.name) === k);
  if (lib) return lib.name;
  return schoolsDoc.hidden.find(n => canonSchool(n) === k) || null;
}
function similarSchools(v, max = 3){
  const best = new Map(), hide = schoolsHidden();
  const entries = [...schoolList().map(n => [n, n]),
    ...(LOGO_SRC[0].list || []).filter(t => !hide.has(logoSlug(t.name))).flatMap(t => (t.aliases || []).map(a => [a, t.name]))];
  for (const [label, name] of entries){
    const s = schoolLikeness(v, label);
    if (s >= .7 && s > (best.get(name) || 0)) best.set(name, s);
  }
  return [...best].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(e => e[0]);
}

/* ---------- "Did you mean …?" ---------- */
let askDone = null;
function askDialog(){
  let d = $('#askdlg');
  if (!d){
    d = document.createElement('dialog'); d.id = 'askdlg'; d.className = 'ask'; document.body.appendChild(d);
    d.addEventListener('close', () => finishAsk(null));
    d.addEventListener('click', e => { if (e.target === d) finishAsk(null); });
  }
  return d;
}
const schoolMark = (n, size) => markFor({name:n, abbr:listAbbr(n) || shortName(n), color:'#4A4B4D'}, size);
// Resolves with the school picked (Yes), false (No, it's a different school) or null (closed without answering).
function askSimilar(typed, names){
  return new Promise(res => {
    const d = askDialog(), one = names.length === 1;
    d.innerHTML = `<div class="dlg-hd"><h2>Did you mean${one ? ` ${esc(names[0])}` : ' one of these'}?</h2></div>
      <div class="dlg-bd"><p class="ask-q">You typed <b>${esc(typed)}</b>. ${one ? 'That looks like a school already on the list.' : 'Those look like schools already on the list.'}</p>
        <div class="ask-opts">${names.map(n => `<button type="button" class="ask-opt" data-ask-yes="${esc(n)}">${schoolMark(n, 32)}<span>${esc(n)}</span><b>Yes</b></button>`).join('')}</div></div>
      <div class="dlg-ft"><button type="button" class="btn" data-ask-no>No, ${esc(typed)} is a different school</button></div>`;
    askDone = res;
    if (!d.hasAttribute('open')){
      if (typeof d.showModal === 'function'){ try { d.showModal(); } catch (e) { d.classList.add('fallback'); d.setAttribute('open', ''); } }
      else { d.classList.add('fallback'); d.setAttribute('open', ''); }
    }
    const first = d.querySelector('.ask-opt'); if (first) first.focus();
  });
}
function finishAsk(v){
  const f = askDone; askDone = null;
  const d = $('#askdlg');
  if (d && d.hasAttribute('open')){ if (typeof d.close === 'function' && !d.classList.contains('fallback')) d.close(); else d.removeAttribute('open'); d.classList.remove('fallback'); }
  if (f) f(v);
}
document.addEventListener('click', e => {
  const y = e.target.closest && e.target.closest('[data-ask-yes]'); if (y) return finishAsk(y.dataset.askYes);
  if (e.target.closest && e.target.closest('[data-ask-no]')) return finishAsk(false);
});

// Settle what's in a school box: the list's own spelling, a Yes to a look-alike, or a new school on this scorer's list.
// Resolves false only when they closed the question without answering.
function settleSchool(el){
  if (el._settling) return el._settling;
  el._settling = (async () => {
    const v = el.value.trim().replace(/\s+/g, ' '); if (!v) return true;
    const known = knownSchool(v);
    if (known){ if (known !== el.value) setSchoolValue(el, known); return true; }
    const like = similarSchools(v);
    if (like.length){
      const pick = await askSimilar(v, like);
      if (pick === null){ el.focus(); return false; }
      if (pick){ setSchoolValue(el, pick); return true; }
    }
    setSchoolValue(el, v); addMySchool(v); return true;
  })().finally(() => { el._settling = null; });
  return el._settling;
}
// Before a save: true when every school box already holds a school we know; otherwise settle them, then save again.
function schoolsSettled(ids, retry){
  const els = ids.map(id => $('#' + id)).filter(el => el && el.value.trim() && !knownSchool(el.value.trim()));
  if (!els.length) return true;
  (async () => { for (const el of els) if (!(await settleSchool(el))) return; retry(); })();
  return false;
}
function setSchoolValue(el, v){
  el.value = v; closeSchoolSug(el);
  el.dataset.quiet = '1'; el.dispatchEvent(new Event('input', {bubbles:true})); delete el.dataset.quiet;   // fills a saved team's colors and roster
}

/* ---------- the picker's suggestions ---------- */
function schoolMatches(q){
  const low = q.trim().toLowerCase(), names = schoolList();
  if (!low) return names.map(name => ({name, r:0, also:''}));
  const out = [];
  names.forEach(name => {
    const nl = name.toLowerCase();
    let r = nl.startsWith(low) ? 0 : nl.split(/[\s-]+/).some(w => w.startsWith(low)) ? 1 : nl.includes(low) ? 2 : -1, also = '';
    if (r < 0){
      const t = (LOGO_SRC[0].list || []).find(t => t.name === name);
      const a = t && (t.aliases || []).find(x => x.toLowerCase().includes(low));
      if (a){ r = 3; also = a; }
    }
    if (r < 0 && low.length >= 4 && schoolLikeness(q, name) >= .7) r = 4;
    if (r >= 0) out.push({name, r, also});
  });
  return out.sort((a, b) => a.r - b.r || a.name.localeCompare(b.name));
}
function showSchoolSug(el){
  const box = document.getElementById(el.id + '-sug'); if (!box) return;
  const q = el.value.trim(), mine = new Set(mySchoolNames().map(logoSlug));
  const list = schoolMatches(q).slice(0, 400);
  let html = list.map((m, i) => `<div class="sch-opt" role="option" id="${esc(el.id)}-o${i}" data-pick="${esc(m.name)}" aria-selected="false">${schoolMark(m.name, 24).replace('<img ', '<img loading="lazy" ')}
    <span class="sch-opt-nm">${esc(m.name)}</span>${m.also ? `<span class="sch-opt-note">${esc(m.also)}</span>` : mine.has(logoSlug(m.name)) ? '<span class="sch-opt-note">Added by you</span>' : ''}</div>`).join('');
  if (q && !knownSchool(q)) html += `<div class="sch-opt new" role="option" id="${esc(el.id)}-onew" data-pick-new="1" aria-selected="false"><span class="sch-plus" aria-hidden="true">+</span>
    <span class="sch-opt-nm">Add “${esc(q)}”</span><span class="sch-opt-note">New school</span></div>`;
  box.innerHTML = html; box.hidden = !html; box.scrollTop = 0;
  el.setAttribute('aria-expanded', String(!!html)); el.removeAttribute('aria-activedescendant');
}
function closeSchoolSug(el){
  const box = document.getElementById(el.id + '-sug'); if (box){ box.hidden = true; box.innerHTML = ''; }
  el.setAttribute('aria-expanded', 'false'); el.removeAttribute('aria-activedescendant');
}
function pickSchoolOption(el, opt){
  if (opt.dataset.pickNew){ closeSchoolSug(el); return settleSchool(el); }
  setSchoolValue(el, opt.dataset.pick);
}
const isSchoolBox = el => !!(el && el.classList && el.classList.contains('sch-in'));
document.addEventListener('focusin', e => { if (isSchoolBox(e.target)) showSchoolSug(e.target); });
document.addEventListener('input', e => { if (isSchoolBox(e.target) && !e.target.dataset.quiet) showSchoolSug(e.target); });
document.addEventListener('focusout', e => { if (isSchoolBox(e.target)) closeSchoolSug(e.target); });
// Leaving the box with a name we don't have asks about it right then.
document.addEventListener('change', e => { if (isSchoolBox(e.target) && !askDone) settleSchool(e.target); });
// A tap on a suggestion mustn't take the focus from the box first (that would close the list under the finger).
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('.sch-sug')) e.preventDefault(); });
document.addEventListener('click', e => {
  const opt = e.target.closest && e.target.closest('.sch-opt'); if (!opt) return;
  const el = document.getElementById(opt.parentNode.id.replace(/-sug$/, '')); if (el) pickSchoolOption(el, opt);
});
document.addEventListener('keydown', e => {
  const el = e.target; if (!isSchoolBox(el)) return;
  const box = document.getElementById(el.id + '-sug'), open = box && !box.hidden;
  const opts = open ? [...box.querySelectorAll('.sch-opt')] : [];
  const at = opts.findIndex(o => o.getAttribute('aria-selected') === 'true');
  const mark = i => { opts.forEach((o, j) => o.setAttribute('aria-selected', String(i === j))); if (opts[i]){ el.setAttribute('aria-activedescendant', opts[i].id); opts[i].scrollIntoView({block:'nearest'}); } };
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    e.preventDefault();
    if (!open){ showSchoolSug(el); return; }
    mark(e.key === 'ArrowDown' ? Math.min(opts.length - 1, at + 1) : Math.max(0, at - 1));
  } else if (e.key === 'Enter'){
    e.preventDefault();
    if (open && at >= 0) return pickSchoolOption(el, opts[at]);
    closeSchoolSug(el); settleSchool(el);
  } else if (e.key === 'Escape' && open){
    e.preventDefault(); e.stopPropagation(); closeSchoolSug(el);
  }
});
