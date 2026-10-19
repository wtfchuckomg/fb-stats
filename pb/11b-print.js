/* ================================================================
   The printed box score (Chuck, 2026-10-19, Butler CC's "Print Version" PDF: "I want it to look like this").
   Monospace, black on white: the header, score by quarters, scoring summary, then Team Statistics,
   Individual Offense and Individual Defense, each starting a new page. Drawn into #printsheet, which is
   the only thing on the page while printing (pb/1-head.html, @media print).
   ================================================================ */
const psNum = x => x % 1 ? x.toFixed(1) : String(x);
const psPct = (m, a) => `${a ? Math.round(m / a * 100) : 0}% (${m} of ${a})`;

function psHeader(){
  const T = g.teams, d = gameDay(g);
  const date = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  return `<div class="ps-kicker">Football Box Score</div>
    <h1 class="ps-title">${esc(schoolName(T.A.name).toUpperCase())} VS. ${esc(schoolName(T.H.name).toUpperCase())}</h1>
    <div class="ps-sub">${date}</div><hr class="ps-thick">`;
}
function psLines(){
  const st = R.st, T = g.teams, cols = lineCols(st);
  return `<h2 class="ps-h">Score by Quarters</h2><table class="ps-t ps-ls">
    <thead><tr><th class="l">Team</th>${cols.map(i => `<th>${colLabel(i)}</th>`).join('')}<th>Final</th></tr></thead>
    <tbody>${['A', 'H'].map(s => `<tr><td class="l">${esc(schoolName(T[s].name))}</td>${cols.map(i => `<td>${qCell(st, s, i)}</td>`).join('')}<td><b>${st.score[s]}</b></td></tr>`).join('')}</tbody></table>`;
}
function psScoring(){
  if (!R.scoring.length) return '';
  let q = null;
  const rows = R.scoring.map(e => {
    const d = R.drives.find(x => x.i1 === e.i && x.team === e.side);
    // The drive's time only when the clock was really kept and both ends of it are in the same quarter.
    const used = d && clockUsed(g) && d.q === e.q && d.clk != null && e.clk != null && d.clk >= e.clk ? ` in ${mmss(d.clk - e.clk)}` : '';
    const drive = d ? `<div>Drive: ${plural2(d.plays, 'play')}, ${plural2(Math.round(d.last - d.start), 'yard')}${used}.</div>` : '';
    const qq = e.q !== q ? perShort(e.q) : ''; q = e.q;
    const clk = e.clk != null && e.q <= 4 && (g.box || clockUsed(g)) ? mmss(e.clk) : '';
    return `<tr><td class="l">${qq}</td><td class="l">${clk}</td><td class="l ps-play"><div><b>${esc(schoolName(g.teams[e.side].name))}</b> – ${esc(e.desc)}</div>${drive}</td><td class="ps-nw">${e.A} - ${e.H}</td></tr>`;
  }).join('');
  return `<h2 class="ps-h">Scoring Summary</h2><table class="ps-t ps-sc">
    <thead><tr><th class="l">Qtr</th><th class="l">Time</th><th class="l">Scoring Play</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// Team Statistics: headline rows bold, the lines under them in italics, as the PDF sets them.
function psTeam(){
  const S = R.S.team, P = s => Object.values(R.S.pl[s]), sum = (s, k) => P(s).reduce((t, p) => t + (p[k] || 0), 0);
  const o = s => s === 'A' ? 'H' : 'A';
  const rows = [
    ['FIRST DOWNS', 'b', s => S[s].fd],
    ['Rushing', 'i', s => S[s].fdR], ['Passing', 'i', s => S[s].fdP], ['Penalty', 'i', s => S[s].fdX],
    ['NET YARDS RUSHING', 'b', s => S[s].rushY],
    ['Attempts', 'i', s => S[s].rushN], ['Avg. Per Rush', 'i', s => avg(S[s].rushY, S[s].rushN)], ['Rushing TDs', 'i', s => sum(s, 'rtd')],
    ['NET YARDS PASSING', 'b', s => S[s].passY],
    ['Comp.-Att.-Int.', 'i', s => `${S[s].passC}-${S[s].passA}-${S[s].passInt}`], ['Avg. / Att.', 'i', s => avg(S[s].passY, S[s].passA)],
    ['Avg. / Comp.', 'i', s => avg(S[s].passY, S[s].passC)], ['TDs', 'i', s => S[s].passTD || sum(s, 'ptd')],
    ['TOTAL OFFENSE YARDS', 'b', s => S[s].rushY + S[s].passY],
    ['Plays', 'i', s => S[s].rushN + S[s].passA], ['Avg. / Play', 'i', s => avg(S[s].rushY + S[s].passY, S[s].rushN + S[s].passA)],
    ['Fumbles-Lost', 'i', s => `${S[s].fum}-${S[s].fumL}`],
    ['Penalties-Yards', 'i', s => `${S[s].pen}-${psNum(S[s].penY)}`],
    ['Punts-Yards', '', s => `${S[s].pnt}-${S[s].pntY}`], ['Avg. / Punt', 'i', s => avg(S[s].pntY, S[s].pnt - S[s].pntBlk)],
    ['Inside 20', 'i', s => sum(s, 'pi20')], ['Touchbacks', 'i', s => S[s].pntTB],
    ['Kickoffs-Yards', '', s => `${S[s].koN}-${S[s].koY}`], ['Avg. / Kickoff', 'i', s => avg(S[s].koY, S[s].koN)], ['Touchbacks', 'i', s => S[s].koTB],
    ['Punt Returns: No-Yds-TD', '', s => `${S[s].prN}-${S[s].prY}-${sum(s, 'prtd')}`], ['Avg. / Return', 'i', s => avg(S[s].prY, S[s].prN)],
    ['Kickoff Returns: No-Yds-TD', '', s => `${S[s].krN}-${S[s].krY}-${sum(s, 'krtd')}`], ['Avg. / Return', 'i', s => avg(S[s].krY, S[s].krN)],
    ['Int Returns: No-Yds', '', s => `${S[s].intN}-${S[s].intY}`],
    ['Sacks By: Number-Yards', '', s => `${psNum(S[o(s)].sk)}-${S[o(s)].skY}`],
    ['Field Goals', '', s => `${sum(s, 'fgm')}-${sum(s, 'fga')}`], ['PAT Kicks', '', s => `${sum(s, 'xpm')}-${sum(s, 'xpa')}`]];
  if (S.A.top || S.H.top) rows.push(['POSSESSION TIME', 'b', s => mmss(S[s].top)]);
  rows.push(['Third-Down Conversions', '', s => psPct(S[s].d3m, S[s].d3a)], ['Fourth-Down Conversions', '', s => psPct(S[s].d4m, S[s].d4a)]);
  // A pasted box score carries only what the paper printed: rows with nothing in them for either side go.
  // So do averages with no yards behind them (a scorer who kept kickoffs but not how far they went).
  const empty = v => !/[1-9]/.test(String(v));
  const keep = rows.filter(r => !((g.box || r[0].startsWith('Avg.')) && empty(r[2]('A')) && empty(r[2]('H'))));
  const T = g.teams;
  return `<section class="ps-page"><h2 class="ps-h">Team Statistics</h2><table class="ps-t ps-ts">
    <thead><tr><th>${esc(schoolName(T.A.name))}</th><th></th><th>${esc(schoolName(T.H.name))}</th></tr></thead>
    <tbody>${keep.map(([l, k, f]) => `<tr class="${k}"><td>${f('A')}</td><td class="lab">${l}</td><td>${f('H')}</td></tr>`).join('')}</tbody></table></section>`;
}

// One stat group: both teams side by side, a player per row with his number, and a Totals row where the PDF has one.
// A group neither team has anything in is left off; one side empty says "None." as the PDF does.
function psGroup(title, heads, keep, row, sort, total){
  if (!['A', 'H'].some(s => Object.values(R.S.pl[s]).some(keep))) return '';
  const T = g.teams, side = s => {
    const list = Object.values(R.S.pl[s]).filter(keep).sort((a, b) => (a.n === 'team') - (b.n === 'team') || sort(b) - sort(a));
    const head = `<tr><th class="no"></th><th class="l">Player</th>${heads.map(h => `<th>${h}</th>`).join('')}</tr>`;
    if (!list.length) return `<div><div class="ps-tm">${esc(schoolName(T[s].name))}</div><table class="ps-t ps-pl"><thead>${head}</thead><tbody><tr><td class="l" colspan="${heads.length + 2}">None.</td></tr></tbody></table></div>`;
    const no = p => /^\d+$/.test(p.n) ? p.n : '';
    const tot = total ? total(list) : null;
    return `<div><div class="ps-tm">${esc(schoolName(T[s].name))}</div><table class="ps-t ps-pl"><thead>${head}</thead>
      <tbody>${list.map(p => `<tr><td class="no">${no(p)}</td><td class="l">${esc(PT(s, p.n))}</td>${row(p).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>
      ${tot ? `<tfoot><tr><td class="l" colspan="2">Totals</td>${tot.map(v => `<td>${v}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
  };
  return `<div class="ps-grp"><div class="ps-gt">${title}</div><div class="ps-two">${side('A')}${side('H')}</div></div>`;
}
function psPlayers(){
  const add = (L, k) => L.reduce((t, p) => t + (p[k] || 0), 0);
  // A pasted box score has no longest gains: that column goes, as on the Box Score tab.
  const lg = !(g.box || g.statBox), L = (a, v) => lg ? a.concat(v) : a;
  const off = [
    psGroup('Passing', L(['Att', 'Cmp', 'Int', 'Yds', 'TD'], 'Lg'), p => p.pa, p => L([p.pa, p.pc, p.pint, p.py, p.ptd], p.plg), p => p.py,
      a => L([add(a, 'pa'), add(a, 'pc'), add(a, 'pint'), add(a, 'py'), add(a, 'ptd')], '')),
    psGroup('Rushing', L(['Att', 'Yds', 'Avg', 'TD'], 'Lg'), p => p.ru, p => L([p.ru, p.ry, avg(p.ry, p.ru), p.rtd], p.rlg), p => p.ry,
      a => L([add(a, 'ru'), add(a, 'ry'), avg(add(a, 'ry'), add(a, 'ru')), add(a, 'rtd')], '')),
    psGroup('Receiving', L(['No', 'Yds', 'Avg', 'TD'], 'Lg'), p => p.re, p => L([p.re, p.rey, avg(p.rey, p.re), p.retd], p.relg), p => p.rey,
      a => L([add(a, 're'), add(a, 'rey'), avg(add(a, 'rey'), add(a, 're')), add(a, 'retd')], '')),
    psGroup('Kicking', ['FGA', 'FGM', 'Lg', 'PAT-A', 'PAT-M'], p => p.fga || p.xpa, p => [p.fga, p.fgm, p.fglg || '', p.xpa, p.xpm], p => p.fga * 10 + p.xpa),
    psGroup('Punting', ['No', 'Yds', 'Avg', 'Lg', 'In20'], p => p.pu, p => [p.pu, p.puy, avg(p.puy, p.pu), p.pulg || '', p.pi20], p => p.pu),
    psGroup('Kick Returns', L(['No', 'Yds', 'TD'], 'Lg'), p => p.kr, p => L([p.kr, p.kry, p.krtd], p.krlg), p => p.kry),
    psGroup('Punt Returns', L(['No', 'Yds', 'TD'], 'Lg'), p => p.pr, p => L([p.pr, p.pry, p.prtd], p.prlg), p => p.pry)];
  const tackled = ['A', 'H'].some(s => Object.values(R.S.pl[s]).some(p => p.tk || p.ast || p.sk || p.dint || p.pbu));
  const def = [
    tackled ? psGroup('Tackles', ['Solo', 'Ast', 'Total', 'TFL', 'Sacks', 'PD'], p => p.tk || p.ast || p.sk || p.tfl || p.pbu,
      p => [p.tk, p.ast, p.tk + p.ast, p.tfl ? psNum(p.tfl) : '', p.sk ? psNum(p.sk) : '', p.pbu || ''], p => (p.tk + p.ast) * 100 + p.tk) : '',
    psGroup('Interceptions', ['No', 'Yds'], p => p.dint, p => [p.dint, p.dintY], p => p.dint, a => [add(a, 'dint'), add(a, 'dintY')]),
    psGroup('Fumbles', ['No', 'Lost'], p => p.fum, p => [p.fum, p.fuml || 0], p => p.fum, a => [add(a, 'fum'), add(a, 'fuml')])];
  return `<section class="ps-page"><h2 class="ps-h">Individual Offense</h2><hr class="ps-rule">${off.join('')}</section>
    <section class="ps-page"><h2 class="ps-h">Individual Defense</h2><hr class="ps-rule">${def.join('')}</section>`;
}
// Play-by-Play: every play first to last, by quarter, a line where each drive begins (games scored play by play).
function psPbp(){
  const L = R.log.filter(e => e.t !== 'set');
  if (!L.length) return '';
  const driveOf = [];
  R.drives.forEach(d => { if (d.i0 == null) return; const end = d.open || d.i1 == null ? R.log.length - 1 : d.i1; for (let i = d.i0; i <= end; i++) driveOf[i] = d; });
  // The scorer's clock sticks until it's changed, so a time shows only on the play where it was set.
  const clk = clockUsed(g), P = g.plays;
  const set = e => clk && e.q <= 4 && typeof (P[e.i] || {}).clk === 'number' && (!e.i || R.log[e.i - 1].q !== e.q || P[e.i].clk !== P[e.i - 1].clk);
  let h = '', q = null, lastD = null;
  for (const e of L){
    if (e.q !== q){ h += `${q != null ? '</tbody></table>' : ''}<div class="ps-gt">${qName(e.q)}</div><table class="ps-t ps-pbp"><tbody>`; q = e.q; lastD = null; }
    const d = driveOf[e.i] || null;
    if (d && d !== lastD) h += `<tr class="ps-dr"><td class="l" colspan="3">${esc(schoolName(g.teams[d.team].name))} drive at ${esc(R.yl(d.team, d.start))}</td></tr>`;
    lastD = d;
    h += `<tr><td class="l ps-nw">${set(e) ? mmss(P[e.i].clk) : ''}</td><td class="l ps-nw">${esc(e.sit || '')}</td><td class="l">${e.wiped ? `<s>${esc(e.wiped)}</s> ` : ''}${esc(e.text)}</td></tr>`;
  }
  return `<section class="ps-page"><h2 class="ps-h">Play-by-Play</h2><hr class="ps-rule">${h}</tbody></table></section>`;
}
const printSheet = () => `<section class="ps-first">${psHeader()}${psLines()}${psScoring()}</section>${psTeam()}${psPlayers()}${g.box ? '' : psPbp()}`;
