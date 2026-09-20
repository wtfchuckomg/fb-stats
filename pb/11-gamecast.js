/* ================================================================
   Gamecast views: current drive and field, line score, play-by-play
   (scoring or all plays), box score, team stats, and the side rail
   (game leaders, team stat bars). Shared by the scorer and viewers.
   ================================================================ */
// Players go by name, number if none; a box score's players are keyed by their names.
const PT = (s, n) => n === 'team' ? 'Team' : rosterName(s, n) || (/^\d+$/.test(n) ? `#${n}` : playerName(n));
// The same name, linked to the player's own page for anyone watching (the scorer stays put).
const plName = (s, n) => ui.viewer ? plLink(PT(s, n), g.teams[s].name, esc(PT(s, n))) : esc(PT(s, n));
const whenTxt = (q, clk) => clk != null && q <= 4 ? `${mmss(clk)} - ${perShort(q)}` : q <= 4 ? `${ord(q)} Quarter` : perShort(q);
const openDrive = () => { const d = R.drives[R.drives.length - 1]; return d && d.open ? d : null; };
const plural2 = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const driveSum = d => `${plural2(d.plays, 'play')}, ${plural2(Math.round(d.last - d.start), 'yard')}`;
function lastPlay(){ for (let k = R.log.length - 1; k >= 0; k--) if (R.log[k].t !== 'set') return R.log[k]; return null; }

// A headline for a play, the way a gamecast names it: "19-yd Pass", "Touchdown", "Punt".
function playTitle(e){
  const p = g.plays[e.i] || {}, txt = e.text || '', tg = e.tags.map(t => t[1]);
  if (/TOUCHDOWN/.test(txt)) return 'Touchdown';
  if (/SAFETY/.test(txt)) return 'Safety';
  if (/^Two-point try/.test(txt)) return 'Two-Point Try';
  if (e.wiped || p.t === 'pen') return 'Penalty';
  if (tg.includes('INT')) return 'Interception';
  if (tg.includes('Fumble')) return 'Fumble';
  switch (p.t){
    case 'run': {
      if (p.r === 'team' && /kn|kneel|victory/i.test(p.q || '')) return 'Kneel Down';
      const y = +p.y || 0; return y > 0 ? `${y}-yd Run` : y < 0 ? `${-y}-yd Loss` : 'No Gain';
    }
    case 'pass': return p.res === 'c' ? `${+p.y || 0}-yd Pass` : p.res === 'i' ? 'Incomplete Pass' : p.res === 's' ? 'Sack' : 'Pass';
    case 'punt': return 'Punt';
    case 'ko': return 'Kickoff';
    case 'fg': return /BLOCKED/.test(txt) ? 'Blocked Field Goal' : /NO GOOD/.test(txt) ? 'Missed Field Goal' : 'Field Goal';
    case 'try': return p.kind === 'kick' ? 'Extra Point' : 'Two-Point Try';
    case 'to': return 'Timeout';
    case 'endq': return 'End of Period';
    case 'final': return 'Final';
    case 'note': return 'Note';
  }
  return 'Play';
}

/* ---------- Gamecast tab ---------- */
function cardDrive(){
  const st = R.st, d = openDrive();
  let title = 'Current Drive', sub = '';
  if (st.final) title = 'Final';
  else if (st.phase === 'kick') title = st.kickKind === 'free' ? 'Free Kick' : 'Kickoff';
  else if (st.phase === 'try') title = 'Try';
  else if (d && d.team === st.poss) sub = driveSum(d);
  const down = st.phase === 'kick' ? (st.kickKind === 'free' ? 'Free kick' : 'Kickoff') : st.phase === 'try' ? 'Try'
    : `${ord(st.down)} & ${st.ltg >= R.FL ? 'Goal' : fy(st.ltg - st.spot)}`;
  const ball = R.yl(st.poss, st.phase === 'kick' ? st.kickFrom : st.spot);
  const lp = lastPlay();
  return `<section class="card">
    <div class="card-hd">${st.final ? '' : teamMark(st.poss, 34)}<div><h2 class="card-title">${title}</h2>${sub ? `<div class="card-sub">${esc(sub)}</div>` : ''}</div></div>
    ${st.final ? `<div class="cd-split"><div><div class="cd-lbl">${esc(g.teams.A.name)}</div><div class="cd-val">${st.score.A}</div></div><i></i><div><div class="cd-lbl">${esc(g.teams.H.name)}</div><div class="cd-val">${st.score.H}</div></div></div>`
      : `<div class="cd-split"><div><div class="cd-lbl">Down:</div><div class="cd-val">${esc(down)}</div></div><i></i><div><div class="cd-lbl">Ball on:</div><div class="cd-val">${esc(ball)}</div></div></div>`}
    <div class="fieldbox" id="field"></div>
    ${lp ? `<div class="inner lp"><div class="lp-hd"><div class="lp-title">${esc(playTitle(lp))}</div><span class="pill">Last Play</span></div>
      <div class="lp-txt">${lp.wiped ? `<s>${esc(lp.wiped)}</s> ` : ''}${esc(lp.text)}</div>
      <div class="lp-sit">${esc(lp.sit)}${lp.clk != null && lp.q <= 4 ? ` · ${whenTxt(lp.q, lp.clk)}` : ''}</div></div>` : ''}
  </section>`;
}
// One quarter's cell in a line score: blank while the game hasn't reached it, and an X in a finished game for a
// quarter that was never played (8-man ends at 45 points from the half on; weather and forfeits do the same).
// The columns a line score shows: four quarters, then one for each overtime the game went to — OT, 2OT, 3OT…
// Everywhere that draws a line score asks this, so the card, the strip, the scoreboard and the exports agree.
function lineCols(st){
  const A = st.lines.A || [], H = st.lines.H || [];
  // The last overtime the game actually reached: whoever scored in it, or the clock having got there. A scoreless
  // overtime still gets its column — leaving it out would shift 4OT's points under 3OT.
  let last = 3;
  for (let i = 4; i < Math.max(A.length, H.length); i++) if (A[i] || H[i]) last = i;   // 0 alone isn't an overtime
  if (st.q > 4) last = Math.max(last, st.q - 1);                                       // the clock reached it
  return Array.from({length:last + 1}, (_, i) => i);
}
const colLabel = i => i < 4 ? String(i + 1) : i === 4 ? 'OT' : `${i - 3}OT`;
function qCell(st, s, i){
  const v = st.lines[s][i];
  if (v == null) return 'X';                                        // the scorer left this quarter blank
  if (st.typed) return v;                                           // typed by hand: show it, reached or not
  if (i < 4 && st.final && i >= (st.qPlayed || 0)) return 'X';
  return i === 4 || st.q > i || st.final ? v : '';
}
function cardLinescore(){
  const st = R.st, T = g.teams, cols = lineCols(st);
  return `<section class="card"><div class="tbl-wrap"><table class="ls">
    <thead><tr><th></th>${cols.map(i => `<th>${colLabel(i)}</th>`).join('')}<th>T</th></tr></thead>
    <tbody>${['A', 'H'].map(s => `<tr><td><span class="tm">${teamMark(s, 22)}${esc(T[s].name)}</span></td>${cols.map(i => `<td>${qCell(st, s, i)}</td>`).join('')}<td class="tot">${st.score[s]}</td></tr>`).join('')}</tbody>
  </table></div></section>`;
}
function scoringList(){
  if (!R.scoring.length) return '<div class="empty">No scores yet.</div>';
  let h = '', q = null;
  for (const e of R.scoring){
    if (e.q !== q){ h += `<div class="qhd">${qName(e.q)}</div>`; q = e.q; }
    const d = R.drives.find(x => x.i1 === e.i && x.team === e.side);
    h += `<div class="inner scard">${teamMark(e.side, 46)}
      <div><div class="sc-title">${({TD:'Touchdown', FG:'Field Goal', Safety:'Safety'})[e.how] || esc(e.how)}</div><div class="sc-time">${whenTxt(e.q, e.clk)}</div></div>
      <div class="sc-score"><b>${e.A}</b><b>${e.H}</b><span>${esc(ab('A'))}</span><span>${esc(ab('H'))}</span></div>
      <div class="sc-desc">${esc(e.desc)}</div>${d ? `<div class="sc-drive">${driveSum(d)}</div>` : ''}</div>`;
  }
  return h;
}
function driveHead(d){
  return `<div class="drivehd">${teamMark(d.team, 22)}<b>${esc(ab(d.team))}</b><span class="res">${esc(d.open ? 'Current drive' : d.res)}</span><span>${driveSum(d)} · ${perLabel(d.q)}</span></div>`;
}
// Every play, grouped by quarter with a header where each drive begins. Newest first unless `oldFirst`.
let pbpSortPick = null; try { pbpSortPick = localStorage.getItem('pressbox.pbpSort'); } catch (e) {}
const pbpOldFirst = () => (pbpSortPick || (ui.viewer ? 'old' : 'new')) === 'old';
function playsList(oldFirst = false){
  if (!R.log.length) return '<div class="empty">No plays yet. Record the opening kickoff to start the log.</div>';
  const driveOf = [];
  R.drives.forEach(d => {
    if (d.i0 == null) return;
    const end = d.open || d.i1 == null ? R.log.length - 1 : d.i1;
    for (let i = d.i0; i <= end; i++) driveOf[i] = d;
  });
  let h = '', lastQ = null, lastD = null;
  const n = R.log.length;
  for (let j = 0; j < n; j++){
    const k = oldFirst ? j : n - 1 - j;
    const e = R.log[k], open = ui.open === e.i, d = driveOf[e.i] || null;
    if (e.q !== lastQ){ h += `<div class="qhd">${qName(e.q)}</div>`; lastQ = e.q; lastD = null; }
    if (d && d !== lastD) h += driveHead(d);
    lastD = d;
    // Viewers get outcomes only: no typed shorthand, no bookkeeping tags.
    const tags = ui.viewer ? e.tags.filter(([, t]) => t !== 'Spot') : e.tags;
    h += `<button type="button" class="pl ${open ? 'open' : ''}" data-row="${e.i}">
      <div><div class="pl-clk">${e.clk != null ? mmss(e.clk) : '—'}</div><span class="pl-no">Play ${e.i + 1}</span></div>
      <div><div class="pl-sit">${esc(e.sit)}${e.src && !ui.viewer ? ` <code class="qsrc">${esc(e.src)}</code>` : ''}</div>
      <div class="pl-txt">${e.wiped ? `<s>${esc(e.wiped)}</s> ` : ''}${esc(e.text)}${tags.length ? `<span class="tags">${tagHtml(tags)}</span>` : ''}</div></div></button>`;
    if (open){
      const editable = !['endq', 'final', 'to'].includes(e.t);
      h += `<div class="pl-act">${editable ? `<button class="btn small" data-edit="${e.i}">Edit</button>` : ''}
        <button class="btn small" data-ins="${e.i}">Add a play before</button>
        <button class="btn small danger" data-del="${e.i}">${ui.confirm === e.i ? 'Tap again to delete' : 'Delete'}</button>
        <button class="linkbtn" data-row="${e.i}">Close</button></div>`;
    }
  }
  return `<div class="plays">${h}</div>`;
}
function cardPbp(){
  const mode = ui.pbp || (ui.viewer ? 'scoring' : 'all');
  return `<section class="card"><div class="card-hd"><h2 class="card-title">Play-by-Play</h2></div>
    <div class="segctl" role="group" aria-label="Which plays"><button type="button" data-pbp="scoring" aria-pressed="${mode === 'scoring'}">Scoring Plays</button><button type="button" data-pbp="all" aria-pressed="${mode === 'all'}">All Plays</button><button type="button" data-pbp="drives" aria-pressed="${mode === 'drives'}">Drives</button></div>
    ${mode === 'scoring' ? scoringList() : mode === 'drives' ? driveChart() : playsList()}
    <div class="card-ft"><button class="linkbtn2" data-tab="pbp">Full Play-by-Play</button></div></section>`;
}

/* ---------- Box Score tab: each stat group, both teams side by side ---------- */
const BOX_CATS = [
  ['Passing', ['C/Att', 'Yds', 'TD', 'Int', 'Lng', 'Sack'], p => p.pa || p.psk, p => [`${p.pc}/${p.pa}`, p.py, p.ptd, p.pint, p.plg, p.psk], 'py'],
  ['Rushing', ['Car', 'Yds', 'Avg', 'TD', 'Lng'], p => p.ru, p => [p.ru, p.ry, avg(p.ry, p.ru), p.rtd, p.rlg], 'ry'],
  ['Receiving', ['Rec', 'Yds', 'Avg', 'TD', 'Lng'], p => p.re, p => [p.re, p.rey, avg(p.rey, p.re), p.retd, p.relg], 'rey'],
  ['Defense', ['Tot', 'Solo', 'Ast', 'TFL', 'Sack', 'Int', 'PBU', 'FF', 'FR'], p => p.tk || p.ast || p.sk || p.dint || p.pbu || p.ff || p.fr || p.bk,
    p => [p.tk + p.ast, p.tk, p.ast, fy(p.tfl), fy(p.sk), p.dint, p.pbu, p.ff, p.fr], p => p.tk + p.ast],
  ['Kicking', ['FG', 'Lng', 'XP', 'KO', 'TB', 'Pts'], p => p.fga || p.xpa || p.ko, p => [`${p.fgm}/${p.fga}`, p.fglg || '—', `${p.xpm}/${p.xpa}`, p.ko, p.ktb, p.fgm * 3 + p.xpm], 'fga'],
  ['Punting', ['No', 'Yds', 'Avg', 'Lng', 'In 20', 'TB'], p => p.pu, p => [p.pu, p.puy, avg(p.puy, p.pu), p.pulg, p.pi20, p.ptb], 'pu'],
  ['Returns', ['KR', 'Yds', 'Lng', 'PR', 'Yds', 'Lng', 'TD'], p => p.kr || p.pr, p => [p.kr, p.kry, p.krlg, p.pr, p.pry, p.prlg, p.krtd + p.prtd], 'kry']];
function viewBoxTab(){
  const T = g.teams;
  // The sort column is a key, or a sum of them — the defense goes in order of total tackles.
  const val = (p, key) => typeof key === 'function' ? key(p) || 0 : p[key] || 0;
  const pick = (s, keep, key) => Object.values(R.S.pl[s]).filter(keep).sort((a, b) => (a.n === 'team') - (b.n === 'team') || val(b, key) - val(a, key));
  let h = '';
  for (const [title, heads, keep, row, key] of BOX_CATS){
    const lists = {A:pick('A', keep, key), H:pick('H', keep, key)};
    if (!lists.A.length && !lists.H.length) continue;
    const table = s => `<div><div class="bx-team">${teamMark(s, 22)}${ui.viewer ? `<a class="tlink" href="?team=${encodeURIComponent(T[s].name)}">${esc(T[s].name)}</a>` : esc(T[s].name)}</div>${lists[s].length
      ? `<div class="tbl-wrap"><table class="st"><thead><tr><th>${title}</th>${heads.map(x => `<th>${x}</th>`).join('')}</tr></thead>
        <tbody>${lists[s].map(p => `<tr><td>${plName(s, p.n)}</td>${row(p).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : `<div class="muted" style="font-size:13px;padding:6px 0">No ${title.toLowerCase()} stats</div>`}</div>`;
    h += `<section class="card"><div class="card-hd"><h2 class="card-title">${title}</h2></div><div class="bx2">${table('A')}${table('H')}</div></section>`;
  }
  return h || '<section class="card"><div class="empty">No player stats yet.</div></section>';
}

/* ---------- Team Stats: bars in team colors ---------- */
function cmpRows(full){
  const S = R.S.team, frac = (m, a) => a ? m / a : 0, conv = (m, a) => `${m}-${a}`;
  const rows = [
    ['Total Yards', s => S[s].rushY + S[s].passY],
    ['1st Downs', s => S[s].fd],
    ['Passing Yards', s => S[s].passY],
    ['Rushing Yards', s => S[s].rushY],
    ['Turnovers', s => S[s].fumL + S[s].passInt],
    ['Penalties', s => S[s].pen, s => `${S[s].pen}-${fy(S[s].penY)}`],
    ['3rd Down', s => frac(S[s].d3m, S[s].d3a), s => conv(S[s].d3m, S[s].d3a)],
    ['4th Down', s => frac(S[s].d4m, S[s].d4a), s => conv(S[s].d4m, S[s].d4a)]];
  if (S.A.top || S.H.top) rows.push(['Possession', s => S[s].top, s => mmss(S[s].top)]);
  // A box score carries whatever the paper printed: show the rows it filled in, and nothing it left out.
  const any = r => ['A', 'H'].some(s => { const v = r[1](s); return typeof v === 'number' ? v > 0 : !!v; });
  const keep = R.box ? rows.filter(any)
    : full ? rows : rows.filter(r => ['Total Yards', '1st Downs', 'Turnovers', 'Penalties', '3rd Down', 'Possession'].includes(r[0]));
  const T = g.teams;
  return keep.map(([label, v, show]) => {
    const a = Math.max(0, v('A')), h = Math.max(0, v('H')), tot = a + h, wa = tot ? a / tot * 100 : 50;
    return `<div class="cmp"><div class="cmp-top"><b>${show ? show('A') : v('A')}</b><span>${label}</span><b>${show ? show('H') : v('H')}</b></div>
      <div class="cmp-bar"><i style="width:${wa}%;background:${tot ? esc(T.A.color) : 'var(--line)'}"></i><i style="width:${100 - wa}%;background:${tot ? esc(T.H.color) : 'var(--line)'}"></i></div></div>`;
  }).join('');
}
function cardCmp(full){
  return `<section class="card"><div class="card-hd"><h2 class="card-title">Team Stats</h2></div>
    <div class="cmp-teams"><span>${teamMark('A', 26)}${esc(ab('A'))}</span><span>${esc(ab('H'))}${teamMark('H', 26)}</span></div>
    ${cmpRows(full)}${full ? '' : '<div class="card-ft"><button class="linkbtn2" data-tab="team">Full Team Stats</button></div>'}</section>`;
}
function cardTeamTable(){
  return `<section class="card"><div class="card-hd"><h2 class="card-title">Stat Details</h2></div><div class="tbl-wrap"><table class="st">
    <thead><tr><th></th><th>${esc(ab('A'))}</th><th>${esc(ab('H'))}</th></tr></thead>
    <tbody>${teamRows().map(([l, f]) => `<tr><td>${l}</td><td>${f('A')}</td><td>${f('H')}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function cardDrives(){
  if (!R.drives.length) return '';
  // Quarter only: the clock at the start and the drive's length aren't wanted here.
  return `<section class="card"><div class="card-hd"><h2 class="card-title">Drives</h2></div><div class="tbl-wrap"><table class="st">
    <thead><tr><th>Team</th><th>Qtr</th><th>Start</th><th>Plays</th><th>Yds</th><th>Result</th></tr></thead>
    <tbody>${R.drives.map(d => `<tr><td>${esc(ab(d.team))}</td><td>${perLabel(d.q)}</td><td>${esc(R.yl(d.team, d.start))}</td>
      <td>${d.plays}</td><td>${Math.round(d.last - d.start)}</td><td>${esc(d.res)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

/* ---------- Drive chart (Play-by-Play): every drive in order, how it began and ended, and what it used ---------- */
// The clock a scorer types sticks until it's changed, so a time counts only on the play where it was set.
// A drive's start is the last clock set from the previous drive's last play through this drive's first;
// its end is the first clock set from its last play through the next drive's first. Otherwise, a dash.
function driveChart(){
  const D = R.drives, L = R.log, P = g.plays, qSec = (g.set.qtr || 12) * 60;
  if (!D.length) return '<div class="empty">No drives yet.</div>';
  const set = i => typeof P[i].clk === 'number' && (!i || L[i - 1].q !== L[i].q || P[i].clk !== P[i - 1].clk);
  const clockIn = (a, b, q, last) => {
    let hit = null;
    for (let i = Math.max(0, a); i <= Math.min(b, L.length - 1); i++) if (L[i].q === q && set(i)){ hit = P[i].clk; if (!last) break; }
    return hit;
  };
  // How the ball was obtained: a kickoff between the two drives, or how the other team's drive ended.
  const how = (d, prev) => {
    if (d.q > 4) return 'OT';
    if (!prev) return 'Kickoff';
    for (let i = prev.i1 + 1; i < d.i0; i++) if (P[i] && P[i].t === 'ko') return P[i].res === 'onside' ? 'Onside' : 'Kickoff';
    // After a score or the half the ball comes by a kick, even when the scorer only typed where the drive began.
    if (['TD', 'FG', 'Half'].includes(prev.res)) return 'Kickoff';
    if (prev.res === 'Safety') return 'Free kick';
    return ['Punt', 'Downs', 'INT', 'Fumble', 'Missed FG', 'Blocked FG'].includes(prev.res) ? prev.res : '—';
  };
  const badge = r => ['TD', 'FG'].includes(r) ? 'score' : ['INT', 'Fumble', 'Downs', 'Safety'].includes(r) ? 'to' : '';
  let rows = '', dash = false, endAt = null;
  const tm = v => { if (v == null){ dash = true; return '—'; } return mmss(v); };
  D.forEach((d, k) => {
    const prev = D[k - 1], next = D[k + 1];
    if (prev && d.q > 2 && d.q <= 4 && prev.q <= 2) rows += '<tr class="dc-half"><td colspan="12">2nd Half</td></tr>';
    if (d.q > 4 && (!prev || prev.q <= 4)) rows += '<tr class="dc-half"><td colspan="12">Overtime</td></tr>';
    // The clock can't run back up within a quarter, so a start later than the last drive's end takes that end,
    // and an end later than its own start is a mistyped clock, left out.
    let t0 = d.q <= 4 ? clockIn(prev ? prev.i1 : 0, d.i0, d.q, true) : null;
    if (t0 != null && endAt && endAt.q === d.q && t0 > endAt.t) t0 = endAt.t;
    let t1 = d.open || d.endQ > 4 ? null : clockIn(d.i1, next ? next.i0 : L.length - 1, d.endQ, false);
    // A clock that hit 0:00 stays there, so a drive whose last play is at 0:00 ends at 0:00 even if the zero was typed earlier.
    if (t1 == null && !d.open && d.endQ <= 4 && d.i1 != null && P[d.i1] && P[d.i1].clk === 0 && L[d.i1].q === d.endQ) t1 = 0;
    if (t1 != null && t0 != null && d.endQ === d.q && t1 > t0) t1 = null;
    endAt = t1 != null ? {q:d.endQ, t:t1} : null;
    const top = t0 != null && t1 != null ? Math.max(0, (d.endQ - d.q) * qSec + t0 - t1) : null;
    // A drive left open in a game that's already over says nothing: a dash, not "In progress".
    const res = d.open ? (R.st.final ? '—' : 'In progress') : d.res, b = badge(res), ot = d.q > 4;
    rows += `<tr><td><span class="dc-tm">${teamMark(d.team, 22)}${esc(ab(d.team))}</span></td>
      <td class="sep">${esc(R.yl(d.team, d.start))}</td><td>${perShort(d.q)}</td><td>${ot ? '' : tm(t0)}</td><td>${esc(how(d, prev))}</td>
      <td class="sep">${esc(R.yl(d.team, d.last))}</td><td>${d.open ? '' : perShort(d.endQ)}</td><td>${d.open || ot ? '' : tm(t1)}</td>
      <td class="sep dc-res">${b ? `<span class="tag ${b}">${esc(res)}</span>` : esc(res)}</td><td class="num">${d.plays}</td><td class="num">${Math.round(d.last - d.start)}</td>
      <td class="num">${d.open || ot ? '' : top != null ? mmss(top) : '—'}</td></tr>`;
  });
  return `<div class="tbl-wrap"><table class="st dc">
    <thead><tr><th></th><th class="dc-grp sep" colspan="4">Drive Started</th><th class="dc-grp sep" colspan="3">Drive Ended</th><th class="dc-grp sep" colspan="4">Consumed</th></tr>
      <tr><th>Team</th><th class="sep">Spot</th><th>Qtr</th><th>Time</th><th>Obtained</th><th class="sep">Spot</th><th>Qtr</th><th>Time</th>
      <th class="sep">Result</th><th class="num">Plays</th><th class="num">Yds</th><th class="num">TOP</th></tr></thead>
    <tbody>${rows}</tbody></table></div>${dash ? '<p class="hint dc-note">A dash means the clock wasn’t entered at that point in the game.</p>' : ''}`;
}
const cardDriveChart = () => R.drives.length ? `<section class="card"><div class="card-hd"><h2 class="card-title">Drive Chart</h2></div>${driveChart()}</section>` : '';

/* ---------- side rail ---------- */
function cardLeaders(){
  const cats = [
    ['Passing Yards', p => p.pa, p => p.py, p => `${p.pc}/${p.pa}, ${p.py} YDS${p.ptd ? `, ${p.ptd} TD` : ''}${p.pint ? `, ${p.pint} INT` : ''}`],
    ['Rushing Yards', p => p.ru, p => p.ry, p => `${p.ru} CAR, ${p.ry} YDS${p.rtd ? `, ${p.rtd} TD` : ''}`],
    ['Receiving Yards', p => p.re, p => p.rey, p => `${p.re} REC, ${p.rey} YDS${p.retd ? `, ${p.retd} TD` : ''}`],
    ['Tackles', p => p.tk + p.ast, p => p.tk + p.ast, p => `${p.tk + p.ast} TKL${p.sk ? `, ${fy(p.sk)} SK` : ''}${p.dint ? `, ${p.dint} INT` : ''}`]];
  const cell = (s, has, val, line) => {
    const best = Object.values(R.S.pl[s]).filter(p => p.n !== 'team' && has(p) > 0).sort((a, b) => val(b) - val(a))[0];
    if (!best) return `<div class="ldr ldr-empty"><div class="ldr-mark">${teamMark(s, 28)}</div><div class="ldr-name muted">—</div></div>`;
    return `<div class="ldr"><div class="ldr-mark">${teamMark(s, 28)}</div><div class="ldr-name">${plName(s, best.n)}</div>
      <div class="ldr-big">${fy(val(best))}</div><div class="ldr-line">${esc(line(best))}</div></div>`;
  };
  // Tackles only when the game has some recorded; a box score never does.
  const shown = cats.filter(([t]) => t !== 'Tackles' || ['A', 'H'].some(s => Object.values(R.S.pl[s]).some(p => p.tk + p.ast > 0)));
  return `<section class="card"><div class="card-hd"><h2 class="card-title">Game Leaders</h2></div>
    ${shown.map(([t, has, val, line]) => `<div class="ldr-cat">${t}</div><div class="ldr-row">${cell('A', has, val, line)}${cell('H', has, val, line)}</div>`).join('')}</section>`;
}
// Game Leaders, Team Stats, then Win Probability for a game with plays (27-winprob.js).
function renderRail(){
  const el = $('#rail'); if (!el || !g || !R) return;
  el.innerHTML = cardLeaders() + cardCmp(false) + (wpShow(g) ? cardWinProb() : '');
  wpBind();
}

function renderView(){
  document.querySelectorAll('#tabs .gtab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  if (!g || !R) return;
  const pbpCard = () => { const old = pbpOldFirst();
    return `<section class="card"><div class="card-hd"><h2 class="card-title">Play-by-Play</h2>
      <div class="segctl" role="group" aria-label="Order"><button type="button" data-pbsort="old" aria-pressed="${old}">First to last</button><button type="button" data-pbsort="new" aria-pressed="${!old}">Most recent</button></div></div>${playsList(old)}</section>`; };
  // A game entered from a box score has no plays: Gamecast and Play-by-Play show its scoring summary.
  const scoringCard = () => `<section class="card"><div class="card-hd"><h2 class="card-title">Scoring Summary</h2></div>${scoringList()}</section>`;
  const V = g.box
    ? (ui.printing ? () => cardLinescore() + scoringCard() + viewBoxTab() + cardCmp(true)
      : ({gamecast:() => cardLinescore() + scoringCard() + viewBoxTab(), box:viewBoxTab, pbp:scoringCard, team:() => cardLinescore() + cardCmp(true)})[ui.tab] || (() => ''))
    : ui.printing ? () => cardLinescore() + viewBoxTab() + cardCmp(true) + cardTeamTable() + pbpCard()
    : ({gamecast:() => cardDrive() + cardLinescore() + cardPbp(), box:viewBoxTab, pbp:() => pbpCard() + cardDriveChart(),
        team:() => cardLinescore() + cardCmp(true) + cardTeamTable() + cardDrives()})[ui.tab] || (() => '');
  $('#view').innerHTML = V();
  renderField();
}
