/* ================================================================
   State › Playoff History: every Kansas playoff bracket, one year
   and one class at a time, drawn the way a bracket is drawn. The
   brackets come from playoffs/years/<year>.json, which
   .github/kp/playoffs.py writes from the same games as each school's
   own playoff history.

     ?brackets                      the latest year, its first class
     ?brackets=<year>&class=<c>     that year's bracket for that class
     ?brackets&view=streak|home|titles   the other views in its View menu (Chuck, 2026-11-16), from
                                    playoffs/records.json: current playoff win streaks, current home
                                    playoff win streaks, and state titles (&class=<c> for one class)
   ================================================================ */
const PH_PAGE = PAGE_Q.has('brackets');
const ph = {index:null, year:'', cls:'', docs:{}, err:'', rec:null};
const PH_VIEWS = [['', 'Brackets'], ['streak', 'Playoff win streaks'], ['home', 'Home playoff win streaks'], ['titles', 'State championships']];
const PH_VIEW = (v => PH_VIEWS.some(x => x[0] === v) ? v : '')(PAGE_Q.get('view') || '');
const PH_ORDER = ['6A', '5A', '4A', '4A-I', '4A-II', '3A', '2A', '2-1A', '1A', '8M', '8M-I', '8M-II', '6M'];
const PH_LABEL = c => ({'8M':'8-Man', '8M-I':'8-Man I', '8M-II':'8-Man II', '6M':'6-Man'})[c] || `Class ${c}`;

async function startPlayoffHistory(){
  ui.viewer = true; ui.phist = true; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  loadLogos();
  renderPlayoffHistory();
  if (PH_VIEW){
    try {
      const r = await fetch(`${DATA}/playoffs/records.json`, {cache:'no-cache'});
      if (!r.ok) throw new Error(r.status);
      ph.rec = await r.json();
    } catch (e) { ph.err = 'Can’t load the playoff history. Reload to try again.'; }
    return renderPlayoffHistory();
  }
  try {
    const r = await fetch(`${DATA}/playoffs/years/index.json`, {cache:'no-cache'});
    if (!r.ok) throw new Error(r.status);
    ph.index = await r.json();
  } catch (e) { ph.err = 'Can’t load the playoff history. Reload to try again.'; return renderPlayoffHistory(); }
  const years = Object.keys(ph.index).sort((a, b) => b - a);
  const want = PAGE_Q.get('brackets');
  ph.year = years.includes(want) ? want : years[0];
  const classes = ph.index[ph.year] || [];
  const c = String(PAGE_Q.get('class') || '').toUpperCase();
  ph.cls = classes.includes(c) ? c : classes[0];
  renderPlayoffHistory();
  phLoad(ph.year);
}
function phLoad(y){
  if (ph.docs[y] !== undefined) return;
  ph.docs[y] = null;
  fetch(`${DATA}/playoffs/years/${y}.json`, {cache:'no-cache'}).then(r => r.ok ? r.json() : false)
    .then(d => { ph.docs[y] = d || false; renderPlayoffHistory(); }).catch(() => { ph.docs[y] = false; renderPlayoffHistory(); });
}

// One team's line in a game: its logo, its name (a link when the school has a page here) and its score.
function phTeam(t, won){
  if (!t) return '<div class="ph-t empty"></div>';
  const name = esc(t.n), nm = t.p ? `<a href="?team=${encodeURIComponent(t.n)}">${name}</a>` : name;
  // Its seed where the bracket was seeded (or its district, 1981 on), and in the first round an H for the team at home.
  return `<div class="ph-t${won ? ' won' : ''}">${t.sd ? `<i class="ph-sd">${t.sd}</i>` : ''}${t.dn ? `<i class="ph-dist">Dist. ${t.dn}</i>` : ''}${markFor({name:t.n, abbr:shortName(t.n), color:'#4A4B4D'}, 18)}<span class="ph-n">${nm}</span>${t.h ? '<i class="ph-home" title="Home">H</i>' : ''}<b>${t.s ?? '?'}</b></div>`;
}
// Each team where it sat in the bracket; w marks the bottom one as the winner; PEN a tie settled on penetrations.
const phGame = g => g ? `<div class="ph-g">${g.lbl ? `<div class="ph-lbl">${esc(g.lbl)}</div>` : ''}${phTeam(g.a, !g.w)}${phTeam(g.b, !!g.w)}${g.ot && g.ot !== 'PEN' ? '<i>OT</i>' : ''}${g.ot === 'PEN' ? '<div class="ph-at">Advanced on penetrations</div>' : ''}${g.at ? `<div class="ph-at">at ${esc(g.at)}</div>` : ''}</div>` : '';

// The bracket on a grid: one row for each first-round game, and each later game spanning the rows of the two that
// fed it, so it sits between them. Between the rounds, a connector joins each pair to the game they led to.
function phBracketHtml(B){
  const R = B.rounds.length, rows = B.rounds[0].games.length, cells = [];
  B.rounds.forEach((rd, r) => {
    const span = 2 ** r, col = r * 2 + 1;
    cells.push(`<div class="ph-h" style="grid-column:${col}">${esc(rd.name)}</div>`);
    rd.games.forEach((g, i) => {
      const row = `${i * span + 2} / span ${span}`;
      cells.push(`<div class="ph-cell" style="grid-column:${col};grid-row:${row}">${phGame(g)}</div>`);
      if (r && g){
        const a = B.rounds[r - 1].games[i * 2], b = B.rounds[r - 1].games[i * 2 + 1];
        const kind = a && b ? 'both' : a ? 'top' : b ? 'bot' : '';
        if (kind) cells.push(`<div class="ph-conn ${kind}" style="grid-column:${col - 1};grid-row:${row}"><i></i></div>`);
      }
    });
  });
  const fin = B.rounds[R - 1].games[0], champ = fin && (fin.w ? fin.b : fin.a);
  // The champion past the final, joined to it by a straight line.
  if (champ) cells.push(`<div class="ph-conn line" style="grid-column:${R * 2};grid-row:2 / span ${rows}"></div>`,
    `<div class="ph-h" style="grid-column:${R * 2 + 1}">Champion</div>`,
    `<div class="ph-cell ph-champ" style="grid-column:${R * 2 + 1};grid-row:2 / span ${rows}">${phTeam(Object.assign({}, champ, {s:'', h:0}), true)}</div>`);
  // a first column with district numbers in it is wider, so the names still fit
  const dist = B.rounds[0].games.some(g => g && (g.a.dn || g.b.dn));
  const cols = Array.from({length:R}, (_, r) => !r && dist ? 'minmax(240px,270px)' : 'minmax(190px,220px)').join(' 26px ') + (champ ? ' 26px minmax(160px,200px)' : '');
  return `<div class="ph-scroll"><div class="ph-grid" style="grid-template-columns:${cols};grid-template-rows:auto repeat(${rows}, minmax(64px, auto))">${cells.join('')}</div></div>`;
}

// The ranked lists: equal numbers share a rank.
function phRanked(rows, val, cols){
  const name = o => `<span class="ph-sch">${cMark(o.s)}${o.p === 0 ? esc(o.s) : `<a class="tlink" href="?team=${encodeURIComponent(o.s)}">${esc(o.s)}</a>`}</span>`;
  return `<div class="tbl-wrap"><table class="ctbl ph-rec"><thead><tr><th class="rk">#</th><th class="nm">School</th>${cols.map(c => `<th class="${c[2] || 'num'}">${c[0]}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(o => `<tr><td class="rk">${1 + rows.filter(x => val(x) > val(o)).length}</td><td class="nm">${name(o)}</td>${cols.map(c => `<td class="${c[2] || 'num'}">${c[1](o)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function phRecordsHtml(){
  const R = ph.rec, v = PH_VIEW;
  if (v === 'streak' || v === 'home'){
    const rows = R[v] || [];
    return `<section class="bcard ccard"><div class="ccard-hd"><h2>${v === 'home' ? 'Home Playoff Win Streaks' : 'Playoff Win Streaks'}</h2></div>${rows.length ? phRanked(rows.map(o => Object.assign({p:1}, o)), o => o.w,
      [['Wins', o => o.w], ['Since', o => `${o.y} ${esc(o.r)}`, 'txt']]) : '<p class="bempty">None on file.</p>'}</section>`;
  }
  const c = ph.cls, all = R.titles || [];
  const rows = (c ? all.filter(o => o.c[c]).map(o => Object.assign({}, o, {t:o.c[c].length})) : all.slice()).sort((a, b) => b.t - a.t || a.s.localeCompare(b.s));
  const cols = c ? [['Titles', o => o.t], ['Years', o => o.c[c].join(', '), 'txt']]
    : [['Titles', o => o.t], ['By class', o => PH_ORDER.filter(k => o.c[k]).concat(Object.keys(o.c).filter(k => !PH_ORDER.includes(k))).map(k => `${esc(PH_LABEL(k).replace('Class ', ''))} (${o.c[k].length})`).join(' · '), 'txt'],
       ['Last', o => Math.max(...Object.values(o.c).flat())]];
  return `<section class="bcard ccard"><div class="ccard-hd"><h2>${c ? `${esc(PH_LABEL(c))} State Championships` : 'State Championships'}</h2></div>${phRanked(rows, o => o.t, cols)}</section>`;
}

function renderPlayoffHistory(){
  if (!ui.phist) return;
  if (PH_VIEW) return renderPlayoffRecords();
  const box = $('#board'), y = ph.year, c = ph.cls;
  document.title = `${y ? `${y} ${PH_LABEL(c)} ` : ''}Playoff History · ${SITE_TITLE}`;
  const years = ph.index ? Object.keys(ph.index).sort((a, b) => b - a) : [];
  const yearPick = years.length ? `<div class="tp-season"><label class="eyebrow" for="ph-year">Season</label>
      <select class="inp" id="ph-year">${years.map(v => `<option value="${v}"${v === y ? ' selected' : ''}>${v}</option>`).join('')}</select></div>` : '';
  const tabs = y && ph.index ? (ph.index[y] || []).map(k => `<a class="h-btn${k === c ? ' on' : ''}" href="?brackets=${y}&amp;class=${encodeURIComponent(k)}">${esc(PH_LABEL(k))}</a>`).join('') : '';
  const head = `<section class="bcard bhead"><div class="tp-h-row"><h1>Playoff History</h1><div class="ph-picks">${phViewPick()}${yearPick}</div></div><div class="tp-links">${tabs}</div></section>`;
  if (ph.err) return void (box.innerHTML = head + `<section class="bcard"><p class="bempty">${esc(ph.err)}</p></section>`);
  const doc = y && ph.docs[y], B = doc && doc.classes && doc.classes[c];
  if (!B) return void (box.innerHTML = head + (doc === false ? '<section class="bcard"><p class="bempty">No bracket on file for this year.</p></section>' : skelRows(8, 2)));
  const extra = B.extra && B.extra.length ? `<section class="bcard"><h2 class="tp-h">Other games</h2><div class="tbl-x"><table class="tp-sched"><tbody>${B.extra.map(g =>
    `<tr><td class="wk">${esc(g.r)}</td><td>${phTeam(g.a, !g.w)}</td><td>${phTeam(g.b, !!g.w)}</td></tr>`).join('')}</tbody></table></div></section>` : '';
  const third = B.third && B.third.length ? `<div class="ph-third"><div class="ph-h">Third place</div>${B.third.map(phGame).join('')}</div>` : '';
  box.innerHTML = head + `<section class="bcard"><h2 class="tp-h">${y} ${esc(PH_LABEL(c))}</h2>${phBracketHtml(B)}${third}${B.note ? `<p class="ph-note">${esc(B.note)}</p>` : ''}</section>` + extra;
}

const phViewPick = () => `<div class="tp-season"><label class="eyebrow" for="ph-view">View</label>
  <select class="inp" id="ph-view">${PH_VIEWS.map(([k, t]) => `<option value="${k}"${k === PH_VIEW ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
function renderPlayoffRecords(){
  const box = $('#board'), R = ph.rec, v = PH_VIEW;
  const title = PH_VIEWS.find(x => x[0] === v)[1];
  if (v === 'titles' && R){
    const have = new Set((R.titles || []).flatMap(o => Object.keys(o.c)));
    const c = String(PAGE_Q.get('class') || '').toUpperCase();
    ph.cls = have.has(c) ? c : '';
  } else ph.cls = '';
  document.title = `${ph.cls ? `${PH_LABEL(ph.cls)} ` : ''}${title} · Playoff History · ${SITE_TITLE}`;
  const tabs = v === 'titles' && R ? [['', 'All']].concat(PH_ORDER.filter(k => (R.titles || []).some(o => o.c[k])).map(k => [k, PH_LABEL(k)]))
    .map(([k, t]) => `<a class="h-btn${k === ph.cls ? ' on' : ''}" href="?brackets&amp;view=titles${k ? `&amp;class=${encodeURIComponent(k)}` : ''}">${esc(t)}</a>`).join('') : '';
  const head = `<section class="bcard bhead"><div class="tp-h-row"><h1>Playoff History</h1>${phViewPick()}</div>${tabs ? `<div class="tp-links">${tabs}</div>` : ''}</section>`;
  if (ph.err) return void (box.innerHTML = head + `<section class="bcard"><p class="bempty">${esc(ph.err)}</p></section>`);
  box.innerHTML = head + (R ? phRecordsHtml() : skelRows(10, 3));
}

document.addEventListener('change', e => {
  if (ui.phist && e.target.id === 'ph-view') return void (location.href = `?brackets${e.target.value ? `&view=${e.target.value}` : ''}`);
  if (!ui.phist || e.target.id !== 'ph-year') return;
  const y = e.target.value, classes = (ph.index && ph.index[y]) || [];
  location.href = `?brackets=${y}&class=${encodeURIComponent(classes.includes(ph.cls) ? ph.cls : classes[0] || '')}`;
});
