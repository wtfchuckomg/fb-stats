/* ================================================================
   Massey Ratings lines, for the pregame page's Game line card. Massey's
   site won't let another site read it, so once a week the admin saves
   masseyratings.com/hsf/ks/games from the browser (File > Save Page As)
   and opens that file here. Each game in it is matched to the game on
   this site with the same schools that week, and the lines go up in one
   public document everyone reads. For fun: nothing here is a bet.
   ================================================================ */
const MASSEY_DOC = 'massey-lines';
const massey = {lines:null, updated:0, api:null, file:null};

// One game from the saved page. Massey lists the visitor first and the home team as "@ Home" ("vs" at a neutral site).
function parseMassey(html){
  const docm = new DOMParser().parseFromString(html, 'text/html');
  const title = (docm.querySelector('#title0') || {}).textContent || '';
  const year = +((title.match(/(20\d\d)/) || [])[1]) || new Date().getFullYear();
  const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  const two = td => { if (!td) return ['', '']; const inner = td.querySelector('div'); const b = txt(inner); return [txt(td).slice(0, txt(td).length - b.length).trim(), b]; };
  const out = [];
  docm.querySelectorAll('tr.bodyrow').forEach(tr => {
    const td = [...tr.children];
    const dateA = td[0] && td[0].querySelector('a'), m = dateA && txt(dateA).match(/(\d\d)\.(\d\d)/);
    const teamA = td[1] && td[1].querySelectorAll('a');
    if (!m || !teamA || teamA.length < 2) return;
    const away = txt(teamA[0]), homeRaw = txt(teamA[1]), neutral = /^vs\b/i.test(homeRaw), home = homeRaw.replace(/^(@|vs\.?)\s*/i, '');
    const [rankA, rankH] = two(td[2]).map(s => { const r = s.match(/#\s*(\d+)/), rec = s.match(/\(([\d-]+)\)/); return {rank:r ? +r[1] : null, rec:rec ? rec[1] : ''}; });
    const [scA, scH] = two(td[3]).map(Number), [pA, pH] = two(td[4]).map(Number), [wA, wH] = two(td[5]).map(s => parseFloat(s));
    // The spread cell has a line for each team; the favorite's is the one that isn't hidden.
    const sp = td[6] ? [...td[6].querySelectorAll('div')] : [], spread = sp.map(d => d.classList.contains('visHidden') ? null : parseFloat(txt(d)));
    const total = td[7] ? parseFloat(txt(td[7])) : NaN;
    const status = tr.classList.contains('rcFinal') ? 'final' : tr.classList.contains('rcInProgress') ? 'live' : 'scheduled';
    out.push({date:`${year}-${m[1]}-${m[2]}`, time:txt(td[0].querySelector('.detail')).replace(/\./g, ' ').replace(/\s*LT$/, '').trim(),
      away, home, neutral, status, rank:{away:rankA, home:rankH}, pred:{away:pA, home:pH}, pwin:{away:wA, home:wH}, score:{away:scA, home:scH},
      fav:spread[0] != null && !Number.isNaN(spread[0]) ? 'away' : spread[1] != null && !Number.isNaN(spread[1]) ? 'home' : null,
      spread:Math.abs(spread.find(v => v != null && !Number.isNaN(v)) || 0), total:Number.isNaN(total) ? null : total});
  });
  return out;
}

// Match Massey's games to this site's. Massey shortens names ("Shawnee Mis W", "Andover Cent", "Salina-South"),
// so a game matches on its week and both schools together, the closest pair winning. Massey's home and away are
// often the wrong way round; this site's schedule is the one that's right, and the lines follow the teams, not the sides.
const masseyKey = (wk, a, b) => `${wk}|${[a, b].map(canonSchool).sort().join('|')}`;
function matchMassey(rows){
  const games = new Map();
  [...(allGames.list || []), ...Object.values(scores.docs || {})].forEach(x => {
    if (!x || !x.teams || !x.teams.A || !x.teams.H) return;
    const k = masseyKey(gameWeek(x), x.teams.A.name, x.teams.H.name);
    if (!games.has(k) || (x.kind === 'score' && games.get(k).kind !== 'score')) games.set(k, x);
  });
  const like = (m, ours) => canonSchool(m) === canonSchool(ours) ? 1 : schoolLikeness(m, ours);
  const byWeek = {};
  games.forEach(x => (byWeek[gameWeek(x)] = byWeek[gameWeek(x)] || []).push(x));
  return rows.map(r => {
    const wk = weekKey(fromYmd(r.date).getTime());
    let best = null;
    (byWeek[wk] || []).forEach(x => {
      const A = x.teams.A.name, H = x.teams.H.name;
      [[like(r.away, A), like(r.home, H), false], [like(r.away, H), like(r.home, A), true]].forEach(([a, h, flipped]) => {
        if (a < .7 || h < .7) return;
        const s = a + h + (flipped ? 0 : .01) + (ymd(gameDay(x)) === r.date ? .02 : 0);
        if (!best || s > best.s) best = {s, x, flipped};
      });
    });
    return best ? {...r, game:best.x, flipped:best.flipped && !r.neutral} : {...r, game:null};
  });
}

/* ---------- storing and reading ---------- */
function watchMassey(api){
  if (massey.api || !api) return;
  massey.api = api;
  const {fsM, fsdb} = api;
  // Until the admin saves the first week there's no document, and reading one that isn't there is refused.
  fsM.onSnapshot(fsM.doc(fsdb, 'pressbox', MASSEY_DOC), snap => {
    const d = snap.exists() ? snap.data() : null;
    let j = null; if (d && d.owner === ADMIN_UID && !d.deleted){ try { j = JSON.parse(d.json); } catch (e) {} }
    massey.lines = (j && j.lines) || {}; massey.updated = (j && j.updated) || 0;
    renderPreview();
  }, () => { massey.lines = massey.lines || {}; });
}
// The line for a game on this site, told from each school's side: {spread, fav, total, pred, pwin, rank} by name.
function masseyLine(x){
  if (!massey.lines || !x || !x.teams) return null;
  return massey.lines[masseyKey(gameWeek(x), x.teams.A.name, x.teams.H.name)] || null;
}
async function saveMassey(){
  const api = sync.api; if (!ui.admin || !api || !massey.file) return toast('Sign in as the admin first');
  const lines = {...(massey.lines || {})}, cutoff = Date.now() - 21 * 864e5;
  Object.keys(lines).forEach(k => { if ((lines[k].at || 0) < cutoff) delete lines[k]; });   // three weeks is plenty
  let n = 0;
  massey.file.rows.forEach(r => {
    if (!r.game) return;
    const T = r.game.teams, side = s => r.flipped ? (s === 'A' ? 'home' : 'away') : (s === 'A' ? 'away' : 'home');
    const per = s => ({name:T[s].name, rank:r.rank[side(s)].rank, rec:r.rank[side(s)].rec, pred:r.pred[side(s)], pwin:r.pwin[side(s)], fav:r.fav === side(s)});
    lines[masseyKey(gameWeek(r.game), T.A.name, T.H.name)] = {at:Date.now(), date:r.date, spread:r.spread, total:r.total, status:r.status,
      flipped:r.flipped, massey:`${r.away} ${r.neutral ? 'vs' : 'at'} ${r.home}`, A:per('A'), H:per('H')};
    n++;
  });
  const {fsM, fsdb} = api;
  try {
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', MASSEY_DOC), {owner:ADMIN_UID, updated:Date.now(), public:true, kind:'massey', title:'Massey Ratings lines',
      json:JSON.stringify({updated:Date.now(), lines})});
    massey.lines = lines; massey.updated = Date.now();
    closeDialog(); toast(`Massey lines saved for ${n} game${n === 1 ? '' : 's'}`);
  } catch (e) { toast('Couldn’t save the lines. Sign in on the Game Tracker, then try again.'); }
}

/* ---------- the admin's window ---------- */
function dlgMassey(){
  const f = massey.file;
  const intro = `<p class="hint">Once a week: open <b>masseyratings.com/hsf/ks/games</b>, save the page (File &gt; Save Page As, “Webpage, Complete” or “HTML only”), then choose that file here. Each game is matched to this site’s game with the same two schools that week.</p>
    <div class="fld"><label class="btn small primary" style="align-self:flex-start">Choose the saved Massey page<input type="file" id="massey-file" accept=".html,.htm,text/html" hidden></label></div>`;
  if (!f) return `${dlgHead('Massey lines')}<div class="dlg-bd">${intro}${massey.updated ? `<p class="hint">Last saved ${esc(new Date(massey.updated).toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}))}.</p>` : ''}</div>
    <div class="dlg-ft"><button type="button" class="btn" data-close>Close</button></div>`;
  const ours = f.rows.filter(r => r.game), missing = f.rows.filter(r => !r.game);
  const row = r => { const T = r.game.teams, fav = r.fav ? T[(r.fav === 'away') !== r.flipped ? 'A' : 'H'].name : '';
    return `<tr><td>${esc(T.A.name)} at ${esc(T.H.name)}</td><td class="num">${fav ? `${esc(fav)} −${r.spread}` : 'Even'}</td><td class="num">${r.total ?? '—'}</td></tr>`; };
  return `${dlgHead('Massey lines')}<div class="dlg-bd">
      <p class="hint"><b>${esc(f.name)}</b>: ${f.rows.length} games. <b>${ours.length}</b> match games on this site${missing.length ? `; ${missing.length} aren’t on the site, and are left out` : ''}.</p>
      <div class="grp"><h3>Matched (${ours.length})</h3><div class="tbl-wrap mas-tbl"><table class="ctbl"><thead><tr><th>Game</th><th class="num">Line</th><th class="num">Total</th></tr></thead><tbody>${ours.map(row).join('')}</tbody></table></div></div>
      ${missing.length ? `<details class="grp"><summary>Not on this site (${missing.length})</summary><ul class="mas-list">${missing.map(r => `<li>${esc(r.away)} ${r.neutral ? 'vs' : 'at'} ${esc(r.home)} · ${esc(r.date.slice(5).replace('-', '/'))}</li>`).join('')}</ul></details>` : ''}
    </div>
    <div class="dlg-ft"><button type="button" class="btn" data-massey-again>Choose another file</button><button type="button" class="btn primary" data-massey-save ${ours.length ? '' : 'disabled'}>Save ${ours.length} lines</button></div>`;
}
document.addEventListener('change', e => {
  if (e.target.id !== 'massey-file' || !e.target.files[0]) return;
  const file = e.target.files[0];
  file.text().then(html => {
    const rows = parseMassey(html);
    if (!rows.length) return toast('No games in that file. Save masseyratings.com/hsf/ks/games and choose it again.');
    massey.file = {name:file.name, rows:matchMassey(rows)};
    dlg().innerHTML = dlgMassey();
  });
});
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('button'); if (!b) return;
  if ('masseySave' in b.dataset) return saveMassey();
  if ('masseyAgain' in b.dataset){ massey.file = null; dlg().innerHTML = dlgMassey(); }
});
