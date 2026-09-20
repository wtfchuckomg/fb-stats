/* ================================================================
   UI: scoreboard, field, and the play-entry pad.
   ================================================================ */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const STORE = 'pressbox.v1';
let db = {cur:null, games:{}}, g = null, R = null;
const ui = {type:null, draft:null, editing:null, ctx:null, tab:'gamecast', pbp:null, side:'A', open:null, confirm:null, ask:null,
  mode:(() => { try { return localStorage.getItem('pressbox.mode') || 'quick'; } catch (e) { return 'quick'; } })(),
  qtext:'', qedit:false, cheat:false};

const ab = s => g.teams[s].abbr || s;
const rosterName = (s, n) => playerName(rosterGet(g.teams[s].roster, n, s)) || playerName(fillName(g.teams[s].name, n, s));
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const perShort = q => q <= 4 ? ord(q) : `OT${q - 4 > 1 ? q - 4 : ''}`;
const perLabel = q => q <= 4 ? `${ord(q)} Qtr` : `OT${q - 4 > 1 ? ' ' + (q - 4) : ''}`;
function parseClock(v){
  v = String(v).trim(); if (!v) return null;
  if (v.includes(':')){ const [m, s] = v.split(':'); return (+m || 0) * 60 + (+s || 0); }
  const d = v.replace(/\D/g, ''); if (!d) return null;
  return d.length <= 2 ? +d * 60 : +d.slice(0, -2) * 60 + +d.slice(-2);
}
// A game that arrived without a clock (an older copy, or one part-way in from another device) reads as stopped
// at the start of a quarter rather than throwing on every tick.
function clockNow(){ const c = (g && g.clk) || {s:((g && g.set && g.set.qtr) || 12) * 60, run:false, at:0}; return c.run ? Math.max(0, c.s - (Date.now() - c.at) / 1000) : c.s; }
// An incomplete pass, or a run or catch that went out of bounds, stops the clock.
const stopsClock = p => (p.t === 'pass' && p.res === 'i') || ((p.t === 'run' || (p.t === 'pass' && p.res === 'c')) && /\b(oob|out of bounds)\b/i.test(p.q || ''));
function stopClockFor(p){ if (g.clk.run && stopsClock(p)) g.clk = {s:clockNow(), run:false, at:Date.now()}; }
function setClock(s, run){ g.clk = {s:Math.max(0, s), run:!!run && s > 0, at:Date.now()}; save(); }

/* ---------- game strip (scoreboard) ---------- */
function renderBoard(){
  const st = R.st, T = g.teams;
  const dots = s => Array.from({length: st.q > 4 ? 1 : 3}, (_, i) => `<i class="${i < st.to[s] ? 'on' : ''}"></i>`).join('');
  // Like ESPN's: school and mascot, the record under it, beside the score. Once it's final the loser is grayed, an
  // arrow points at the winner, and the timeouts go.
  const won = st.final && st.score.A !== st.score.H ? (st.score.A > st.score.H ? 'A' : 'H') : null;
  const fullName = t => t.mascot && !String(t.name).toLowerCase().endsWith(t.mascot.toLowerCase()) ? `${t.name} ${t.mascot}` : t.name;
  const side = s => {
    const has = !st.final && st.poss === s && st.phase !== 'kick';
    return `<div class="st-side ${s === 'H' ? 'home' : 'away'}${won && won !== s ? ' lose' : ''}" style="--tc:${esc(T[s].color)}">
      <div class="st-logo">${teamMark(s, 64)}</div>
      <div class="st-id"><div class="st-name">${esc(fullName(T[s]))}</div><div class="st-rec">${esc(recordText(T[s], s, !st.final, gameWeek(g), st.score) || (s === 'A' ? 'Away' : 'Home'))}</div></div>
      <div class="st-scorebox"><div class="st-score"><span>${st.score[s]}</span>${has ? '<span class="st-poss" title="Has the ball"></span>' : ''}${won === s ? '<i class="st-win" title="Won"></i>' : ''}</div>
        ${st.final ? '' : `<div class="st-tos" title="${st.to[s]} timeout${st.to[s] === 1 ? '' : 's'} left">${dots(s)}</div>`}</div></div>`;
  };
  const clockOn = !st.final && st.q <= 4;
  const per = st.final ? `Final${st.q > 4 ? '/OT' : ''}` : perShort(st.q);
  const go = g.clk.run
    ? '<svg viewBox="0 0 12 12"><rect x="1" y="1" width="3.6" height="10"/><rect x="7.4" y="1" width="3.6" height="10"/></svg>'
    : '<svg viewBox="0 0 12 12"><path d="M2 1l9 5-9 5z"/></svg>';
  const line1 = clockOn
    ? `<button class="st-clock num ${g.clk.run ? 'run' : ''}" id="clk" title="Tap to set the clock">${mmss(clockNow())}</button><span>-</span><span>${per}</span>${ui.viewer ? '' : `<button class="clk-go" id="clkgo" aria-label="${g.clk.run ? 'Stop' : 'Start'} the clock">${go}</button>`}`
    : `<span>${per}</span>`;
  let l2 = '', l3 = '';
  if (!st.final){
    if (st.phase === 'play'){ l2 = `${ord(st.down)} & ${st.ltg >= R.FL ? 'Goal' : fy(st.ltg - st.spot)}`; l3 = R.yl(st.poss, st.spot); }
    else if (st.phase === 'kick'){ l2 = st.kickKind === 'free' ? 'Free kick' : 'Kickoff'; l3 = `${ab(st.poss)} from the ${R.yl(st.poss, st.kickFrom)}`; }
    else if (st.phase === 'try'){ l2 = 'Try'; l3 = R.yl(st.poss, st.spot); }
  }
  $('#sb').innerHTML = `<div class="strip-in">${side('A')}
    <div class="st-mid"><div class="st-line1">${line1}</div>${l2 ? `<div class="st-sit">${esc(l2)}</div>` : ''}${l3 ? `<div class="st-sit">${esc(l3)}</div>` : ''}${st.final ? stripLines() : ''}</div>
    ${side('H')}</div>${driveBar()}`;
}
// A finished game's line score under Final, as ESPN has it, with every overtime period together in one OT column.
function stripLines(){
  const st = R.st, L = st.lines; if (!L) return '';
  // One column per quarter, then one for each overtime the game went to.
  const cols = lineCols(st);
  const row = s => `<tr><td>${esc(g.teams[s].abbr || g.teams[s].name)}</td>${cols.map(i => `<td>${qCell(st, s, i)}</td>`).join('')}<td>${st.score[s]}</td></tr>`;
  return `<table class="st-ls"><thead><tr><th></th>${cols.map(i => `<th>${colLabel(i)}</th>`).join('')}<th>T</th></tr></thead><tbody>${row('A')}${row('H')}</tbody></table>`;
}
// The thin bar under the strip on phones: where the ball is, the line to gain, and this drive so far.
function driveBar(){
  const st = R.st; if (st.final || st.phase !== 'play') return '';
  const FL = R.FL, s = st.poss, X = pos => (s === 'A' ? pos : FL - pos) / FL * 100, d = openDrive();
  let ticks = ''; for (let y = 10; y < FL; y += 10) ticks += `<i class="dbar-tick" style="left:${y / FL * 100}%"></i>`;
  const from = d && d.team === s ? X(d.start) : X(st.spot), to = X(st.spot), lo = Math.min(from, to), hi = Math.max(from, to);
  const ltg = st.ltg < FL ? `<i class="dbar-ltg" style="left:${X(st.ltg)}%"></i>` : '';
  const lbl = [20, FL / 2, FL - 20].map(y => `<span style="left:${y / FL * 100}%">${y <= FL / 2 ? y : FL - y}</span>`).join('');
  return `<div class="dbar"><div class="dbar-track">${ticks}${ltg}<i class="dbar-line" style="left:${lo}%;width:${hi - lo}%"></i><i class="dbar-head ${s === 'A' ? 'r' : 'l'}" style="left:${to}%"></i></div><div class="dbar-lbl">${lbl}</div></div>`;
}

/* ---------- field: the light gamecast field, end zones in team colors ---------- */
let fieldFontsHooked = false;

// The last play's path as the engine traced it, the way ESPN's gamecast shows it: passes and kicks sail,
// runs and returns stay on the ground. A score (or a good kick) flashes the end zone.
function playTrace(){
  const e = lastPlay(), legs = e && e.trace ? e.trace.filter(l => Math.abs(l.b - l.a) >= 1) : [];
  return legs.length ? {key:`${g.id}:${e.i}`, legs, flash:/TOUCHDOWN|is GOOD/.test(e.text || '')} : null;
}
// The curve's first t of its length (de Casteljau), and the ball's place, heading and size at t.
function arcAt(P, t, lift = true){
  const u = 1 - t, [x0, y0, cx, cy, x1, y1] = P, f = v => v.toFixed(1);
  const qx = x0 + (cx - x0) * t, qy = y0 + (cy - y0) * t;
  const bx = u * u * x0 + 2 * u * t * cx + t * t * x1, by = u * u * y0 + 2 * u * t * cy + t * t * y1;
  const ang = Math.atan2(2 * u * (cy - y0) + 2 * t * (y1 - cy), 2 * u * (cx - x0) + 2 * t * (x1 - cx)) * 180 / Math.PI;
  const sc = lift ? 1 + .35 * Math.sin(Math.PI * t) : 1;   // a ball in the air grows a little at the top, as if nearer
  return {d:`M${f(x0)} ${f(y0)} Q${f(qx)} ${f(qy)} ${f(bx)} ${f(by)}`, tf:`translate(${f(bx)} ${f(by)}) rotate(${f(ang)}) scale(${sc.toFixed(3)})`};
}
const PLAY_FADE = 300, PLAY_FLASH = 1000;
let anim = {key:'', t0:0, raf:0, calm:false};
// One frame of the last play: each leg drawn as far as the ball has gone, the ball on its leg, then a fade,
// and for a score two flashes of the end zone. Each new play runs once; a redraw mid-play picks up where it was.
function stepTrace(){
  anim.raf = 0;
  const box = $('#field'), legs = box ? [...box.querySelectorAll('.leg')] : [];
  if (!legs.length) return;
  const el = anim.calm ? Infinity : performance.now() - anim.t0;
  let end = 0, pos = null;
  legs.forEach(l => {
    const at = +l.dataset.start, dur = +l.dataset.dur, t = clamp((el - at) / dur, 0, 1);
    const a = arcAt(l.dataset.pts.split(',').map(Number), t, !!l.dataset.air);
    l.querySelectorAll('path').forEach(p => p.setAttribute('d', t > 0 ? a.d : ''));
    if (el >= at) pos = a;
    end = at + dur;
  });
  const ball = box.querySelector('.pl-ball'), fl = box.querySelector('.ez-flash');
  if (ball){
    if (el >= end + PLAY_FADE) ball.remove();
    else { ball.setAttribute('transform', pos.tf); ball.style.opacity = el < end ? 1 : (1 - (el - end) / PLAY_FADE).toFixed(3); }
  }
  if (fl){ const f = (el - end) / PLAY_FLASH; fl.style.opacity = f > 0 && f < 1 ? (.6 * Math.abs(Math.sin(f * Math.PI * 2))).toFixed(3) : 0; }
  if (el < end + (fl ? PLAY_FLASH : PLAY_FADE)) anim.raf = requestAnimationFrame(stepTrace);
}

function renderField(){
  const box = $('#field'); if (!box || !R) return;
  const st = R.st, T = g.teams, FL = R.FL, HALF = FL / 2;
  const W = 1200, H = 206, k = W / (FL + 20), X = y => (10 + y) * k, EZ = 10 * k;
  const top = 26, bot = 170, mid = (top + bot) / 2;
  const abs = (side, pos) => side === 'A' ? pos : FL - pos;   // yards from the visitors' goal (left)
  const cond = "'Roboto Condensed','Arial Narrow',sans-serif", sans = "-apple-system,system-ui,Roboto,Arial,sans-serif";
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Field position">`;
  for (let i = 0; i < FL / 10; i++) s += `<rect x="${X(i * 10)}" y="${top}" width="${10 * k}" height="${bot - top}" style="fill:var(${i % 2 ? '--fld-b' : '--fld-a'})"/>`;
  for (let y = 5; y < FL; y += 5) s += `<line x1="${X(y)}" y1="${top}" x2="${X(y)}" y2="${bot}" style="stroke:var(--fld-line);stroke-width:${y === HALF ? 3 : y % 10 === 0 ? 1.6 : .8}"/>`;
  // The mascot if one is set, else the school. Sized from an estimate here, then measured below.
  const room = bot - top - 16;
  const ez = (side, x, rot) => {
    const name = String(T[side].mascot || T[side].name || T[side].abbr).toUpperCase(), fs = Math.min(34, room / (0.56 * Math.max(1, name.length)));
    return `<rect x="${x}" y="${top}" width="${EZ}" height="${bot - top}" style="fill:${esc(T[side].color)}"/>`
      + `<text class="ez-name" x="${x + EZ / 2}" y="${mid}" transform="rotate(${rot} ${x + EZ / 2} ${mid})" text-anchor="middle" dominant-baseline="central" style="fill:#fff;font:800 ${fs.toFixed(1)}px ${cond};letter-spacing:1px">${esc(name)}</text>`;
  };
  s += ez('A', 0, -90) + ez('H', W - EZ, 90);
  s += `<path d="M3 ${mid - 36} v72 M${W - 3} ${mid - 36} v72" style="stroke:var(--ltg);stroke-width:5;stroke-linecap:round"/>`;
  const lbl = (x, t) => `<text x="${x}" y="${H - 8}" text-anchor="middle" style="fill:var(--fld-num);font:500 19px ${sans}">${esc(t)}</text>`;
  s += lbl(X(0), T.A.abbr) + lbl(X(FL), T.H.abbr);
  for (let y = 10; y < FL; y += 10) s += lbl(X(y), y <= HALF ? y : FL - y);
  // The last play's legs, one after another; stepTrace() draws each as far as the ball has gone.
  const tr = playTrace();
  let ball = '';
  if (tr){
    if (tr.key !== anim.key) anim = {key:tr.key, t0:performance.now(), raf:anim.raf};
    anim.calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const y = mid + 30;
    let at = 0;
    tr.legs.forEach(l => {
      const x0 = X(l.a), x1 = X(l.b), dx = Math.abs(x1 - x0), yd = Math.abs(l.b - l.a), air = l.k !== 'run';
      const h = l.k === 'kick' ? clamp(dx * .28 + 36, 44, 104) : air ? clamp(dx * .3 + 14, 22, 74) : 0;
      const dur = l.k === 'kick' ? clamp(800 + yd * 16, 900, 1800) : air ? clamp(500 + yd * 22, 600, 1500) : clamp(350 + yd * 30, 450, 1500);
      const P = [x0, y, (x0 + x1) / 2, y - 2 * h, x1, y].map(v => v.toFixed(1));
      s += `<g class="leg" data-pts="${P}" data-start="${at}" data-dur="${dur}" data-air="${air ? 1 : ''}">`
        + `<path style="fill:none;stroke:#fff;stroke-width:7;stroke-linecap:round;opacity:.85"/>`
        + `<path style="fill:none;stroke:${l.x ? 'var(--muted)' : esc(T[l.s].color)};stroke-width:3.5;stroke-linecap:round${l.x ? ';stroke-dasharray:7 8' : ''}"/></g>`;
      at += dur;
    });
    const b = tr.legs[tr.legs.length - 1].b;
    if (tr.flash && (b >= FL || b <= 0)) s += `<rect class="ez-flash" x="${b >= FL ? W - EZ : 0}" y="${top}" width="${EZ}" height="${bot - top}" style="fill:var(--ltg);opacity:0"/>`;
    if (!anim.calm && performance.now() - anim.t0 < at + PLAY_FADE)
      ball = `<g class="pl-ball"><ellipse rx="13" ry="7.5" style="fill:#7A3E1D;stroke:#4A2410;stroke-width:1.5"/>`
        + `<path d="M-5 0H5M-3 -2.6v5.2M0 -2.6v5.2M3 -2.6v5.2" style="stroke:#fff;stroke-width:1.3;fill:none"/></g>`;
  }
  if (!st.final){
    const side = st.poss, pos = st.phase === 'kick' ? st.kickFrom : st.spot, bx = X(abs(side, pos)), dir = side === 'A' ? 1 : -1, d = openDrive();
    if (st.phase === 'play' && st.ltg < FL) s += `<line x1="${X(abs(side, st.ltg))}" y1="${top}" x2="${X(abs(side, st.ltg))}" y2="${bot}" style="stroke:var(--ltg);stroke-width:5"/>`;
    if (st.phase === 'play' && d && d.team === side && Math.abs(d.start - pos) > .5){
      const sx = X(abs(side, d.start)), ly = mid + 30;
      s += `<line x1="${sx}" y1="${ly}" x2="${bx - dir * 14}" y2="${ly}" style="stroke:var(--drive);stroke-width:4"/>`;
      s += `<path d="M${bx} ${ly} l${-dir * 16} -9 v18 z" style="fill:var(--drive)"/>`;
    }
    // The pin over the ball, carrying the team's mark.
    const cy = mid - 18, url = logoUrl(T[side]);
    s += `<path d="M${bx} ${cy + 44} L${bx - 13.3} ${cy + 20} A24 24 0 1 1 ${bx + 13.3} ${cy + 20} Z" style="fill:var(--card);stroke:var(--drive);stroke-width:2"/>`;
    s += url ? `<image href="${esc(url)}" x="${bx - 17}" y="${cy - 17}" width="34" height="34" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle cx="${bx}" cy="${cy}" r="17" style="fill:${esc(T[side].color)}"/><text x="${bx}" y="${cy}" text-anchor="middle" dominant-baseline="central" style="fill:#fff;font:800 13px ${cond}">${esc(String(T[side].abbr).slice(0, 4))}</text>`;
  }
  box.innerHTML = s + ball + '</svg>';
  if (tr){ if (anim.raf) cancelAnimationFrame(anim.raf); stepTrace(); }
  // Shrink any end-zone name that still runs past the end zone (the 1px letter spacing doesn't scale).
  box.querySelectorAll('.ez-name').forEach(t => {
    const len = t.getComputedTextLength(), n = t.textContent.length, fs = parseFloat(t.style.fontSize);
    if (len > room) t.style.fontSize = (fs * (room - n) / (len - n)).toFixed(1) + 'px';
  });
  // Widths change once the web font arrives, so draw once more then.
  if (!fieldFontsHooked && document.fonts){ fieldFontsHooked = true; document.fonts.ready.then(() => renderField()); }
}

/* ---------- pad: drafts ---------- */
const TYPE_LABEL = {run:'Run', pass:'Pass', punt:'Punt', fg:'Field goal', ko:'Kickoff', try:'Try', pen:'Penalty', to:'Timeout', note:'Note'};
function typesFor(st){
  if (st.final) return [];
  if (st.phase === 'kick') return ['ko', 'pen', 'to', 'note'];
  if (st.phase === 'try') return ['try', 'pen', 'to', 'note'];
  return ['run', 'pass', 'punt', 'fg', 'pen', 'to', 'note'];
}
const ROLE = {rush:p => p.ru, qb:p => p.pa + p.psk, rec:p => p.re, kick:p => p.ko + p.fga + p.xpa, punt:p => p.pu,
  ret:p => p.kr + p.pr, def:p => p.tk + p.ast + p.sk + p.dint + p.pbu};
function recent(side, role){
  const f = ROLE[role]; if (!f) return [];
  return Object.values(ui.ctx.S.pl[side]).filter(p => p.n !== 'team' && f(p) > 0).sort((a, b) => f(b) - f(a)).slice(0, 5).map(p => p.n);
}
const first = (side, role) => recent(side, role)[0] || '';
function penBlank(side, enf){ return {side, name:'Holding', y:10, a:false, l:false, n:'', enf}; }
function blank(t, st){
  const O = st.poss, D = other(O);
  const fum = {lost:'lost', by:'', ff:'', ry:''};
  const base = {t, fumOn:false, fum, penOn:false, pen:penBlank(D, 'prev')};
  switch (t){
    case 'run': return {...base, r:'', y:'', yn:'gain', tk:['', '']};
    case 'pass': return {...base, qb:first(O, 'qb'), res:'c', to:'', y:'', yn:'gain', tk:['', ''], pbu:'', ib:'', at:'', ry:'', by:['', ''], sy:''};
    case 'punt': return {...base, k:first(O, 'punt'), d:'', res:'ret', ret:'', ry:'', tk:['', ''], by:'', b:''};
    case 'ko': return {...base, k:first(O, 'kick'), d:'', res:'ret', ret:'', ry:'', tk:['', '']};
    case 'fg': return {...base, k:first(O, 'kick'), d:'', res:'good', by:'', b:'', ret:'', ry:''};
    case 'try': return {t, kind:'kick', res:'good', k:first(O, 'kick'), r:'', qb:first(O, 'qb'), to:''};
    case 'pen': return {t, pen:penBlank(O, 'acc')};
    case 'note': return {t, text:''};
    default: return {t};
  }
}
function toDraft(p, st){
  const d = blank(p.t, st), str = v => v == null ? '' : String(v);
  for (const k of Object.keys(p)){
    if (k === 'fum'){ d.fumOn = true; d.fum = {lost:p.fum.lost ? 'lost' : 'kept', by:str(p.fum.by), ff:str(p.fum.ff), ry:str(p.fum.ry || '')}; }
    else if (k === 'pen'){ d.pen = {...p.pen, n:str(p.pen.n)}; if (p.t !== 'pen') d.penOn = true; }
    else if (k === 'y'){ d.y = p.y ? String(Math.abs(p.y)) : ''; d.yn = p.y < 0 ? 'loss' : 'gain'; }
    else if (k === 'tk' || k === 'by' && Array.isArray(p.by)){ const a = p[k].map(String); d[k] = [a[0] || '', a[1] || '']; }
    else if (k !== 'clk') d[k] = str(p[k]);
  }
  if (p.d === 0 && p.t !== 'fg') d.d = '';
  d.clkTxt = p.clk != null ? mmss(p.clk) : '';
  return d;
}
function cleanPen(x){ return {side:x.side, name:x.name, y:Number(x.y) || 0, a:!!x.a, l:!!x.l, n:String(x.n || '').replace(/\D/g, '') || undefined, enf:x.enf}; }
function buildPlay(d){
  const n = v => v === '' || v == null ? undefined : Number(String(v).replace(/[^\d.]/g, '')) || 0;
  const j = v => String(v ?? '').replace(/\D/g, '') || undefined;
  const js = a => (a || []).map(j).filter(Boolean);
  const yy = () => (d.yn === 'loss' ? -1 : 1) * (n(d.y) || 0);
  const p = {t:d.t};
  switch (d.t){
    case 'run': Object.assign(p, {r:j(d.r), y:yy(), tk:js(d.tk)}); break;
    case 'pass':
      Object.assign(p, {qb:j(d.qb), res:d.res});
      if (d.res === 'c') Object.assign(p, {to:j(d.to), y:yy(), tk:js(d.tk)});
      if (d.res === 'i') Object.assign(p, {to:j(d.to), pbu:j(d.pbu)});
      if (d.res === 'x') Object.assign(p, {ib:j(d.ib), at:n(d.at) || 0, ry:n(d.ry) || 0});
      if (d.res === 's') Object.assign(p, {by:js(d.by), sy:n(d.sy) || 0});
      break;
    case 'punt':
      Object.assign(p, {k:j(d.k), d:n(d.d), res:d.res});
      if (d.res === 'ret') Object.assign(p, {ret:j(d.ret), ry:n(d.ry) || 0, tk:js(d.tk)});
      if (d.res === 'fc') p.ret = j(d.ret);
      if (d.res === 'blk') Object.assign(p, {by:j(d.by), b:n(d.b) || 0, ret:j(d.ret), ry:n(d.ry) || 0});
      break;
    case 'ko':
      Object.assign(p, {k:j(d.k), d:n(d.d) || 0, res:d.res});
      if (d.res === 'ret') Object.assign(p, {ret:j(d.ret), ry:n(d.ry) || 0, tk:js(d.tk)});
      if (d.res === 'fc' || d.res === 'onside') p.ret = j(d.ret);
      break;
    case 'fg':
      Object.assign(p, {k:j(d.k), d:n(d.d), res:d.res});
      if (d.res === 'blk') Object.assign(p, {by:j(d.by), b:n(d.b) || 0, ret:j(d.ret), ry:n(d.ry) || 0});
      break;
    case 'try':
      Object.assign(p, {kind:d.kind, res:d.res});
      if (d.kind === 'kick') p.k = j(d.k);
      if (d.kind === 'run') p.r = j(d.r);
      if (d.kind === 'pass'){ p.qb = j(d.qb); p.to = j(d.to); }
      break;
    case 'pen': p.pen = cleanPen(d.pen); break;
    case 'note': p.text = d.text; break;
  }
  if (fumbleAllowed(d) && d.fumOn) p.fum = {lost:d.fum.lost === 'lost', by:j(d.fum.by), ff:j(d.fum.ff), ry:n(d.fum.ry) || 0};
  if (['run', 'pass', 'punt', 'ko', 'fg'].includes(d.t) && d.penOn) p.pen = cleanPen(d.pen);
  return JSON.parse(JSON.stringify(p));
}
const fumbleAllowed = d => d.t === 'run' || (d.t === 'pass' && (d.res === 'c' || d.res === 's' || d.res === 'x')) || ((d.t === 'punt' || d.t === 'ko') && d.res === 'ret');
const getK = (o, path) => path.split('.').reduce((a, k) => a == null ? a : a[k], o);
function setK(o, path, v){ const ks = path.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }

/* ---------- pad: field builders ---------- */
function fJ(k, label, side, role){
  const v = getK(ui.draft, k) ?? '';
  const nums = role ? recent(side, role) : [];
  return `<div class="fld"><label class="eyebrow" for="f-${k}">${label} · ${esc(ab(side))}</label>
    <input class="inp" id="f-${k}" data-k="${k}" data-side="${side}" inputmode="numeric" autocomplete="off" maxlength="2" placeholder="#" value="${esc(v)}">
    <div class="who" data-who="${k}">${esc(rosterName(side, v))}</div>
    ${nums.length ? `<div class="chips">${nums.map(n => `<button type="button" class="chip" data-chip="${k}" data-v="${n}" title="${esc(rosterName(side, n))}">#${n}</button>`).join('')}</div>` : ''}</div>`;
}
function fN(k, label, ph = ''){
  return `<div class="fld"><label class="eyebrow" for="f-${k}">${label}</label>
    <input class="inp" id="f-${k}" data-k="${k}" inputmode="numeric" autocomplete="off" placeholder="${esc(ph)}" value="${esc(getK(ui.draft, k) ?? '')}"></div>`;
}
function seg(k, opts){
  const v = getK(ui.draft, k);
  return `<div class="seg" role="group">${opts.map(([val, lab]) => `<button type="button" data-seg="${k}" data-v="${val}" aria-pressed="${String(v) === String(val)}">${esc(lab)}</button>`).join('')}</div>`;
}
const fSeg = (k, label, opts) => `<div class="fld"><span class="eyebrow">${label}</span>${seg(k, opts)}</div>`;
function fYds(){
  return `<div class="fld"><label class="eyebrow" for="f-y">Yards</label><div class="yds">${seg('yn', [['gain', 'Gain'], ['loss', 'Loss']])}
    <input class="inp" id="f-y" data-k="y" inputmode="numeric" autocomplete="off" placeholder="0" value="${esc(ui.draft.y)}">
    <button type="button" class="tdbtn" data-td title="Fill in the yards to the goal line">TD</button></div></div>`;
}
const tog = (k, label, cls = '') => `<button type="button" class="tog ${cls}" data-tog="${k}" aria-pressed="${!!getK(ui.draft, k)}"><span class="box"></span>${label}</button>`;
const row = (...a) => `<div class="row">${a.join('')}</div>`;

function fumbleFields(){
  const st = ui.ctx.st, d = ui.draft, carrier = d.t === 'punt' || d.t === 'ko' || (d.t === 'pass' && d.res === 'x') ? other(st.poss) : st.poss;
  const lost = d.fum.lost === 'lost', recSide = lost ? other(carrier) : carrier;
  return `<div class="sub">${fSeg('fum.lost', 'Fumble', [['lost', `Lost to ${ab(other(carrier))}`], ['kept', `${ab(carrier)} kept it`]])}
    ${row(fJ('fum.by', 'Recovered by', recSide), fJ('fum.ff', 'Forced by', other(carrier)), lost ? fN('fum.ry', 'Return yards', '0') : '')}
    <p class="hint">Enter the play's yards to where the ball was recovered.</p></div>`;
}
const ENF_HINT = {
  prev:'The play is wiped out and its stats don’t count. Yards are marked off from the previous spot.',
  end:'The play and its stats count, then the yards are marked off from where it ended. For a foul downfield, enter the play’s yards only up to the spot of the foul.',
  dec:'The play stands. The foul is noted but not charged.',
  off:'Fouls by both teams cancel and the down is replayed.',
  acc:'Marked off from the current spot. Half the distance to the goal applies automatically.'};
function flagFields(standalone){
  const pn = ui.draft.pen;
  const enf = standalone ? [['acc', 'Accepted'], ['off', 'Offsetting']] : [['prev', 'Replay down'], ['end', 'Add to play'], ['dec', 'Declined'], ['off', 'Offsetting']];
  return `<div class="sub ${standalone ? '' : 'flag'}">
    ${row(fSeg('pen.side', 'Against', [['A', ab('A')], ['H', ab('H')]]),
      `<div class="fld"><label class="eyebrow" for="f-pen.name">Foul</label><select class="inp" id="f-pen.name" data-k="pen.name">${PENALTIES.map(x => `<option ${x.name === pn.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>`)}
    ${row(fN('pen.y', 'Yards', '0'), fJ('pen.n', 'Player', pn.side))}
    <div class="checks">${tog('pen.a', 'Automatic 1st down')}${tog('pen.l', 'Loss of down')}</div>
    ${fSeg('pen.enf', 'Enforcement', enf)}
    <p class="hint">${ENF_HINT[pn.enf]}</p></div>`;
}
function extras(){
  const d = ui.draft;
  let h = '<div class="more"><div class="checks">';
  if (fumbleAllowed(d)) h += tog('fumOn', 'Fumble');
  h += tog('penOn', 'Flag on the play', 'flagtog') + '</div>';
  if (fumbleAllowed(d) && d.fumOn) h += fumbleFields();
  if (d.penOn) h += flagFields(false);
  return h + '</div>';
}

function formHtml(){
  const st = ui.ctx.st, d = ui.draft, O = st.poss, D = other(O);
  switch (d.t){
    case 'run':
      return row(fJ('r', 'Ball carrier', O, 'rush')) + fYds() + row(fJ('tk.0', 'Tackle', D, 'def'), fJ('tk.1', 'Assist', D)) + extras();
    case 'pass': {
      let h = row(fJ('qb', 'Passer', O, 'qb')) + fSeg('res', 'Result', [['c', 'Complete'], ['i', 'Incomplete'], ['x', 'Intercepted'], ['s', 'Sacked']]);
      if (d.res === 'c') h += row(fJ('to', 'Receiver', O, 'rec')) + fYds() + row(fJ('tk.0', 'Tackle', D, 'def'), fJ('tk.1', 'Assist', D));
      if (d.res === 'i') h += row(fJ('to', 'Intended for', O, 'rec'), fJ('pbu', 'Broken up by', D));
      if (d.res === 'x') h += row(fJ('ib', 'Intercepted by', D, 'def'), fN('at', 'Yards past the line', '0'), fN('ry', 'Return yards', '0'));
      if (d.res === 's') h += row(fJ('by.0', 'Sacked by', D, 'def'), fJ('by.1', 'Shared with', D), fN('sy', 'Yards lost', '0'));
      return h + extras();
    }
    case 'punt': {
      let h = row(fJ('k', 'Punter', O, 'punt'), d.res === 'tb' || d.res === 'blk' ? '' : fN('d', 'Punt yards', '0'));
      h += fSeg('res', 'Result', [['ret', 'Returned'], ['fc', 'Fair catch'], ['down', 'Downed'], ['oob', 'Out of bounds'], ['tb', 'Touchback'], ['blk', 'Blocked']]);
      if (d.res === 'ret') h += row(fJ('ret', 'Returner', D, 'ret'), fN('ry', 'Return yards', '0')) + row(fJ('tk.0', 'Tackle', O, 'def'), fJ('tk.1', 'Assist', O));
      if (d.res === 'fc') h += row(fJ('ret', 'Caught by', D, 'ret'));
      if (d.res === 'blk') h += row(fJ('by', 'Blocked by', D), fN('b', 'Recovered, yds behind line', '0')) + row(fJ('ret', 'Recovered by', D), fN('ry', 'Return yards', '0'));
      return h + extras();
    }
    case 'ko': {
      const K = st.poss, Rr = other(K);
      let h = row(fJ('k', 'Kicker', K, 'kick'), d.res === 'tb' || d.res === 'oob' ? '' : fN('d', 'Kick yards', '0'));
      h += fSeg('res', 'Result', [['ret', 'Returned'], ['tb', 'Touchback'], ['fc', 'Fair catch'], ['down', 'Downed'], ['oob', 'Out of bounds'], ['onside', 'Onside recovery']]);
      if (d.res === 'ret') h += row(fJ('ret', 'Returner', Rr, 'ret'), fN('ry', 'Return yards', '0')) + row(fJ('tk.0', 'Tackle', K, 'def'), fJ('tk.1', 'Assist', K));
      if (d.res === 'fc') h += row(fJ('ret', 'Caught by', Rr, 'ret'));
      if (d.res === 'onside') h += row(fJ('ret', 'Recovered by', K));
      h += `<p class="hint">Kick yards count from the ${esc(R.yl(K, st.kickFrom))}. Out of bounds gives ${esc(ab(Rr))} the ball 25 yards beyond the kicking line (its ${ui.ctx.FL - rulesOf(g).kickFrom - NFHS.oobFreeKick} on a normal kickoff).</p>`;
      return h + extras();
    }
    case 'fg': {
      const auto = Math.round(ui.ctx.FL - st.spot + NFHS.fgExtra);
      let h = row(fJ('k', 'Kicker', O, 'kick'), fN('d', 'Distance', String(auto)));
      h += fSeg('res', 'Result', [['good', 'Good'], ['miss', 'No good'], ['blk', 'Blocked']]);
      if (d.res === 'miss') h += `<p class="hint">Under NFHS rules a missed field goal is a touchback, so ${esc(ab(D))} takes over at its ${rulesOf(g).tb}.</p>`;
      if (d.res === 'blk') h += row(fJ('by', 'Blocked by', D), fN('b', 'Recovered, yds behind line', '0')) + row(fJ('ret', 'Recovered by', D), fN('ry', 'Return yards', '0'));
      return h + extras();
    }
    case 'try': {
      let h = fSeg('kind', 'Try', [['kick', 'Kick · 1'], ['run', 'Run · 2'], ['pass', 'Pass · 2']]);
      if (d.kind === 'kick') h += row(fJ('k', 'Kicker', O, 'kick')) + fSeg('res', 'Result', [['good', 'Good'], ['miss', 'No good'], ['blk', 'Blocked']]);
      if (d.kind === 'run') h += row(fJ('r', 'Ball carrier', O, 'rush')) + fSeg('res', 'Result', [['good', 'Good'], ['miss', 'No good']]);
      if (d.kind === 'pass') h += row(fJ('qb', 'Passer', O, 'qb'), fJ('to', 'Receiver', O, 'rec')) + fSeg('res', 'Result', [['good', 'Good'], ['miss', 'No good']]);
      return h + '<p class="hint">NFHS try is snapped from the 3-yard line. If the defense takes the ball, the try is over.</p>';
    }
    case 'pen': return flagFields(true);
    case 'to': return `<div class="tobtns">${['A', 'H'].map(s => `<button type="button" class="btn" data-timeout="${s}" ${st.to[s] ? '' : 'disabled'}>Timeout ${esc(ab(s))}<br><small class="num">${st.to[s]} left</small></button>`).join('')}</div>
      <p class="hint">NFHS: three timeouts per half, one per team in each overtime period. Recording a timeout stops the clock.</p>`;
    case 'note': return `<div class="fld"><label class="eyebrow" for="f-text">Note for the log</label><textarea class="inp" id="f-text" data-k="text" placeholder="Injury timeout, weather delay, measurement…">${esc(d.text)}</textarea></div>`;
  }
  return '';
}

function periodHtml(st){
  if (st.final || ui.editing != null) return '';
  const q = st.q, tie = st.score.A === st.score.H;
  let body;
  if (ui.ask === 'half') body = `<span class="eyebrow">Who kicks off to open the 2nd half?</span><div class="line">${['A', 'H'].map(s => `<button class="btn small" data-endq="${s}">${esc(ab(s))}${s === other(g.set.firstKick) ? ' (usual)' : ''}</button>`).join('')}<button class="linkbtn" data-ask="">Cancel</button></div>`;
  else if (ui.ask === 'ot') body = `<span class="eyebrow">Tied — who has the ball first in overtime?</span><div class="line">${['A', 'H'].map(s => `<button class="btn small" data-endq="${s}">${esc(ab(s))}</button>`).join('')}<button class="linkbtn" data-ask="">Cancel</button></div>`;
  else if (ui.ask === 'final') body = `<span class="eyebrow">End the game now, with the score as it stands?</span><div class="line"><button class="btn small danger" data-final>End game</button><button class="linkbtn" data-ask="">Cancel</button></div>`;
  else if (q > 4) body = `<p class="hint">Overtime ${q - 4}: each team gets a series from the ${rulesOf(g).ot}-yard line. If the defense takes the ball, it is dead and the series is over.</p><div class="line"><button class="linkbtn" data-ask="final">End game early</button></div>`;
  else body = `<div class="line"><button class="btn small" data-endq-ask>End of ${ord(q)} quarter</button><button class="linkbtn" data-ask="final">End game early</button></div>`;
  return `<div class="period">${body}</div>`;
}

// Before the first play, right where the kickoff gets recorded: the coin toss. The winner defers or receives, and
// that decides who kicks off (a winner who receives has the other team kick; one who defers kicks). The engine gives
// the other team the 2nd-half kickoff. Setup's "Opening kickoff by" stays as the plain way to set it.
const tossKicker = t => t && t.win && t.choice ? (t.choice === 'receive' ? other(t.win) : t.win) : null;
function openKickHtml(){
  if (g.plays.length || ui.editing != null || g.sample) return '';
  const t = g.set.toss || {}, k = g.set.firstKick || 'H', name = s => esc(g.teams[s].name || ab(s));
  const say = t.win && t.choice ? `${name(t.win)} ${t.choice === 'defer' ? 'deferred' : 'will receive'}: <b>${name(k)} kicks off</b>, and ${name(other(k))} kicks off the 2nd half.`
    : t.win ? `What did ${name(t.win)} choose?` : `Until the toss is in, ${name(k)} kicks off.`;
  return `<div class="openkick">
    <div class="ok-row"><span class="eyebrow">Coin toss winner</span><div class="seg">${['A', 'H'].map(s => `<button type="button" data-toss-win="${s}" aria-pressed="${t.win === s}">${name(s)}</button>`).join('')}</div></div>
    <div class="ok-row"><span class="eyebrow">Their choice</span><div class="seg">${[['defer', 'Defer'], ['receive', 'Receive']].map(([v, l]) => `<button type="button" data-toss-choice="${v}" aria-pressed="${t.choice === v}">${l}</button>`).join('')}</div></div>
    <p class="hint ok-say">${say}</p></div>`;
}

function renderPad(){
  if (ui.viewer) return;              // the live look-in is read-only
  if (g.box){ $('#pad').innerHTML = boxPad(); return; }   // entered from a box score: nothing to record
  const ctx = ui.ctx, st = ctx.st, pad = $('#pad');
  // While editing, the pad stays on that play's type even if earlier edits changed the situation.
  const types = ui.editing != null && !ui.ins ? [ui.type] : typesFor(st);
  if (!types.length){
    pad.innerHTML = `<div class="final-card"><span class="eyebrow">Final</span><b class="num">${esc(ab('A'))} ${st.score.A} · ${esc(ab('H'))} ${st.score.H}</b>
      <p class="hint">Everything is saved on this device. Export has the box score and play-by-play to copy.</p>
      <div class="line">${framed ? '' : '<button class="btn small primary" data-xlsx>Download Excel file</button>'}<button class="btn small" data-undo>Undo last to reopen</button></div></div>`;
    return;
  }
  const editing0 = ui.editing != null;
  const bar = !editing0 ? '' : `<div class="editing-bar"><span>${ui.ins ? `Adding a missed play before play ${ui.editing + 1}` : `Editing play ${ui.editing + 1}`}. Everything after it updates.</span><button class="linkbtn" data-cancel-edit>Cancel</button></div>`;
  if (editing0 && !ui.ins ? ui.qedit : ui.mode === 'quick'){
    pad.innerHTML = `${bar}
      ${openKickHtml()}<div class="pad-hd"><span class="eyebrow">${editing0 ? 'Situation before this play' : 'Next play'}</span><span class="sit">${esc(ctx.sit)}</span></div>
      ${quickHtml()}${editing0 && !ui.ins ? '' : '<button class="linkbtn" data-mode="form">Use the full form instead</button>'}${periodHtml(st)}`;
    return quickPreview();
  }
  if (!types.includes(ui.type)) ui.type = types[0];
  if (!ui.draft || ui.draft.t !== ui.type) ui.draft = blank(ui.type, st);
  const label = t => t === 'ko' && st.kickKind === 'free' ? 'Free kick' : TYPE_LABEL[t];
  const editing = ui.editing != null;
  const noRecord = ui.type === 'to';
  pad.innerHTML = `
    ${bar}
    ${openKickHtml()}
    <div class="pad-hd"><span class="eyebrow">${editing ? 'Situation before this play' : 'Next play'}</span><span class="sit">${esc(ctx.sit)}</span></div>
    <div class="types" role="group" aria-label="Play type">${types.map(t => `<button type="button" class="type" data-type="${t}" aria-pressed="${t === ui.type}" ${editing && !ui.ins && t !== ui.type ? 'disabled' : ''}>${label(t)}</button>`).join('')}</div>
    <div class="form">${formHtml()}${editing ? row(fN('clkTxt', 'Clock at the snap', '')) : ''}</div>
    ${noRecord ? '' : '<div class="preview" id="preview"></div>'}
    ${noRecord ? '' : `<div class="actions"><button class="btn primary" id="rec">${ui.ins ? 'Add play' : editing ? 'Save changes' : 'Record play'}</button>
      ${editing ? '<button class="btn" data-cancel-edit>Cancel</button>' : `<button class="btn" data-undo ${g.plays.length ? '' : 'disabled'}>Undo last</button>`}</div>`}
    ${editing && !ui.ins ? '' : '<button class="linkbtn" data-mode="quick">Back to quick entry</button>'}
    ${periodHtml(st)}`;
  updatePreview();
}

function updatePreview(){
  const el = $('#preview'); if (!el) return;
  const idx = ui.editing ?? g.plays.length;
  const r = replay({...g, plays:[...g.plays.slice(0, idx), buildPlay(ui.draft)]});
  const last = r.log[r.log.length - 1];
  el.innerHTML = last ? `<span class="eyebrow">Will read</span><div>${last.wiped ? `<s>${esc(last.wiped)}</s> ` : ''}${esc(last.text)}</div><div class="next">Then: ${esc(r.sit)}</div>` : '';
}
