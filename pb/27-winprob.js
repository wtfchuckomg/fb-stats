/* ================================================================
   Win Probability: after every play, an estimate of how often a team
   in that spot goes on to win. It combines the score margin with the
   time left, plus what having the ball is worth at that down and field
   position, and a small home edge that fades as the clock runs.
   Standard football numbers, tuned for high school: 48 minutes, and
   more big swings than college. Tap the chart to walk the game.
   ================================================================ */
// The chart is drawn for the width it actually gets (about 340 px, in the side column or on a phone),
// so its labels show at their real size: a 300-wide plot with room on the right for 100 / 50 / 100.
const WP = {sigma:18, hfa:2, cache:{}, W:300, H:170, top:8, vbW:334};
// Where the chart starts. A game doesn't open even: the site's own line (ratings.json, by way of ourLine)
// says who should win and by how much, and that expected margin carries the chart until the game itself has
// said enough to take over. With no line for these two schools, it falls back to the small home edge.
function wpPrior(x){
  const OL = typeof ourLine === 'function' && x && x.teams ? ourLine(x.teams.A.name, x.teams.H.name) : null;
  // Held to four touchdowns: past that the chart would open pinned to the top with nowhere to go, and a high
  // school game is too loose to claim more before anyone has played a down.
  return OL ? Math.max(-28, Math.min(28, OL.spread)) : WP.hfa;   // points, positive when the home team is favored
}
const wpErf = x => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
const wpPhi = z => 0.5 * (1 + wpErf(z / Math.SQRT2));
// Points the team with the ball can expect from here: about -0.5 backed up at its own goal, about 5.6 at the other.
const wpEP = (spot, FL, down) => (6.2 * Math.pow(Math.max(0, Math.min(1, spot / FL)), 1.2) - 0.5) * ({1:1, 2:0.95, 3:0.85, 4:0.6}[down] || 1);

// Seconds left in the quarter for each play. The clock a scorer types sticks until it's changed, so it's only a
// known time on the play where it changes (or the quarter's first play). Plays in between are spread evenly from
// that time to the next known one, or to the quarter's end; in a quarter still being played, about 25 seconds a play.
function wpClock(x, log, qSec, final){
  const n = log.length, est = new Array(n), known = new Array(n).fill(false);
  const raw = x.plays.map(p => typeof p.clk === 'number' ? p.clk : null);
  for (let i = 0; i < n; i++){
    const prev = i && log[i - 1].q === log[i].q ? raw[i - 1] : undefined;
    known[i] = raw[i] != null && raw[i] !== prev;
  }
  for (let i = 0; i < n;){
    let j = i; while (j < n && log[j].q === log[i].q) j++;          // this quarter is plays i .. j-1
    let lastT = qSec, lastK = i - 1;
    for (let k = i; k <= j; k++){
      if (k < j && !known[k]) continue;
      const open = k === j && j === n && !final;                     // the quarter being played now
      const t = Math.min(lastT, k < j ? raw[k] : open ? Math.max(0, lastT - 25 * (k - lastK)) : 0);
      for (let m = lastK + 1; m < k; m++) est[m] = lastT + (t - lastT) * (m - lastK) / (k - lastK);
      if (k < j){ est[k] = t; lastT = t; lastK = k; } else known.fill(false, lastK + 1, j);
    }
    i = j;
  }
  return {est, known};
}

// The visitors' chance after each play, with where that play falls on the game clock.
function wpSeries(x){
  const key = `${x.id}|${x.plays.length}|${x.updated || 0}|${typeof pre === 'object' && pre.rat ? 1 : 0}`;
  if (WP.cache[key]) return WP.cache[key];
  const RU = rulesOf(x), FL = RU.len, qSec = (x.set.qtr || 12) * 60, total = 4 * qSec;
  const prior = wpPrior(x);
  const full = replay(x), log = full.log, pts = [];
  const {est, known} = wpClock(x, log, qSec, full.st.final);
  log.forEach((e, i) => {
    const st = replay(x, i + 1).st, q = Math.min(e.q || 1, 5), c = est[i];
    const elapsed = q > 4 ? total + (qSec - c) * 0.25 : (q - 1) * qSec + (qSec - c);
    const remain = st.final ? 0 : q > 4 ? 30 : Math.max(0, total - elapsed);
    const t = remain / total, m = st.score.A - st.score.H;
    let v = 0;
    if (st.phase === 'try') v = st.poss === 'A' ? 0.95 : -0.95;                       // the extra point to come
    else if (st.phase === 'kick') v = (other(st.poss) === 'A' ? 1 : -1) * wpEP(0.3 * FL, FL, 1);   // the receiving team's drive
    else v = (st.poss === 'A' ? 1 : -1) * wpEP(st.spot, FL, st.down);
    const wa = st.final ? (m > 0 ? 1 : m < 0 ? 0 : 0.5) : wpPhi((m + v - prior * t) / (WP.sigma * Math.sqrt(Math.max(t, 0.0025))));
    pts.push({i, x:Math.min(elapsed / total, 1.08), wa, e, clk:known[i] ? x.plays[i].clk : null});
  });
  const start = {i:-1, x:0, wa:wpPhi(-prior / WP.sigma), e:null};   // the opening kickoff, before a play
  return (WP.cache[key] = [start, ...pts]);
}

// Games with enough plays to say anything, and never a game entered from a box score.
const wpShow = x => !!x && !x.box && x.plays.length > 3;
function cardWinProb(){
  const pts = wpSeries(g), T = g.teams, last = pts[pts.length - 1];
  const {W, H, top} = WP, mid = top + H / 2, maxX = Math.max(1, ...pts.map(p => p.x));
  const X = v => (v / maxX) * W, Y = wa => top + (1 - wa) * H;
  const line = pts.map((p, k) => `${k ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.wa).toFixed(1)}`).join('');
  const area = `${line}L${X(last.x).toFixed(1)},${mid}L0,${mid}Z`;
  const colA = T.A.color || '#4A4B4D', colH = T.H.color || '#3772DF';
  const qx = [1, 2, 3].map(q => X(q / 4));
  const pct = wa => `${(wa * 100).toFixed(1)}%`;
  const row = (s, wa) => `<div class="wp-team">${markFor(T[s], 30)}<span class="wp-ab">${esc(T[s].abbr || T[s].name)}</span><i class="wp-key" style="background:${s === 'A' ? colA : colH}"></i><b class="wp-pct" id="wp-${s}">${pct(wa)}</b></div>`;
  return `<section class="card wp-card"><div class="card-hd"><h2 class="card-title">Win Probability</h2></div>
    ${row('A', last.wa)}
    <div class="wp-chart"><svg viewBox="0 0 ${WP.vbW} ${H + top + 20}" role="img" aria-label="Win probability through the game">
      <defs><clipPath id="wp-top"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath><clipPath id="wp-bot"><rect x="0" y="${mid}" width="${W}" height="${H}"/></clipPath></defs>
      ${[0.25, 0.75].map(f => `<line x1="0" x2="${W}" y1="${top + f * H}" y2="${top + f * H}" class="wp-grid"/>`).join('')}
      ${qx.map(x => `<line x1="${x}" x2="${x}" y1="${top}" y2="${top + H}" class="wp-grid"/>`).join('')}
      <path d="${area}" fill="${colA}" fill-opacity=".22" clip-path="url(#wp-top)"/>
      <path d="${area}" fill="${colH}" fill-opacity=".22" clip-path="url(#wp-bot)"/>
      <line x1="0" x2="${W}" y1="${mid}" y2="${mid}" class="wp-mid"/>
      <path d="${line}" class="wp-line"/>
      <line id="wp-cur" x1="${X(last.x)}" x2="${X(last.x)}" y1="${top}" y2="${top + H}" class="wp-cur"/>
      <circle id="wp-dot" cx="${X(last.x)}" cy="${Y(last.wa)}" r="5" class="wp-dot"/>
      <text x="${W + 6}" y="${top + 4}" class="wp-ax">100</text><text x="${W + 6}" y="${mid + 4}" class="wp-ax">50</text><text x="${W + 6}" y="${top + H + 4}" class="wp-ax">100</text>
      ${['1st', '2nd', '3rd', '4th'].map((l, k) => `<text x="${X((k + 0.5) / 4)}" y="${top + H + 16}" text-anchor="middle" class="wp-ax">${l}</text>`).join('')}
      <rect id="wp-hit" x="0" y="0" width="${W}" height="${H + top}" fill="transparent"/>
    </svg></div>
    ${row('H', 1 - last.wa)}
    <div class="wp-play" id="wp-play">${wpPlayHtml(last)}</div>
    <p class="wp-note">An estimate from the score, clock, possession, down and field position. Tap the chart to see any play.</p></section>`;
}
function wpPlayHtml(p){
  if (!p.e) return '<div class="wp-sit">Kickoff</div>';
  const T = g.teams, e = p.e, clk = typeof p.clk === 'number' ? `${mmss(p.clk)} - ` : '';   // only a time the scorer actually set
  return `<div class="wp-sit">${esc(e.sit || '')}</div><div class="wp-sc"><b>${e.A}</b><b>${e.H}</b><span>${esc(ab('A'))}</span><span>${esc(ab('H'))}</span></div>
    <div class="wp-clk">${clk}${esc(perShort(e.q))}</div><p class="wp-txt">${esc(e.text || '')}</p>`;
}
// Tap or drag along the chart: the dot, the line and the play follow.
function wpBind(){
  const hit = $('#wp-hit'); if (!hit) return;
  const pts = wpSeries(g), maxX = Math.max(1, ...pts.map(p => p.x)), svg = hit.ownerSVGElement;
  const pick = ev => {
    const r = svg.getBoundingClientRect(), fx = ((ev.clientX - r.left) / r.width) * WP.vbW / WP.W;
    const want = Math.max(0, Math.min(1, fx)) * maxX;
    const p = pts.reduce((a, b) => Math.abs(b.x - want) < Math.abs(a.x - want) ? b : a);
    const x = (p.x / maxX) * WP.W, y = WP.top + (1 - p.wa) * WP.H;
    $('#wp-cur').setAttribute('x1', x); $('#wp-cur').setAttribute('x2', x);
    $('#wp-dot').setAttribute('cx', x); $('#wp-dot').setAttribute('cy', y);
    $('#wp-A').textContent = `${(p.wa * 100).toFixed(1)}%`; $('#wp-H').textContent = `${((1 - p.wa) * 100).toFixed(1)}%`;
    $('#wp-play').innerHTML = wpPlayHtml(p);
  };
  hit.addEventListener('pointerdown', pick); hit.addEventListener('pointermove', ev => { if (ev.buttons || ev.pointerType === 'mouse') pick(ev); });
}
