/* ================================================================
   Views, dialogs, storage, events.
   ================================================================ */
const qName = q => q <= 4 ? `${ord(q)} Quarter` : `Overtime ${q - 4}`;
const avg = (y, n) => n ? (y / n).toFixed(1) : '0.0';
function tagHtml(tags){
  const seen = new Set();
  return tags.filter(([c, t]) => !seen.has(c + t) && seen.add(c + t)).map(([c, t]) => `<span class="tag ${c}">${esc(t)}</span>`).join('');
}

function teamRows(){
  const S = R.S.team;
  const rows = [
    ['First downs', s => S[s].fd],
    ['Rush · pass · penalty', s => `${S[s].fdR} · ${S[s].fdP} · ${S[s].fdX}`],
    ['Total offense', s => S[s].rushY + S[s].passY],
    ['Plays · yards per play', s => { const n = S[s].rushN + S[s].passA; return `${n} · ${avg(S[s].rushY + S[s].passY, n)}`; }],
    ['Rushes–yards', s => `${S[s].rushN}–${S[s].rushY}`],
    ['Passing yards', s => S[s].passY],
    ['Comp–att–int', s => `${S[s].passC}–${S[s].passA}–${S[s].passInt}`],
    ['Sacked–yards lost', s => `${S[s].sk}–${S[s].skY}`],
    ['Punts–average', s => `${S[s].pnt}–${avg(S[s].pntY, S[s].pnt - S[s].pntBlk)}`],
    ['Punt returns–yards', s => `${S[s].prN}–${S[s].prY}`],
    ['Kick returns–yards', s => `${S[s].krN}–${S[s].krY}`],
    ['Interceptions–return yards', s => `${S[s].intN}–${S[s].intY}`],
    ['Fumbles–lost', s => `${S[s].fum}–${S[s].fumL}`],
    ['Penalties–yards', s => `${S[s].pen}–${fy(S[s].penY)}`],
    ['3rd-down conversions', s => `${S[s].d3m} of ${S[s].d3a}`],
    ['4th-down conversions', s => `${S[s].d4m} of ${S[s].d4a}`]];
  if (S.A.top || S.H.top) rows.push(['Time of possession', s => mmss(S[s].top)]);
  return rows;
}
/* ---------- text export ---------- */
function summaryText(){
  const st = R.st, T = g.teams, lp = (s, n) => String(s).padStart(n), rp = (s, n) => String(s).padEnd(n);
  let out = `${T.A.name} at ${T.H.name}${rulesOf(g).men === 8 ? ' (8-man)' : ''}\n${st.final ? 'FINAL' : perLabel(st.q) + (st.q <= 4 ? ' ' + mmss(clockNow()) : '')}\n\n`;
  const cols = lineCols(st);
  out += rp('', 8) + cols.map(i => lp(colLabel(i), 4)).join('') + lp('T', 5) + '\n';
  ['A', 'H'].forEach(s => out += rp(T[s].abbr, 8) + cols.map(i => lp(qCell(st, s, i), 4)).join('') + lp(st.score[s], 5) + '\n');
  out += '\nSCORING\n' + (R.scoring.map(e => `${perLabel(e.q)} ${e.clk != null ? mmss(e.clk) : ''}  ${ab(e.side)} – ${e.desc}  (${T.A.abbr} ${e.A}, ${T.H.abbr} ${e.H})`).join('\n') || 'None') + '\n';
  out += '\n' + rp('TEAM STATS', 28) + lp(T.A.abbr, 10) + lp(T.H.abbr, 10) + '\n';
  teamRows().forEach(([l, f]) => out += rp(l, 28) + lp(f('A'), 10) + lp(f('H'), 10) + '\n');
  ['A', 'H'].forEach(s => {
    const P = Object.values(R.S.pl[s]), nmx = p => p.n === 'team' ? 'TEAM' : rosterName(s, p.n) || '#' + p.n;
    const line = (label, arr) => arr.length ? `${label}: ${arr.join('; ')}\n` : '';
    out += `\n${T[s].name.toUpperCase()}\n`;
    out += line('Passing', P.filter(p => p.pa).sort((a, b) => b.py - a.py).map(p => `${nmx(p)} ${p.pc}-${p.pa}-${p.pint}, ${p.py} yds${p.ptd ? `, ${p.ptd} TD` : ''}`));
    out += line('Rushing', P.filter(p => p.ru).sort((a, b) => b.ry - a.ry).map(p => `${nmx(p)} ${p.ru}-${p.ry}${p.rtd ? `, ${p.rtd} TD` : ''}`));
    out += line('Receiving', P.filter(p => p.re).sort((a, b) => b.rey - a.rey).map(p => `${nmx(p)} ${p.re}-${p.rey}${p.retd ? `, ${p.retd} TD` : ''}`));
    out += line('Tackles', P.filter(p => p.tk + p.ast).sort((a, b) => (b.tk + b.ast) - (a.tk + a.ast)).map(p => `${nmx(p)} ${p.tk + p.ast}`));
    out += line('Interceptions', P.filter(p => p.dint).map(p => `${nmx(p)} ${p.dint}`));
  });
  out += '\nPLAY-BY-PLAY\n'; let q = null;
  R.log.forEach(e => {
    if (e.q !== q){ out += `\n${qName(e.q).toUpperCase()}\n`; q = e.q; }
    out += `${e.clk != null ? lp(mmss(e.clk), 5) : '     '}  ${e.sit} — ${e.wiped ? `[${e.wiped}] ` : ''}${e.text}\n`;
  });
  return out;
}

/* ---------- dialogs ---------- */
const dlg = () => $('#dlg');
// Embedded viewers (an iframe) block file downloads, so only offer one on a top-level page.
const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const dlgHead = t => `<div class="dlg-hd"><h2>${t}</h2><button class="x" type="button" data-close aria-label="Close">×</button></div>`;
function openDialog(kind){
  ui.dlg = kind; ui.confirm = null;
  dlg().innerHTML = kind === 'games' ? dlgGames() : kind === 'export' ? dlgExport() : kind === 'share' ? dlgShare() : kind === 'team' ? dlgTeam(ui.teamKey) : kind === 'score' ? dlgScore(ui.qsId) : kind === 'box' ? dlgBox() : kind === 'others' ? dlgOthers() : kind === 'lines' ? dlgLines() : kind === 'teams' ? dlgTeams() : kind === 'schools' ? dlgSchools() : dlgSetup(kind === 'new');
  if (!dlg().hasAttribute('open')) showDialog();
  if ($('#s-A-roster')){ ['A', 'H'].forEach(fillSetupRoster); fillSetupFormat(); }
}
// Phones without the pop-up window feature (iPhones before iOS 15.4, among others) get the same box, opened plainly.
function showDialog(){
  const d = dlg();
  if (typeof d.showModal === 'function'){ try { d.showModal(); return; } catch (e) { /* fall through */ } }
  d.classList.add('fallback'); d.setAttribute('open', '');
}
function closeDialog(){
  const d = dlg();
  if (d.hasAttribute('open')){ if (typeof d.close === 'function' && !d.classList.contains('fallback')) d.close(); else d.removeAttribute('open'); }
  d.classList.remove('fallback'); ui.dlg = null; ui.fromSched = null; ui.boxFrom = ui.boxGame = null;
}

// The spots come with the format; Setup only shows them, it doesn't ask.
const ruleHint = men => men === 8
  ? '8-man: 80-yard field, midfield at the 40. Kickoff from the 30, touchback at the 15, safety kick from the 15, overtime from the 10.'
  : '11-man: 100-yard field. Kickoff from the 40, touchback at the 20, safety kick from the 20, overtime from the 10.';
function dlgSetup(isNew){
  // A new game starts 11-man, which nearly every school is; the schools typed in set it from there.
  const src = isNew ? {teams:{A:{name:'', mascot:'', abbr:'', color:'#1F4E9C', roster:{}}, H:{name:'', mascot:'', abbr:'', color:'#B0151B', roster:{}}}, set:{qtr:12, firstKick:'H', men:11}} : g;
  // Started from a scheduled game or quick score: its schools (with anything saved about them) and date.
  const from = isNew && ui.fromSched ? qsLib()[ui.fromSched] : null;
  if (from && from.teams) ['A', 'H'].forEach(s => { const t = findTeam(from.teams[s].name) || {};
    src.teams[s] = {name:from.teams[s].name, mascot:t.mascot || '', abbr:t.abbr || from.teams[s].abbr, color:t.color || from.teams[s].color, roster:t.roster || {},
      rec:from.teams[s].rec || '', hrec:from.teams[s].hrec || ''}; });
  const ru = rulesOf(src);
  const rosterTxt = s => rosterToText(src.teams[s].roster);
  const teamRow = (s, label) => `<div class="grp"><h3>${label}</h3><div class="teamset">
      <div class="fld"><label class="eyebrow" for="s-${s}-name">School</label>${schoolPicker(`s-${s}-name`, src.teams[s].name, s === 'A' ? 'Visiting school' : 'Home school')}</div>
      <div class="fld"><label class="eyebrow" for="s-${s}-mascot">Mascot</label><input class="inp" id="s-${s}-mascot" value="${esc(src.teams[s].mascot || '')}" placeholder="e.g. Bulldogs"></div>
      <div class="fld"><label class="eyebrow" for="s-${s}-abbr">Short</label><input class="inp" id="s-${s}-abbr" maxlength="5" value="${esc(src.teams[s].abbr)}" placeholder="${s === 'A' ? 'VIS' : 'HOME'}"></div>
      <div class="fld"><label class="eyebrow" for="s-${s}-key">Letter</label><input class="inp" id="s-${s}-key" maxlength="1" autocapitalize="characters" value="${esc(src.teams[s].key || '')}" placeholder="${esc((String(src.teams[s].abbr || (s === 'A' ? 'V' : 'H'))[0] || '').toUpperCase())}" title="The letter you type for this team in shorthand"></div>
      <div class="fld"><label class="eyebrow" for="s-${s}-color">Color</label><input type="color" id="s-${s}-color" value="${esc(src.teams[s].color)}"></div></div>
      <div class="fld"><label class="eyebrow" for="s-${s}-roster">Roster, optional · one player per line, number then name · home/road numbers: 7/82</label>
      <textarea class="inp" id="s-${s}-roster" rows="4" placeholder="7 Cole Brandt&#10;22 Mason Ortiz">${esc(rosterTxt(s))}</textarea><div class="hint" id="s-${s}-lib"></div>
      <div class="hint" id="s-${s}-shared">${sharedHint(s, src.teams[s].name)}</div></div></div>`;
  return `${dlgHead(isNew ? 'New game' : 'Game setup')}<div class="dlg-bd">${teamRow('A', 'Visitors')}${teamRow('H', 'Home')}
    <div class="grp"><h3>Rules</h3>
      <div class="fld"><span class="eyebrow">Game</span><div class="seg" id="s-men"${isNew ? '' : ' data-picked="1"'}>${[[11, '11-man · 100 yards'], [8, '8-man · 80 yards']].map(([m, l]) => `<button type="button" data-men="${m}" aria-pressed="${ru.men === m}">${l}</button>`).join('')}</div></div>
      <div class="row">
      <div class="fld"><span class="eyebrow">Opening kickoff by</span><div class="seg" id="s-kick">${['A', 'H'].map(s => `<button type="button" data-kick="${s}" aria-pressed="${src.set.firstKick === s}">${s === 'A' ? 'Visitors' : 'Home'}</button>`).join('')}</div></div>
      <div class="fld"><label class="eyebrow" for="s-qtr">Quarter, minutes</label><input class="inp" id="s-qtr" inputmode="numeric" value="${src.set.qtr}"></div></div>
      <div class="fld"><label class="eyebrow" for="s-date">Game date · sets its week on the scoreboard</label><input class="inp" type="date" id="s-date" value="${from && from.date ? from.date : isNew ? ymd(new Date()) : ymd(gameDay(g))}"></div>
      <p class="hint" id="s-rulehint">${ruleHint(ru.men)}</p>
      ${isNew ? `<label style="display:flex;align-items:center;gap:8px;margin-top:10px;font:500 14px/1.3 var(--sans)"><input type="checkbox" id="s-private"> Keep this game private: off the scoreboard, with no live link</label>` : ''}</div></div>
    <div class="dlg-ft"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" data-save-setup="${isNew ? 1 : 0}">${isNew ? 'Start game' : 'Save'}</button></div>`;
}
function saveSetup(isNew){
  const v = id => $('#' + id).value.trim();
  const parseRoster = parseRosterText;
  if (!v('s-A-name') || !v('s-H-name')) return toast('Type both schools');
  // A school not on the list is checked against the ones that are ("Did you mean …?") before the game starts.
  if (!schoolsSettled(['s-A-name', 's-H-name'], () => saveSetup(isNew))) return;
  const team = (s, def) => {
    const name = v(`s-${s}-name`) || def;
    return {name, mascot:v(`s-${s}-mascot`), abbr:(v(`s-${s}-abbr`) || name.replace(/[^A-Za-z]/g, '').slice(0, 4)).toUpperCase(),
      key:(v(`s-${s}-key`).match(/[A-Za-z]/) || [''])[0].toUpperCase(), color:$(`#s-${s}-color`).value, roster:parseRoster($(`#s-${s}-roster`).value),
      rec:recValue('s', s, 'rec', src.teams[s].rec), hrec:recValue('s', s, 'hrec', src.teams[s].hrec)};
  };
  const kick = $('#s-kick [aria-pressed="true"]');
  // Only the format is saved; its kickoff, touchback, safety and overtime spots come from FORMATS.
  const menBtn = $('#s-men [aria-pressed="true"]'), men = menBtn ? +menBtn.dataset.men : 11;
  const set = {qtr:clamp(parseInt(v('s-qtr')) || 12, 1, 20), men, firstKick:kick ? kick.dataset.kick : 'H'};
  if (!isNew && g.set.toss && tossKicker(g.set.toss) === set.firstKick) set.toss = g.set.toss;   // changed by hand: the toss no longer says
  const teams = {A:team('A', 'Visitors'), H:team('H', 'Home')};
  const keptA = rememberTeam(teams.A), keptH = rememberTeam(teams.H);
  shareRoster(teams.A); shareRoster(teams.H);   // up for everyone to use, when signed in
  if (keptA || keptH) syncTeams();
  const date = /^\d{4}-\d\d-\d\d$/.test(v('s-date')) ? v('s-date') : ymd(new Date());
  // New games go live by default: on the scoreboard, with a link fans can follow (its card opens once plays come in).
  // The scorer keeps one to themselves with "Keep this game private", or Live → Make private later.
  const keepPrivate = !!($('#s-private') && $('#s-private').checked);
  if (isNew){ g = {id:'g' + Date.now().toString(36), created:Date.now(), date, teams, set, plays:[], clk:{s:set.qtr * 60, run:false, at:0}, share:!keepPrivate}; resetUi(); }
  else { if (!g.plays.length && set.qtr !== g.set.qtr) g.clk = {s:set.qtr * 60, run:false, at:0}; Object.assign(g, {teams, set, date}); }
  save(); closeDialog(); refresh(); toast(isNew ? 'Game started' : 'Setup saved');
}

// The quarter-by-quarter summary, typed by hand: for a game the play-by-play doesn't tell the whole story of —
// one stopped by the 45-point rule, or picked up partway through.
function dlgLines(){
  const st = R.st, T = g.teams, cell = (s, i) => { const v = st.lines[s][i]; return v == null ? '' : v; };
  const row = (s, label) => `<div class="ls-row"><div class="ls-team">${teamMark(s, 22)}<b>${esc(T[s].abbr || T[s].name)}</b><span>${esc(label)}</span></div>
    ${[0, 1, 2, 3, 4].map(i => `<div class="fld"><label class="eyebrow" for="ls-${s}-${i}">${i < 4 ? i + 1 : 'OT'}</label>
      <input class="inp" id="ls-${s}-${i}" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${cell(s, i)}" placeholder="—"></div>`).join('')}</div>`;
  return `${dlgHead('Line score')}<div class="dlg-bd">
    <p class="hint">What you type here becomes the line score and the final score, in place of what the plays add up to.
      <b>Leave a quarter blank if it was never played</b> — an 8-man game stopped by the 45-point rule, say — and it shows an X.</p>
    <div class="ls-edit">${row('A', 'Visitors')}${row('H', 'Home')}</div></div>
    <div class="dlg-ft">${g.lines ? '<button type="button" class="btn danger" data-lines-clear style="margin-right:auto">Use the plays instead</button>' : ''}
      <button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" data-lines-save>Save</button></div>`;
}
function saveLines(){
  const read = (s, i) => { const el = $(`#ls-${s}-${i}`), v = el ? el.value.trim() : ''; return v === '' ? null : clamp(parseInt(v, 10) || 0, 0, 199); };
  const L = {A:[0, 1, 2, 3, 4].map(i => read('A', i)), H:[0, 1, 2, 3, 4].map(i => read('H', i))};
  if (![...L.A, ...L.H].some(v => v != null)) return toast('Type at least one quarter, or cancel');
  g.lines = L; save(); closeDialog(); refresh();
  toast(`Line score saved · ${ab('A')} ${R.st.score.A}, ${ab('H')} ${R.st.score.H}`);
}
function clearLines(){ delete g.lines; save(); closeDialog(); refresh(); toast('Back to the play-by-play'); }

function dlgGames(){
  // A record without teams (half-written, or part-way in from another device) is skipped rather than shown.
  const list = Object.values(db.games).filter(x => x && x.teams && x.teams.A && x.teams.H).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const items = list.map(x => { const r = replay(x);
    return `<div class="gitem"><div><b>${esc(x.teams.A.abbr)} ${r.st.score.A} at ${esc(x.teams.H.abbr)} ${r.st.score.H}</b>${x.id === g.id ? '<span class="cur-tag">Open</span>' : ''}${x.sample ? '<span class="cur-tag" style="color:var(--flag-ink)">Sample</span>' : ''}${x.foreign ? '<span class="cur-tag" style="color:var(--flag-ink)">Someone else’s</span>' : ''}
      <div class="meta">${esc(x.teams.A.name)} at ${esc(x.teams.H.name)} · ${rulesOf(x).men === 8 ? '8-man · ' : ''}${gameDay(x).toLocaleDateString()} · ${r.st.final ? 'Final' : perLabel(r.st.q)} · ${x.box ? 'box score' : `${x.plays.length} plays`}</div></div>
      <div class="acts">${x.id !== g.id ? `<button class="btn small" data-open-game="${x.id}">Open</button>` : ''}<button class="btn small danger" data-del-game="${x.id}">${ui.confirm === 'g:' + x.id ? 'Tap again' : 'Delete'}</button></div></div>`; }).join('');
  // The buttons sit at the top, under the title, so New game is there without scrolling past every saved game.
  return `${dlgHead('Games')}<div class="dlg-ft top"><button class="btn" data-open="export" style="margin-right:auto">Export</button><button class="btn" data-box-new>Paste a box score</button><button class="btn primary" data-open="new">New game</button></div>
    <div class="dlg-bd">${syncBlock()}${typeof turboBlock === 'function' ? turboBlock() : ''}<div class="grp"><h3>Games</h3><div class="glist">${items}</div></div>
    <p class="hint">Every game is saved in this browser${sync.user ? ' and to your Google account' : ''}. Export makes a backup you can keep anywhere.</p></div>`;
}
// The live look-in: a link anyone can open to watch this game, read-only.
function dlgShare(){
  // The game's own link. (Its preview page, gameLink(), only exists once the preview job has made it; the game page
  // switches its address to that when it does.)
  const link = `${location.origin}${location.pathname}?game=${encodeURIComponent(g.id)}`;
  let body;
  if (g.sample) body = '<p class="hint">The sample game can’t go live. Start a real game and it goes live on its own.</p>';
  else if (sync.state === 'unavailable') body = '<p class="hint">Live games work from your own site (stats.kansasmediarankings.com), where games sync to your Google account.</p>';
  else if (!sync.user) body = `<div class="acct"><div><b>Sign in to go live</b><p class="hint">A live game is read from your account, so sign in with Google first. Until then it stays on this device.</p></div>
    <button class="btn small primary" data-signin>Sign in with Google</button></div>`;
  else body = `<div class="acct"><div><b>${g.share ? 'Live on the scoreboard' : 'Private'}</b>
      <p class="hint">${g.share ? 'Fans can watch the score, play-by-play and stats update as you enter plays, from the scoreboard or this link. They can’t change anything.'
        : 'Only you can see this game. Go live to put it on the scoreboard, with a link fans can follow.'}</p></div>
      <button class="btn small ${g.share ? '' : 'primary'}" data-share="${g.share ? 'off' : 'on'}">${g.share ? 'Make private' : 'Go live'}</button></div>
    ${g.share ? `<div class="fld"><label class="eyebrow" for="x-link">Link to share</label><input class="inp" id="x-link" readonly value="${esc(link)}" style="font:500 15px/1.2 Barlow,sans-serif"></div>
      <div class="line"><button class="btn small" data-copy="x-link">Copy link</button><a class="btn small" href="${esc(link)}" target="_blank" rel="noopener">Open the viewer</a></div>
      <p class="hint">Viewers see any roster names you’ve entered. Making it private takes it off the scoreboard and stops the link right away.</p>` : ''}`;
  return `${dlgHead('Live or private')}<div class="dlg-bd">${body}</div>`;
}
function dlgExport(){
  return `${dlgHead('Export')}<div class="dlg-bd">
    <div class="grp"><h3>Excel workbook</h3><p class="hint">Line score, team stats, every player stat group, drives and the full play-by-play, one sheet each.</p>
      <div class="line">${framed ? '<span class="hint">Excel downloads work on your own site.</span>' : '<button class="btn small primary" data-xlsx>Download Excel file</button>'}</div></div>
    <div class="grp"><h3>Box score and play-by-play</h3><textarea class="inp num" id="x-txt" rows="8" readonly style="font:13px/1.35 ui-monospace,Menlo,Consolas,monospace">${esc(summaryText())}</textarea>
      <div class="line"><button class="btn small" data-copy="x-txt">Copy text</button><button class="btn small" data-print>Print</button></div></div>
    <div class="grp"><h3>Back up this game</h3><p class="hint">A backup restores the game on any device through Import below.</p>
      <div class="line">${framed ? '' : '<button class="btn small" data-download>Download backup</button>'}<button class="btn small" data-copy="x-json">Copy backup text</button></div>
      <textarea class="inp" id="x-json" rows="3" readonly hidden>${esc(JSON.stringify(g))}</textarea></div>
    <div class="grp"><h3>Import a game</h3><p class="hint">A Press Box backup, or a newspaper box score (line score, scoring plays, then RUSHING, PASSING, RECEIVING).</p>
      <textarea class="inp" id="x-imp" rows="3" placeholder="Paste a backup or a box score here"></textarea>
      <div class="line"><button class="btn small" data-import>Import pasted text</button><label class="btn small">Choose file<input type="file" id="x-file" accept=".json,application/json" hidden></label></div></div></div>`;
}
function copyFrom(id){
  const el = $('#' + id), text = el.value;
  const fallback = () => { el.hidden = false; el.focus(); el.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} toast(ok ? 'Copied' : 'Text selected — copy it from the box'); };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied'), fallback); else fallback();
}
function download(){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(g, null, 1)], {type:'application/json'}));
  a.download = `${g.teams.A.abbr}-at-${g.teams.H.abbr}-${new Date(g.created).toISOString().slice(0, 10)}.json`.toLowerCase();
  document.body.appendChild(a); a.click(); a.remove();
  toast('Backup saved');
}
function importText(txt){
  let x; try { x = JSON.parse(txt); } catch (e) {
    // Not a backup: a newspaper box score pasted here goes to the box-score window, ready to save.
    if (parseBox(txt).ok){ ui.boxFrom = ui.boxGame = null; openDialog('box'); $('#bx-txt').value = txt; $('#bx-prev').innerHTML = boxPreview(parseBox(txt)); return; }
    toast('That isn’t a backup or a box score. A box score needs its line score, like “Andover 7 7 8 10 — 32”.'); return;
  }
  if (!x || !x.teams || !Array.isArray(x.plays)){ toast('That backup is missing its teams or plays'); return; }
  x.id = 'g' + Date.now().toString(36); x.clk = x.clk || {s:(x.set?.qtr || 12) * 60, run:false, at:0}; x.set = x.set || {qtr:12, ot:10, firstKick:'H'};
  g = x; resetUi(); save(); closeDialog(); refresh(); toast('Game imported');
}
function printAll(){
  closeDialog(); ui.printing = true; renderView();
  try { window.print(); } finally { setTimeout(() => { ui.printing = false; renderView(); }, 300); }
}

/* ---------- storage ---------- */
// Everything downstream assumes a game has two teams, a list of plays and a clock. One record saved half-written —
// or arrived part-way from another device — used to take the whole page down on the way in, so they're dropped or
// patched up here, where games enter memory, instead of guarding every place that reads one.
function soundGame(x){
  if (!x || typeof x !== 'object' || !x.teams || !x.teams.A || !x.teams.H) return null;
  if (!Array.isArray(x.plays)) x.plays = [];
  if (!x.set || typeof x.set !== 'object') x.set = {qtr:12, men:11, firstKick:'H'};
  if (!x.clk || typeof x.clk !== 'object') x.clk = {s:(x.set.qtr || 12) * 60, run:false, at:0};
  return x;
}
function load(){
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!d || !d.games) return;
    const games = {}, dropped = [];
    Object.entries(d.games).forEach(([id, x]) => { const ok = soundGame(x); if (ok) games[id] = ok; else dropped.push(id); });
    d.games = games; db = d;
    if (dropped.length) persist();   // don't let a bad record come back on the next load
  } catch (e) {}
}
function persist(){ try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) {} }
// An edit: stamp the game, keep it here, and send it to the account when signed in.
function save(){ if (!g) return; g.updated = Date.now(); db.games[g.id] = g; db.cur = g.id; persist(); syncPush(g); }
// Opening a game isn't an edit, so it mustn't look newer than another device's copy.
function setCurrent(){ if (!g) return; db.games[g.id] = g; db.cur = g.id; persist(); }
function resetUi(){ Object.assign(ui, {type:null, draft:null, editing:null, ins:false, ctx:null, open:null, confirm:null, ask:null, qtext:'', qedit:false, start:false}); }
function refresh(){
  R = replay(g);
  // The game just went final (its last play, or End game): on to the start screen for the next one.
  if (!ui.viewer && R.st.final && ui.seen && ui.seen.id === g.id && !ui.seen.final) ui.start = true;
  ui.seen = {id:g.id, final:!!R.st.final};
  ui.ctx = ui.editing != null ? Object.assign(replay(g, ui.editing), {}) : R;
  $('#sample').hidden = !g.sample || !!ui.viewer;
  const sb = $('#sharebtn');
  if (sb){ sb.classList.toggle('live', !!g.share); sb.innerHTML = g.share ? '<i></i>Live' : 'Private'; }
  renderBoard(); renderPad(); renderView(); renderRail(); renderLive(); renderScores(); loadLogos(); renderStart(); renderForeign();
}
let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1700); }

/* ---------- actions ---------- */
function record(){
  const p = buildPlay(ui.draft);
  if (ui.editing != null && ui.ins){
    const c = parseClock(ui.draft.clkTxt || '');
    p.clk = c != null ? c : insClock(ui.editing);
    g.plays.splice(ui.editing, 0, p); ui.editing = null; ui.ins = false; ui.open = null; toast('Play added');
  } else if (ui.editing != null){
    const c = parseClock(ui.draft.clkTxt || ''); if (c != null) p.clk = c;
    g.plays[ui.editing] = p; ui.editing = null; ui.open = null; toast('Play updated');
  } else {
    if (R.st.q <= 4) p.clk = Math.ceil(clockNow());
    stopClockFor(p);
    g.plays.push(p); toast('Recorded');
  }
  if (!['run', 'pass'].includes(ui.type)) ui.type = null;
  ui.draft = null; save(); refresh();
}
function undo(){ if (!g.plays.length) return; g.plays.pop(); resetUi(); save(); refresh(); toast('Last play removed'); }
function endq(v, src){
  const q = R.st.q, p = {t:'endq', clk:0};
  if (src) p.q = src;
  if (q === 2) p.kick = v; if (q === 4) p.first = v;
  g.plays.push(p); ui.ask = null; ui.type = null; ui.draft = null;
  if (q < 4) g.clk = {s:g.set.qtr * 60, run:false, at:0}; else g.clk.run = false;
  save(); refresh(); toast(q === 4 ? 'End of regulation' : `End of the ${ord(q)} quarter`);
}
// A missed play, put in ahead of play i: typed against the situation before i, and everything after replays.
function startInsert(i){
  Object.assign(ui, {editing:i, ins:true, ctx:replay(g, i), type:null, draft:null, open:null, confirm:null, qedit:false, qtext:''});
  renderPad(); renderView(); $('#pad').scrollIntoView({behavior:'smooth', block:'start'});
  if (ui.mode === 'quick') focusQuick();
}
// With no time typed, a play put in later takes the clock of the play before it (the clock isn't known).
const insClock = i => { for (let k = i - 1; k >= 0; k--) if (g.plays[k].clk != null) return g.plays[k].clk; return undefined; };
function startEdit(i){
  const p = g.plays[i]; ui.editing = i; ui.ins = false; ui.ctx = replay(g, i); ui.type = p.t; ui.open = null;
  // A play typed in shorthand is edited by retyping its line; others use the form.
  ui.qedit = !!p.q; ui.qtext = p.q || ''; ui.draft = p.q ? null : toDraft(p, ui.ctx.st);
  renderPad(); renderView(); $('#pad').scrollIntoView({behavior:'smooth', block:'start'});
  if (p.q) focusQuick();
}
function editClock(){
  const b = $('#clk'), inp = document.createElement('input');
  inp.className = 'st-clock num'; inp.inputMode = 'numeric'; inp.value = mmss(clockNow()); inp.setAttribute('aria-label', 'Game clock, minutes:seconds');
  b.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = keep => { if (done) return; done = true; const s = keep ? parseClock(inp.value) : null; if (s != null) setClock(Math.min(s, g.set.qtr * 60), false); renderBoard(); };
  inp.addEventListener('blur', () => finish(true));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
}

// Press and hold a play to edit it straight away — the phone's long-press. A tap still opens the row with its
// Edit and Delete buttons. The click that follows a hold is swallowed, so the row doesn't open underneath the edit.
const hold = {t:0, x:0, y:0, row:null, fired:false};
document.addEventListener('pointerdown', e => {
  if (ui.viewer || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const row = e.target.closest && e.target.closest('.pl[data-row]'); if (!row) return;
  clearTimeout(hold.t); hold.fired = false; hold.row = row; hold.x = e.clientX; hold.y = e.clientY;
  hold.t = setTimeout(() => {
    hold.fired = true;
    const i = +row.dataset.row, p = g && g.plays[i];
    if (navigator.vibrate) navigator.vibrate(12);
    if (p && !['endq', 'final', 'to'].includes(p.t)) startEdit(i);
    else { ui.open = i; ui.confirm = null; renderView(); }       // nothing to edit on these: show Delete instead
  }, 480);
});
const holdOff = () => { clearTimeout(hold.t); hold.row = null; };
document.addEventListener('pointermove', e => { if (hold.row && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) holdOff(); });   // a scroll, not a hold
['pointerup', 'pointercancel'].forEach(k => document.addEventListener(k, holdOff));
document.addEventListener('contextmenu', e => { if (!ui.viewer && e.target.closest && e.target.closest('.pl[data-row]')) e.preventDefault(); });
document.addEventListener('click', e => {
  if (hold.fired){ hold.fired = false; if (e.target.closest && e.target.closest('.pl[data-row]')){ e.preventDefault(); e.stopPropagation(); return; } }
  if (e.target === dlg()){ closeDialog(); return; }
  const t = e.target.closest('button'); if (!t) return;
  const d = t.dataset;
  if (ui.viewer && !d.tab && !d.pbp && !d.pbsort) return;     // viewers can switch tabs and nothing else
  if ('xlsx' in d) return downloadXlsx();
  if (d.share){
    g.share = d.share === 'on'; save(); refresh(); toast(g.share ? 'Live on the scoreboard' : 'Private: off the scoreboard');
    dlg().innerHTML = dlgShare();
    return toast(g.share ? 'Live link on' : 'Live link off');
  }
  if (t.id === 'clk') return editClock();
  if (t.id === 'clkgo'){ setClock(clockNow(), !g.clk.run); return renderBoard(); }
  if (t.id === 'rec') return record();
  if (t.id === 'qrec') return recordQuick();
  if (d.qkey) return insertKey(d.qkey);
  if ('qmic' in d) return voiceToggle();
  if (d.mode){
    ui.mode = d.mode; ui.draft = null; voiceStop();
    try { localStorage.setItem('pressbox.mode', d.mode); } catch (e) {}
    renderPad(); if (d.mode === 'quick') focusQuick(); return;
  }
  if (d.open) return openDialog(d.open);
  if ('close' in d) return closeDialog();
  if (d.tab){ ui.tab = d.tab; renderView(); return address(true); }        // a tab is a page: it gets its own link
  if (d.pbp){ ui.pbp = d.pbp; renderView(); return address(false); }        // a filter on the page you're on
  if (d.pbsort){ pbpSortPick = d.pbsort; try { localStorage.setItem('pressbox.pbpSort', d.pbsort); } catch (e) {} return renderView(); }
  if (d.type){ ui.type = d.type; ui.draft = null; return renderPad(); }
  if (d.seg){ setK(ui.draft, d.seg, d.v); return renderPad(); }
  if (d.tog){ setK(ui.draft, d.tog, !getK(ui.draft, d.tog)); return renderPad(); }
  if (d.chip){ setK(ui.draft, d.chip, d.v); return renderPad(); }
  if ('td' in d){ ui.draft.y = String(Math.ceil(ui.ctx.FL - ui.ctx.st.spot)); ui.draft.yn = 'gain'; return renderPad(); }
  if (d.men){
    t.parentNode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === t)));
    t.parentNode.dataset.picked = '1';          // chosen by hand: the schools don't change it back
    $('#s-rulehint').textContent = ruleHint(+d.men); return;
  }
  if ('undo' in d) return undo();
  if ('cancelEdit' in d){ ui.editing = null; ui.ins = false; ui.draft = null; ui.type = null; ui.qedit = false; ui.qtext = ''; return refresh(); }
  if (d.timeout){
    g.plays.push({t:'to', side:d.timeout, ...(R.st.q <= 4 ? {clk:Math.ceil(clockNow())} : {})});
    g.clk = {s:clockNow(), run:false, at:Date.now()}; ui.type = null; ui.draft = null;
    save(); refresh(); return toast(`Timeout ${ab(d.timeout)}`);
  }
  if ('endqAsk' in d){
    const st = R.st;
    if (st.q === 2) ui.ask = 'half'; else if (st.q === 4 && st.score.A === st.score.H) ui.ask = 'ot'; else return endq();
    return renderPad();
  }
  if (d.endq) return endq(d.endq);
  if ('ask' in d){ ui.ask = d.ask || null; return renderPad(); }
  if ('final' in d){ g.plays.push({t:'final'}); g.clk.run = false; ui.ask = null; save(); refresh(); return toast('Game ended'); }
  if (d.row){ const i = +d.row; ui.open = ui.open === i ? null : i; ui.confirm = null; return renderView(); }
  if (d.edit) return startEdit(+d.edit);
  if (d.ins) return startInsert(+d.ins);
  if (d.del){
    const i = +d.del;
    if (ui.confirm !== i){ ui.confirm = i; return renderView(); }
    g.plays.splice(i, 1); resetUi(); save(); refresh(); return toast('Play deleted');
  }
  if (d.side){ ui.side = d.side; return renderView(); }
  if (d.kick){ t.parentNode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === t))); return; }
  if (d.tossWin || d.tossChoice){
    if (g.plays.length) return;
    const toss = Object.assign({}, g.set.toss, d.tossWin ? {win:d.tossWin} : {choice:d.tossChoice});
    g.set.toss = toss;
    const k = tossKicker(toss); if (k) g.set.firstKick = k;
    save(); refresh();
    return k ? toast(`${g.teams[k].name || ab(k)} kicks off`) : undefined;
  }
  if (d.saveSetup) return saveSetup(d.saveSetup === '1');
  if ('linesSave' in d) return saveLines();
  if ('linesClear' in d) return clearLines();
  if (d.openGame){ g = db.games[d.openGame]; resetUi(); setCurrent(); closeDialog(); return refresh(); }
  if ('sync' in d) return sync.state === 'signed-out' ? signIn() : openDialog('games');
  if ('signin' in d) return signIn();
  if ('signout' in d) return signOutSync();
  if (d.delGame){
    const id = d.delGame;
    if (ui.confirm !== 'g:' + id){ ui.confirm = 'g:' + id; dlg().innerHTML = dlgGames(); return; }
    // Their game is only a copy here: closing it leaves their own record alone.
    const theirs = !!(db.games[id] && db.games[id].foreign);
    delete db.games[id]; ui.confirm = null; if (!theirs) syncDelete(id);
    if (id === g.id){ g = Object.values(db.games)[0] || sampleGame(); resetUi(); ui.start = idleGame(g); }
    setCurrent(); refresh(); dlg().innerHTML = dlgGames(); return toast('Game deleted');
  }
  if (d.copy) return copyFrom(d.copy);
  if ('download' in d) return download();
  if ('import' in d) return importText($('#x-imp').value);
  if ('print' in d) return printAll();
});
document.addEventListener('input', e => {
  const el = e.target, k = el.dataset && el.dataset.k;
  if (el.id === 'qk'){ ui.qtext = el.value; return quickPreview(); }
  if (!k || !ui.draft) return;
  setK(ui.draft, k, el.value);
  if (k === 'pen.name'){
    const x = PENALTIES.find(p => p.name === el.value), st = ui.ctx.st;
    if (x){ Object.assign(ui.draft.pen, {y:x.y, a:x.a, l:x.l}); if (x.s === 'O') ui.draft.pen.side = st.poss; if (x.s === 'D') ui.draft.pen.side = other(st.poss); }
    return renderPad();
  }
  const who = document.querySelector(`[data-who="${k}"]`);
  if (who) who.textContent = rosterName(el.dataset.side, el.value.replace(/\D/g, ''));
  updatePreview();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'qk'){ e.preventDefault(); return recordQuick(); }
  if (e.key === 'Enter' && e.target.matches && e.target.matches('#pad input.inp')){ e.preventDefault(); record(); }
});
// Shorthand keys insert text without pulling focus (and the phone keyboard) away from the entry box.
document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.qkey')) e.preventDefault(); });
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('cheat')) ui.cheat = e.target.open; }, true);
document.addEventListener('change', e => { if (e.target.id === 'x-file' && e.target.files[0]) e.target.files[0].text().then(importText); });
dlg().addEventListener('close', () => { ui.dlg = null; });
setInterval(() => {
  if (!g || !g.clk || !g.clk.run) return;
  const s = clockNow(), el = $('#clk');
  if (s <= 0 && !ui.viewer){ setClock(0, false); return renderBoard(); }
  if (el && el.tagName === 'BUTTON') el.textContent = mmss(s);
}, 250);

