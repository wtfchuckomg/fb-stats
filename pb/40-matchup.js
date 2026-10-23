/* ================================================================
   Matchup calculator (?matchup): pick any two schools, and the site plays
   the game 1,000 times (Chuck, 2026-10-23: "simulate 1,000 games between
   the two teams and provide an outcome much like our game predictor").

   Each game starts from the pregame page's own line (gameLine: the ratings,
   the Media Rankings, past meetings) and adds what a real Friday night adds.
   The margin swings the way the predictor's win chance does (a logistic with
   the same WIN_SCALE, so a 1,000-game run lands on the ring's number), and
   the total swings about as much as our totals miss by. A tie goes to
   overtime. Neutral field takes home field out: the line both ways, averaged.
   ================================================================ */
const MATCHUP_PAGE = PAGE_Q.has('matchup');
const mu = {a:PAGE_Q.get('a') || '', h:PAGE_Q.get('h') || '', neutral:PAGE_Q.get('n') === '1', sim:null, rankFor:''};
const MU_GAMES = 1000;
// How far a total lands from the line's, one game to the next: our totals miss by about 13 points in 11-man,
// 15 in 8-man and 17 in 6-man on average (pb/30-pregame.js), which is a spread this wide.
const MU_TOTAL_SD = {'11-man':16, '8-man':18.5, '6-man':21};

function startMatchup(){
  ui.viewer = true; ui.matchup = true; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  document.title = `Matchup Calculator · ${SITE_TITLE}`;
  loadLogos(); loadRatings();
  renderMatchup();
  muTeamsChanged();
  viewerApi().then(api => scoresReady({fsM:api.fsM, fsdb:api.fsdb})).catch(() => {});   // the scores strip
  // The ratings and the school list arrive on their own; draw again once they're here.
  const wait = setInterval(() => { if (pre.rat && logoLib.list){ clearInterval(wait); muRun(); } }, 300);
}

// What a pick needs before its line is right: its past meetings, and its class's Media Rankings.
function muTeamsChanged(){
  [mu.a, mu.h].filter(Boolean).forEach(n => { loadHistory(n); loadMeetings(n); });
  const classes = [mu.a, mu.h].filter(Boolean).map(n => { const i = schoolInfo(n); return rankClassOf(n) || (i && RANK_CLASS[i[0]]); }).filter(Boolean);
  const want = classes.join('|');
  if (want && want !== mu.rankFor){
    mu.rankFor = want;
    loadRankings(classes).then(r => { pre.rank = r; muRun(); }).catch(() => {});
  }
}

// A seeded random number, so a run can be played again exactly; "Run again" draws a fresh seed.
function muRand(seed){
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function muSimulate(A, H, neutral, seed){
  const year = new Date().getFullYear(), L = gameLine(A, H, year); if (!L) return null;
  let m = L.home - L.away, total = L.total;
  if (neutral){ const B = gameLine(H, A, year); if (B){ m = (m - (B.home - B.away)) / 2; total = (total + B.total) / 2; } }
  const grp = ratingOf(H).group, sc = WIN_SCALE[grp] || 9, sd = MU_TOTAL_SD[grp] || 16, rnd = muRand(seed);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pHome = 1 / (1 + Math.exp(-m / sc));
  const out = {A, H, neutral, line:m, games:MU_GAMES, w:{A:0, H:0}, pts:{A:0, H:0}, mov:{A:0, H:0}, big:{A:null, H:null}, close:0, rout:0, ot:0, scores:new Map()};
  const pts = v => { v = Math.max(0, Math.round(v)); return v === 1 ? 0 : v; };   // nobody scores exactly one
  for (let i = 0; i < MU_GAMES; i++){
    const u = Math.min(1 - 1e-9, Math.max(1e-9, rnd()));
    const marg = m + sc * Math.log(u / (1 - u)), tot = Math.max(6, total + sd * gauss());
    let h = pts((tot + marg) / 2), a = pts((tot - marg) / 2);
    if (h === a){ out.ot++; if (rnd() < pHome) h += 7; else a += 7; }
    const win = h > a ? 'H' : 'A', by = Math.abs(h - a);
    out.w[win]++; out.pts.H += h; out.pts.A += a; out.mov[win] += by;
    if (by <= 8) out.close++;
    if (by >= 21) out.rout++;
    const b = out.big[win]; if (!b || by > b.by) out.big[win] = {by, h, a};
    const k = `${a}-${h}`; out.scores.set(k, (out.scores.get(k) || 0) + 1);
  }
  return out;
}

function muRun(fresh){
  if (!ui.matchup) return;
  if (mu.a && mu.h && pre.rat && canonSchool(mu.a) !== canonSchool(mu.h)){
    if (fresh || !mu.seed) mu.seed = fresh ? (Math.random() * 4294967296) >>> 0 : muSeedOf(mu.a, mu.h, mu.neutral);
    mu.sim = muSimulate(mu.a, mu.h, mu.neutral, mu.seed);
  } else mu.sim = null;
  renderMatchup();
}
// The first run for a pair is always the same one, so a shared link shows what the person sharing it saw.
const muSeedOf = (a, h, n) => [...`${canonSchool(a)}|${canonSchool(h)}|${n ? 1 : 0}`].reduce((s, c) => Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

function renderMatchup(){
  if (!ui.matchup) return;
  const box = $('#board'), keepFocus = document.activeElement && document.activeElement.classList.contains('sch-in') ? document.activeElement.id : null;
  const pick = (id, v, label) => schoolPicker(id, v, label).replace('class="inp sch-in"', 'class="inp sch-in" data-noadd="1"');
  const form = `<section class="bcard bhead"><div class="bhead-top"><h1>Matchup Calculator</h1></div>
    <div class="mu-form">
      <div class="fld"><label class="eyebrow" for="mu-a">Away</label>${pick('mu-a', mu.a, 'Away team')}</div>
      <div class="fld"><label class="eyebrow" for="mu-h">Home</label>${pick('mu-h', mu.h, 'Home team')}</div>
      <label class="mu-neutral"><input type="checkbox" id="mu-n"${mu.neutral ? ' checked' : ''}> Neutral field</label>
    </div></section>`;
  // Only the result card is drawn again while someone is typing in a box, so the box keeps its text and focus.
  const res = $('#mu-res');
  if (res && keepFocus) return void (res.innerHTML = muResult());
  box.innerHTML = form + `<div id="mu-res">${muResult()}</div>`;
}
function muResult(){
  const S = mu.sim;
  if (!mu.a || !mu.h) return '';
  if (canonSchool(mu.a) === canonSchool(mu.h)) return '<section class="bcard"><p class="bempty">Pick two different schools.</p></section>';
  if (!pre.rat) return '<section class="bcard"><p class="bempty">Loading…</p></section>';
  if (!S) return `<section class="bcard"><p class="bempty">${!ratingOf(mu.a) || !ratingOf(mu.h) ? 'No ratings for one of these schools yet.' : 'These two don’t play the same game (11-man, 8-man, 6-man).'}</p></section>`;
  const A = S.A, H = S.H, n = S.games, pA = S.w.A / n, pH = S.w.H / n;
  const ab = name => listAbbr(name) || shortName(name), mark = (name, size) => markFor({name, abbr:ab(name), color:'#4A4B4D'}, size);
  const R = 70, C = 2 * Math.PI * R;
  const ring = `<svg class="pg-ring" viewBox="0 0 180 180" role="img" aria-label="${esc(A)} ${(pA * 100).toFixed(1)} percent, ${esc(H)} ${(pH * 100).toFixed(1)} percent">
      <circle cx="90" cy="90" r="${R}" fill="none" stroke="#A5A6A7" stroke-width="16"/>
      <circle cx="90" cy="90" r="${R}" fill="none" stroke="#2B2C2D" stroke-width="16" stroke-dasharray="${(pA * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 90 90) scale(1 -1) translate(0 -180)"/>
    </svg>`;
  const avgA = S.pts.A / n, avgH = S.pts.H / n, fav = avgH >= avgA ? H : A, by = Math.abs(avgH - avgA);
  const movA = S.w.A ? S.mov.A / S.w.A : 0, movH = S.w.H ? S.mov.H / S.w.H : 0;
  const top = [...S.scores.entries()].sort((x, y) => y[1] - x[1])[0];
  const [ta, th] = top[0].split('-').map(Number);
  const pct = v => `${Math.round(v / n * 1000) / 10}%`;
  const row = (k, v) => `<div class="pg-info"><b>${k}</b><span>${v}</span></div>`;
  const big = s => { const b = S.big[s]; return b ? `${s === 'A' ? b.a : b.h}-${s === 'A' ? b.h : b.a}` : '—'; };
  return `<section class="bcard pg-card"><h2 class="pg-h">${n.toLocaleString()} games${S.neutral ? ' · neutral field' : ` · at ${esc(H)}`}</h2>
      <div class="pg-pred"><div class="pg-pct"><b>${(pA * 100).toFixed(1)}%</b><span>${esc(ab(A))}</span></div>
        <div class="pg-ringwrap">${ring}<div class="pg-marks">${mark(A, 34)}${mark(H, 34)}</div></div>
        <div class="pg-pct r"><b>${(pH * 100).toFixed(1)}%</b><span>${esc(ab(H))}</span></div></div>
      <div class="mu-avg"><span>${esc(A)} <b>${avgA.toFixed(1)}</b></span><span>${esc(H)} <b>${avgH.toFixed(1)}</b></span></div>
      <p class="mu-line">${by < .05 ? 'Dead even on average' : `${esc(fav)} by <b>${by.toFixed(1)}</b> on average`}</p>
    </section>
    <section class="bcard pg-card"><h2 class="pg-h">How the games went</h2>
      ${row(`${esc(A)} wins`, `${S.w.A.toLocaleString()} of ${n.toLocaleString()}${S.w.A ? `, by ${movA.toFixed(1)} on average` : ''}`)}
      ${row(`${esc(H)} wins`, `${S.w.H.toLocaleString()} of ${n.toLocaleString()}${S.w.H ? `, by ${movH.toFixed(1)} on average` : ''}`)}
      ${row('Most common score', `${esc(ta > th ? A : H)} ${Math.max(ta, th)}-${Math.min(ta, th)}`)}
      ${row('Decided by 8 or less', pct(S.close))}
      ${row('Won by 21 or more', pct(S.rout))}
      ${row('Overtime', pct(S.ot))}
      ${row(`Biggest ${esc(A)} win`, big('A'))}
      ${row(`Biggest ${esc(H)} win`, big('H'))}
      <div class="line" style="margin-top:12px"><button type="button" class="btn" data-mu-again>Run again</button></div>
    </section>`;
}

// A school picked in either box, the neutral box ticked, or Run again.
function muPicked(el){
  const v = el.value.trim();
  if (v && !knownSchool(v)) return;            // still typing, or a name we don't have
  const k = el.id === 'mu-a' ? 'a' : 'h';
  if (mu[k] === v) return;
  mu[k] = v; mu.seed = 0; muAddress(); muTeamsChanged(); muRun();
}
function muAddress(){
  const q = new URLSearchParams(); q.set('matchup', '');
  if (mu.a) q.set('a', mu.a); if (mu.h) q.set('h', mu.h); if (mu.neutral) q.set('n', '1');
  history.replaceState(null, '', `${location.pathname}?${q.toString().replace(/=(?=&|$)/g, '')}`);
}
document.addEventListener('input', e => { if (ui.matchup && (e.target.id === 'mu-a' || e.target.id === 'mu-h')) muPicked(e.target); });
document.addEventListener('change', e => {
  if (!ui.matchup) return;
  if (e.target.id === 'mu-n'){ mu.neutral = e.target.checked; mu.seed = 0; muAddress(); return muRun(); }
  if (e.target.id === 'mu-a' || e.target.id === 'mu-h') muPicked(e.target);
});
document.addEventListener('click', e => { if (ui.matchup && e.target.closest && e.target.closest('[data-mu-again]')) muRun(true); });
