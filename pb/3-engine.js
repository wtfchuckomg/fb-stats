/* ================================================================
   Engine. A game is its setup plus an ordered list of plays; every
   score, down, spot and stat is derived by replaying that list, so
   editing or deleting any play corrects everything after it.
   Positions are yards from the possessing team's own goal line.
   ================================================================ */
const NFHS = {kickFrom:40, safetyKickFrom:20, touchback:20, tryFrom:3, oobFreeKick:25, fgExtra:17};
const other = s => s === 'H' ? 'A' : 'H';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ord = n => n + (['th','st','nd','rd'][n] || 'th');
const fy = x => { const w = Math.floor(x), h = x - w >= .5; return h ? (w ? w + '½' : '½') : String(w); };

// NFHS penalty yardage. Only the four roughing fouls carry an automatic
// first down; illegal forward pass and intentional grounding lose the down.
const PENALTIES = [
  ['False start',5,'O'],['Encroachment',5,'D'],['Offside',5,'D'],['Delay of game',5,'E'],
  ['Illegal formation',5,'O'],['Illegal motion',5,'O'],['Illegal shift',5,'O'],['Illegal snap',5,'O'],
  ['Illegal substitution',5,'E'],['Too many players',5,'E'],['Ineligible downfield',5,'O'],
  ['Illegal forward pass',5,'O','l'],['Intentional grounding',5,'O','l'],['Running into the kicker',5,'D'],
  ['Free-kick infraction',5,'E'],['Invalid fair catch signal',5,'D'],
  ['Holding',10,'E'],['Illegal use of hands',10,'E'],['Illegal block in the back',10,'E'],
  ['Pass interference',15,'E'],['Kick-catch interference',15,'D'],['Facemask',15,'E'],['Horse-collar',15,'D'],
  ['Personal foul',15,'E'],['Unnecessary roughness',15,'E'],['Late hit',15,'E'],['Targeting',15,'E'],
  ['Clipping',15,'E'],['Chop block',15,'E'],['Illegal block below the waist',15,'E'],['Tripping',15,'E'],
  ['Head slap',15,'E'],['Illegal participation',15,'E'],['Unsportsmanlike conduct',15,'E'],
  ['Roughing the passer',15,'D','a'],['Roughing the kicker',15,'D','a'],
  ['Roughing the holder',15,'D','a'],['Roughing the snapper',15,'D','a'],['Other',5,'E']
].map(([name,y,s,f]) => ({name, y, s, a: f === 'a', l: f === 'l'}));

const TEAM_KEYS = 'fd fdR fdP fdX rushN rushY passC passA passY passTD passInt sk skY pen penY fum fumL pnt pntY pntTB pntBlk prN prY krN krY koN koY koTB intN intY d3a d3m d4a d4m plays top'.split(' ');
const PL_KEYS = 'pc pa py ptd pint plg psk pskY ru ry rtd rlg re rey retd relg tk ast tfl sk dint dintY fr ff pbu bk fum fgm fga fglg xpm xpa ko koy ktb pu puy pulg pi20 ptb kr kry krtd krlg pr pry prtd prlg tds two pts'.split(' ');
const zeros = keys => Object.fromEntries(keys.map(k => [k, 0]));

// 11-man plays NFHS on a 100-yard field. Kansas 8-man plays an 80-yard field
// (midfield at the 40) with its own kickoff and touchback spots. Any spot can be
// changed per game in Setup.
const FORMATS = {
  11: {len:100, kickFrom:40, tb:20, safety:20, ot:10},
  8:  {len:80,  kickFrom:30, tb:15, safety:15, ot:10}
};
/* A roster line can carry the player's class: "7 Cole Brandt SR". The number and the name are what the game runs
   on, so the class is split off here — otherwise a play reads "#3 SR rush for 3 yards", the last word of the name
   being taken for a surname. It is shown wherever a player is listed by name (box score, leaders, stats). */
const CLASS_WORD = {sr:'SR', jr:'JR', so:'SO', fr:'FR', sen:'SR', senior:'SR', jun:'JR', junior:'JR', soph:'SO', sophomore:'SO', fresh:'FR', freshman:'FR', 9:'FR', 10:'SO', 11:'JR', 12:'SR'};
function splitClass(s){
  // A second jersey number sometimes rides along ("35 /50 Nathan Miller"): the roster keeps the first.
  const full = String(s || '').replace(/^[\/,&]?\s*\d{1,2}\s+(?=\D)/, '').trim();
  const m = full.match(/\s+([A-Za-z]{2,9}|9|1[0-2])\.?$/);
  const yr = m && CLASS_WORD[m[1].toLowerCase()];
  return yr ? {name:full.slice(0, m.index).trim(), yr} : {name:full, yr:''};
}
const playerName = s => splitClass(s).name;

function rulesOf(game){
  const s = (game && game.set) || {}, men = +s.men === 8 ? 8 : 11, f = FORMATS[men];
  const num = (v, d) => +v > 0 ? +v : d;
  return {men, len:f.len, kickFrom:num(s.kickFrom, f.kickFrom), tb:num(s.tb, f.tb), safety:num(s.safety, f.safety), ot:num(s.ot, f.ot)};
}

// A line score the scorer typed in (the Line score window) in place of what the plays added up to: each quarter's
// points, or null for a quarter that was never played — an 8-man game stopped by the 45-point rule, say — which
// shows an X. The total follows the numbers typed.
function applyLines(L, st){
  const num = v => v == null || v === '' ? null : (+v || 0);
  let last = 0;
  ['A', 'H'].forEach(s => {
    const row = (L[s] || []).slice(0, 5).map(num);
    while (row.length < 5) row.push(null);
    st.lines[s] = row;
    st.score[s] = row.reduce((a, v) => a + (v || 0), 0);
    row.forEach((v, i) => { if (v != null && i + 1 > last) last = i + 1; });
  });
  st.qPlayed = last;
  st.typed = true;   // show these numbers as typed, even in a quarter the clock hasn't reached
}

function replay(g, upto = g.plays.length){
  const RU = rulesOf(g), FL = RU.len, HALF = FL / 2;
  const T = g.teams, qSec = (g.set.qtr || 12) * 60, otSpot = FL - RU.ot;
  let st = {q:1, phase:'kick', kickKind:'kickoff', poss:g.set.firstKick || 'H', kickFrom:RU.kickFrom,
    spot:0, down:1, ltg:10, score:{A:0,H:0}, lines:{A:[0,0,0,0,0],H:[0,0,0,0,0]}, to:{A:3,H:3},
    ot:null, final:false, drive:null, fresh:false, qPlayed:0, typed:false};
  let S = {team:{A:zeros(TEAM_KEYS), H:zeros(TEAM_KEYS)}, pl:{A:{}, H:{}}};
  let scoring = [], drives = [], clk = null, tags = [], trace = [], curI = 0;   // curI: the play being replayed
  const log = [];

  const ab = s => T[s].abbr || s;
  const nm = (s, n) => {
    if (n === '' || n == null) return ab(s);
    if (n === 'team') return 'TEAM';
    const who = playerName((T[s].roster || {})[n]);
    return who ? `#${n} ${who.split(' ').slice(-1)[0]}` : `#${n}`;
  };
  const yl = (s, pos) => { pos = clamp(pos, 0, FL); if (pos === HALF) return String(HALF);
    return pos < HALF ? `${ab(s)} ${fy(pos)}` : `${ab(other(s))} ${fy(FL - pos)}`; };
  const yds = g => g > 0 ? `for ${fy(g)} yard${g === 1 ? '' : 's'}` : g < 0 ? `for a loss of ${fy(-g)}` : 'for no gain';
  const plural = (n, w) => `${fy(n)} ${w}${n === 1 ? '' : 's'}`;
  const pl = (s, n) => {
    if (n === '' || n == null) return null;
    const k = String(n);
    return S.pl[s][k] || (S.pl[s][k] = Object.assign({n:k}, zeros(PL_KEYS)));
  };
  const bump = (o, k, v = 1) => { if (o) o[k] += v; };
  const long = (o, k, v) => { if (o && v > o[k]) o[k] = v; };
  const list = a => (a || []).filter(x => x !== '' && x != null);
  // The ball's path on this play, for the field drawing: legs along the ground ('run') or in the air ('pass',
  // 'kick'), from and to in team s's frame, kept in yards from the visitors' goal. x marks a pass or kick that failed.
  const leg = (k, s, from, to, x = false) => {
    const out = k === 'run' ? 3 : 9;   // a runner stops just over the goal line; a kick carries to the posts
    const f = v => { v = clamp(v, -out, FL + out); return s === 'A' ? v : FL - v; };
    trace.push({k, s, a:f(from), b:f(to), x});
  };
  const tackleTxt = (s, a) => { a = list(a); return a.length ? ` (${a.map(n => nm(s, n)).join(', ')})` : ''; };
  function tackles(s, a, gain){
    a = list(a);
    a.forEach(n => { const p = pl(s, n); if (a.length === 1) p.tk++; else p.ast++; if (gain < 0) p.tfl += 1 / a.length; });
  }

  function sit(){
    if (st.final) return 'Final';
    if (st.phase === 'kick') return `${st.kickKind === 'free' ? 'Free kick' : 'Kickoff'} · ${ab(st.poss)} from the ${yl(st.poss, st.kickFrom)}`;
    if (st.phase === 'try') return `Try · ${ab(st.poss)} at the ${yl(st.poss, st.spot)}`;
    return `${ab(st.poss)} · ${ord(st.down)} & ${st.ltg >= FL ? 'Goal' : fy(st.ltg - st.spot)} at ${yl(st.poss, st.spot)}`;
  }

  /* ---- series, possession, drives ---- */
  function newSeries(s, spot){
    st.poss = s; st.spot = spot; st.down = 1; st.ltg = Math.min(FL, spot + 10); st.phase = 'play'; st.fresh = true;
  }
  function kickoffBy(s, kind = 'kickoff'){
    st.phase = 'kick'; st.poss = s; st.kickKind = kind;
    st.kickFrom = kind === 'free' ? RU.safety : RU.kickFrom;
  }
  function driveTouch(){
    if (!st.drive || st.drive.team !== st.poss){
      closeDrive();
      st.drive = {team:st.poss, q:st.q, clk, start:st.spot, plays:0, last:st.spot, res:'', i0:curI};
    }
    st.drive.plays++;
  }
  function closeDrive(res, last){
    const d = st.drive; if (!d) return;
    if (last != null) d.last = last;
    d.res = res || d.res || '—'; d.endQ = st.q; d.endClk = clk; d.i1 = curI;
    if (d.clk != null && d.endClk != null && d.q <= 4 && d.endQ <= 4){
      d.time = Math.max(0, (d.endQ - d.q) * qSec + d.clk - d.endClk);
      S.team[d.team].top += d.time;
    }
    drives.push(d); st.drive = null;
  }
  function endGame(){ closeDrive(st.q > 4 ? 'End of OT' : 'End of game'); st.final = true; st.phase = 'final'; }

  /* ---- overtime (NFHS tiebreaker, Kansas plan: 10-yard line) ---- */
  function otSeries(s){ st.ot.cur = s; newSeries(s, otSpot); st.ltg = Math.min(FL, otSpot + 10); }
  function otEnd(){
    const o = st.ot; o.done[o.cur] = true;
    if (o.done.A && o.done.H){
      if (st.score.A !== st.score.H) return endGame();
      o.n++; st.q = 4 + o.n; o.first = other(o.first); o.done = {A:false, H:false}; st.to = {A:1, H:1};
      return otSeries(o.first);
    }
    otSeries(other(o.cur));
  }

  /* ---- scoring ---- */
  function score(s, pts, how, desc){
    // Every overtime gets its own column: 1-4 are the quarters, 5 is OT, 6 is 2OT, and so on for as long as it goes.
    st.score[s] += pts;
    const qi = st.q - 1;
    ['A', 'H'].forEach(t => { while (st.lines[t].length <= qi) st.lines[t].push(0); });
    st.lines[s][qi] += pts;
    tags.push(['score', `${ab('A')} ${st.score.A} – ${ab('H')} ${st.score.H}`]);
    if (how === 'try'){
      const last = scoring[scoring.length - 1];
      if (last){ last.A = st.score.A; last.H = st.score.H; }
      return;
    }
    scoring.push({q:st.q, clk, side:s, how, desc, A:st.score.A, H:st.score.H, i:curI});
  }
  function amendTry(txt){ const last = scoring[scoring.length - 1]; if (last && last.how === 'TD') last.desc += ` (${txt})`; }
  function touchdown(s, desc, scorer){
    if (st.drive && st.drive.team === s) closeDrive('TD', FL); else closeDrive();
    if (scorer){ scorer.tds++; scorer.pts += 6; }
    score(s, 6, 'TD', desc);
    // A second overtime team that goes ahead wins without a try.
    if (st.ot && st.ot.done[other(s)] && st.score[s] > st.score[other(s)]) { st.ot.done[s] = true; endGame(); return ' TOUCHDOWN. Game over.'; }
    st.phase = 'try'; st.poss = s; st.spot = FL - NFHS.tryFrom; st.down = 1; st.ltg = FL;
    return ' TOUCHDOWN.';
  }
  function safety(defense){
    closeDrive('Safety', 0);
    score(defense, 2, 'Safety', `Safety`);
    if (st.ot) otEnd(); else kickoffBy(other(defense), 'free');
    return ' SAFETY.';
  }
  function afterTry(){ if (st.ot) otEnd(); else kickoffBy(st.poss); }

  // Offense keeps the ball and reaches `end`: touchdown, safety, first down, next down or turnover on downs.
  function progress(end, fdKind, tdDesc, scorer){
    const O = st.poss, D = other(O), t = S.team[O];
    if (end >= FL){ if (fdKind){ t.fd++; t['fd' + fdKind]++; } return touchdown(O, tdDesc, scorer); }
    if (end <= 0) return safety(D);
    if (end >= st.ltg){
      if (fdKind){ t.fd++; t['fd' + fdKind]++; }
      newSeries(O, end); tags.push(['fd', '1st down']); return ' First down.';
    }
    if (st.down >= 4){
      closeDrive('Downs', end); tags.push(['to', 'Downs']);
      if (st.ot) otEnd(); else newSeries(D, FL - end);
      return ' Turnover on downs.';
    }
    st.down++; st.spot = end; return '';
  }
  function conversion(end){
    const t = S.team[st.poss], made = end >= st.ltg;
    if (st.down === 3){ t.d3a++; if (made) t.d3m++; }
    if (st.down === 4){ t.d4a++; if (made) t.d4m++; }
  }

  // Carrier side `cs` loses a fumble at `pos` (cs frame).
  function fumbleLost(cs, cn, pos, f){
    const rs = other(cs);
    bump(pl(cs, cn), 'fum'); S.team[cs].fum++; S.team[cs].fumL++;
    bump(pl(rs, f.by), 'fr'); if (f.ff) bump(pl(rs, f.ff), 'ff');
    tags.push(['to', 'Fumble']);
    let txt = ` FUMBLE${f.ff ? ` forced by ${nm(rs, f.ff)}` : ''}, recovered by ${f.by ? nm(rs, f.by) : ab(rs)} at the ${yl(cs, pos)}`;
    if (st.drive && st.drive.team === cs) closeDrive('Fumble', pos);
    if (st.ot) { otEnd(); return txt + ' (ball dead).'; }
    const ry = +f.ry || 0, fin = FL - pos + ry;
    if (ry) leg('run', rs, FL - pos, fin);
    if (ry) txt += ry > 0 ? `, returned ${plural(ry, 'yard')}` : `, lost ${plural(-ry, 'yard')}`;
    if (fin >= FL) return txt + '.' + touchdown(rs, `${f.by ? nm(rs, f.by) : ab(rs)} fumble return`, pl(rs, f.by));
    if (fin <= 0){ newSeries(rs, RU.tb); return txt + '. Touchback.'; }
    newSeries(rs, fin); return txt + '.';
  }
  // The offense gets its own fumble back; a teammate's advance moves the ball but isn't the carrier's yardage.
  function fumbleKept(cs, cn, f, end){
    bump(pl(cs, cn), 'fum'); S.team[cs].fum++;
    const adv = end != null ? +f.ry || 0 : 0;
    if (adv) leg('run', cs, end, clamp(end + adv, 0, FL));
    return ` Fumble, recovered by ${f.by ? nm(cs, f.by) : ab(cs)}${adv ? `, ${adv > 0 ? 'advanced ' + plural(adv, 'yard') : 'lost ' + plural(-adv, 'yard')} to the ${yl(cs, clamp(end + adv, 0, FL))}` : ''}.`;
  }

  /* ---- penalties ---- */
  function enforce(pen){
    const off = pen.side === st.poss;
    let y = +pen.y || 0;
    const base = st.phase === 'kick' ? 'kickFrom' : 'spot';
    const room = off ? st[base] : FL - st[base];
    if (y > room / 2) y = room / 2;          // half the distance to the offender's goal
    st[base] += off ? -y : y;
    return y;
  }
  function penalize(pen, seriesNew){
    const side = pen.side, offFoul = side === st.poss;
    const from = st.phase === 'kick' ? st.kickFrom : st.spot;
    const full = +pen.y || 0, y = enforce(pen);
    S.team[side].pen++; S.team[side].penY += y;
    tags.push(['flag', 'Flag']);
    let txt = `PENALTY ${ab(side)} ${pen.name}${pen.n ? ` (${nm(side, pen.n)})` : ''}, ${plural(y, 'yard')}${y < full ? ' (half the distance)' : ''}`;
    if (st.phase === 'kick') return txt + `. Kick from the ${yl(st.poss, st.kickFrom)}.`;
    if (st.phase === 'try') return txt + `. Try from the ${yl(st.poss, st.spot)}.`;
    if (st.phase !== 'play') return txt + '.';
    txt += `, from the ${yl(st.poss, from)}`;
    if (seriesNew){ newSeries(st.poss, st.spot); return txt + '.'; }
    if (!offFoul && (pen.a || st.spot >= st.ltg)){
      S.team[st.poss].fd++; S.team[st.poss].fdX++;
      newSeries(st.poss, st.spot); tags.push(['fd', '1st down']);
      return txt + `${pen.a ? ', automatic first down' : ''}. First down.`;
    }
    if (offFoul && pen.l){
      txt += ', loss of down';
      if (st.down >= 4){
        closeDrive('Downs', st.spot); tags.push(['to', 'Downs']);
        if (st.ot) otEnd(); else newSeries(other(st.poss), FL - st.spot);
        return txt + '. Turnover on downs.';
      }
      st.down++;
    }
    return txt + '.';
  }

  /* ---- plays ---- */
  function run(p){
    const O = st.poss, D = other(O), t = S.team[O], r = pl(O, p.r);
    const g = clamp(+p.y || 0, -st.spot, FL - st.spot), end = st.spot + g, td = end >= FL;
    leg('run', O, st.spot, end);
    if (st.phase === 'try') return twoPoint(p, end >= FL, `${nm(O, p.r)} rush`);
    driveTouch(); t.plays++;
    t.rushN++; t.rushY += g; bump(r, 'ru'); bump(r, 'ry', g); long(r, 'rlg', g);
    tackles(D, p.tk, g); conversion(end);
    let txt = td ? `${nm(O, p.r)} ${fy(g)}-yard rush` : `${nm(O, p.r)} rush ${yds(g)} to the ${yl(O, end)}${tackleTxt(D, p.tk)}.`;
    if (p.fum){
      if (p.fum.lost) return txt + fumbleLost(O, p.r, end, p.fum);
      txt += fumbleKept(O, p.r, p.fum, end);
      if (+p.fum.ry) return txt + progress(clamp(end + +p.fum.ry, 0, FL), 'R');
    }
    if (td){ bump(r, 'rtd'); return txt + '.' + progress(end, 'R', `${nm(O, p.r)} ${fy(g)}-yard run`, r); }
    return txt + progress(end, 'R');
  }

  function pass(p){
    const O = st.poss, D = other(O), t = S.team[O], qb = pl(O, p.qb);
    if (st.phase === 'try'){
      const g = p.res === 'c' ? +p.y || 0 : -1;
      leg('pass', O, st.spot, p.res === 'c' ? st.spot + (g || FL - st.spot + 2) : FL + 3, p.res !== 'c');
      return twoPoint(p, p.res === 'c' && st.spot + g >= FL, `${nm(O, p.qb)} pass to ${nm(O, p.to)}`);
    }
    driveTouch(); t.plays++;
    if (p.res === 's'){
      const g = -clamp(+p.sy || 0, 0, st.spot), end = st.spot + g, by = list(p.by);
      leg('run', O, st.spot, end);
      t.sk++; t.skY -= g; t.rushN++; t.rushY += g;
      bump(qb, 'psk'); bump(qb, 'pskY', -g); bump(qb, 'ru'); bump(qb, 'ry', g);
      by.forEach(n => { const d = pl(D, n); d.sk += 1 / by.length; });
      tackles(D, by, g); conversion(end);
      let txt = `${nm(O, p.qb)} sacked${by.length ? ` by ${by.map(n => nm(D, n)).join(' and ')}` : ''} ${yds(g)} to the ${yl(O, end)}.`;
      if (p.fum){ if (p.fum.lost) return txt + fumbleLost(O, p.qb, end, p.fum); txt += fumbleKept(O, p.qb, p.fum, end); if (+p.fum.ry) return txt + progress(clamp(end + +p.fum.ry, 0, FL), null); }
      return txt + progress(end, null);
    }
    t.passA++; bump(qb, 'pa');
    if (p.res === 'i'){
      conversion(st.spot);
      leg('pass', O, st.spot, Math.min(st.spot + 10, FL + 5), true);   // an incompletion keeps no landing spot
      if (p.pbu) bump(pl(D, p.pbu), 'pbu');
      return `${nm(O, p.qb)} pass incomplete${p.to ? `, intended for ${nm(O, p.to)}` : ''}${p.pbu ? ` (broken up by ${nm(D, p.pbu)})` : ''}.` + progress(st.spot, null);
    }
    if (p.res === 'x'){
      conversion(st.spot);
      t.passInt++; bump(qb, 'pint');
      const dp = pl(D, p.ib), at = clamp(st.spot + (+p.at || 0), 0, (FL + 10)), ry = st.ot ? 0 : (+p.ry || 0);
      leg('pass', O, st.spot, at);
      bump(dp, 'dint'); bump(dp, 'dintY', ry); S.team[D].intN++; S.team[D].intY += ry;
      tags.push(['to', 'INT']);
      let txt = `${nm(O, p.qb)} pass intercepted by ${p.ib ? nm(D, p.ib) : ab(D)} at the ${at >= FL ? `${ab(D)} end zone` : yl(O, at)}`;
      closeDrive('INT', st.spot);
      if (st.ot){ otEnd(); return txt + ' (ball dead).'; }
      const fin = FL - at + ry;
      if (ry) leg('run', D, FL - at, fin);
      if (ry) txt += `, returned ${plural(ry, 'yard')}`;
      if (fin >= FL) return txt + '.' + touchdown(D, `${p.ib ? nm(D, p.ib) : ab(D)} interception return`, dp);
      if (fin <= 0){ newSeries(D, RU.tb); return txt + '. Touchback.'; }
      newSeries(D, fin); return txt + (ry ? ` to the ${yl(D, fin)}.` : '.');
    }
    // complete
    const rec = pl(O, p.to), g = clamp(+p.y || 0, -st.spot, FL - st.spot), end = st.spot + g, td = end >= FL;
    leg('pass', O, st.spot, end);
    t.passC++; t.passY += g; bump(qb, 'pc'); bump(qb, 'py', g); long(qb, 'plg', g);
    bump(rec, 're'); bump(rec, 'rey', g); long(rec, 'relg', g);
    tackles(D, p.tk, g); conversion(end);
    let txt = td ? `${nm(O, p.qb)} ${fy(g)}-yard pass to ${nm(O, p.to)}`
                 : `${nm(O, p.qb)} pass complete to ${nm(O, p.to)} ${yds(g)} to the ${yl(O, end)}${tackleTxt(D, p.tk)}.`;
    if (p.fum){ if (p.fum.lost) return txt + fumbleLost(O, p.to, end, p.fum); txt += fumbleKept(O, p.to, p.fum, end); if (+p.fum.ry) return txt + progress(clamp(end + +p.fum.ry, 0, FL), 'P'); }
    if (td){ t.passTD++; bump(qb, 'ptd'); bump(rec, 'retd');
      return txt + '.' + progress(end, 'P', `${nm(O, p.to)} ${fy(g)}-yard pass from ${nm(O, p.qb)}`, rec); }
    return txt + progress(end, 'P');
  }

  // A kicked ball the receiving team R fields at `at` (R frame) and returns.
  function kickReturn(R, kind, p, at){
    const K = other(R), ret = pl(R, p.ret), ry = +p.ry || 0, fin = at + ry;
    if (ry) leg('run', R, at, fin);
    const k1 = kind === 'kr' ? 'kr' : 'pr';
    bump(ret, k1); bump(ret, k1 + 'y', ry); long(ret, k1 + 'lg', ry);
    S.team[R][k1 === 'kr' ? 'krN' : 'prN']++; S.team[R][k1 === 'kr' ? 'krY' : 'prY'] += ry;
    tackles(K, p.tk, 1);
    let txt = `, ${nm(R, p.ret)} returns ${plural(ry, 'yard')}`;
    if (p.fum && p.fum.lost) return {txt: txt + fumbleLost(R, p.ret, clamp(fin, 1, (FL - 1)), p.fum), fin};
    if (fin >= FL){ bump(ret, k1 + 'td'); return {txt: txt + '.' + touchdown(R, `${nm(R, p.ret)} ${fy(ry)}-yard ${kind === 'kr' ? 'kickoff' : 'punt'} return`, ret), fin}; }
    if (fin <= 0){ newSeries(R, RU.tb); return {txt: txt + ', downed in the end zone. Touchback.', fin:RU.tb}; }
    if (p.fum) txt += `,${fumbleKept(R, p.ret, p.fum).slice(1, -1)}`;
    newSeries(R, fin); return {txt: txt + ` to the ${yl(R, fin)}${tackleTxt(K, p.tk)}.`, fin};
  }

  function kickoff(p){
    const K = st.poss, R = other(K), kf = st.kickFrom, k = pl(K, p.k), tk = S.team[K];
    // A kickoff typed with no distance ("ko") takes it from the spot typed next.
    const unknown = p.d == null && !['tb', 'oob', 'onside'].includes(p.res);
    let d = +p.d || 0;
    if (p.res === 'tb' && !d) d = FL - kf;
    bump(k, 'ko'); tk.koN++;
    if (!unknown && p.res !== 'oob'){ bump(k, 'koy', d); tk.koY += d; }
    const what = st.kickKind === 'free' ? 'free kick' : 'kickoff';
    let txt = unknown || (p.res === 'oob' && !p.d) ? `${nm(K, p.k)} ${what}` : `${nm(K, p.k)} ${what} ${plural(d, 'yard')}`;
    if (p.bs != null){ newSeries(R, clamp(+p.bs, 1, (FL - 1))); leg('kick', K, kf, FL - st.spot); return `${nm(K, p.k)} ${what}. ${ab(R)} ball at the ${yl(R, st.spot)}.`; }
    if (unknown){ newSeries(R, FL - kf); return txt + '.'; }
    if (p.res === 'onside') leg('run', K, kf, kf + d);
    else if (p.res === 'tb') leg('kick', K, kf, Math.max(kf + d, FL + 5));
    else if (p.res !== 'oob' || p.d) leg('kick', K, kf, kf + d);
    const at = FL - (kf + d);
    switch (p.res){
      case 'spot': {
        const s = at <= 0 ? RU.tb : at; newSeries(R, s);
        return txt + (at <= 0 ? ', into the end zone. Touchback.' : ` to the ${yl(R, s)}.`);
      }
      case 'tb': bump(k, 'ktb'); tk.koTB++; newSeries(R, RU.tb); return txt + `, touchback. ${ab(R)} ball at the ${yl(R, RU.tb)}.`;
      case 'oob': { const s = FL - (kf + NFHS.oobFreeKick); newSeries(R, s); return txt + `, out of bounds. ${ab(R)} ball at the ${yl(R, s)}.`; }
      case 'onside': { const s = kf + d; bump(pl(K, p.ret), 'fr'); newSeries(K, s); tags.push(['to', 'Onside']);
        return txt + `, onside, recovered by ${p.ret ? nm(K, p.ret) : ab(K)} at the ${yl(K, s)}.`; }
      case 'fc': case 'down': {
        const s = at <= 0 ? RU.tb : at; newSeries(R, s);
        return txt + (at <= 0 ? ', downed in the end zone. Touchback.' : p.res === 'fc' ? `, fair catch by ${nm(R, p.ret)} at the ${yl(R, s)}.` : `, downed at the ${yl(R, s)}.`);
      }
      default: return txt + ` to the ${at <= 0 ? `${ab(R)} end zone` : yl(R, at)}` + kickReturn(R, 'kr', p, at).txt;
    }
  }

  function punt(p){
    const O = st.poss, R = other(O), t = S.team[O], k = pl(O, p.k);
    driveTouch(); t.plays++; t.pnt++; bump(k, 'pu');
    closeDrive('Punt', st.spot);
    if (p.res === 'blk'){
      t.pntBlk++; bump(pl(R, p.by), 'bk'); tags.push(['to', 'Blocked']);
      const at = clamp(FL - (st.spot - (+p.b || 0)), 1, FL), ry = +p.ry || 0, fin = at + ry;
      if (ry) leg('run', R, at, fin);
      let txt = `${nm(O, p.k)} punt BLOCKED${p.by ? ` by ${nm(R, p.by)}` : ''}, recovered by ${p.ret ? nm(R, p.ret) : ab(R)} at the ${yl(R, at)}`;
      if (ry) txt += `, returned ${plural(ry, 'yard')}`;
      if (fin >= FL) return txt + '.' + touchdown(R, `${p.ret ? nm(R, p.ret) : ab(R)} blocked punt return`, pl(R, p.ret));
      newSeries(R, fin); return txt + '.';
    }
    const unknown = p.d == null && p.res !== 'tb';
    let d = +p.d || 0;
    if (p.res === 'tb') d = FL - st.spot;
    if (unknown){ newSeries(R, FL - st.spot); return `${nm(O, p.k)} punt.`; }
    bump(k, 'puy', d); long(k, 'pulg', d); t.pntY += d;
    const at = FL - (st.spot + d);
    leg('kick', O, st.spot, p.res === 'tb' || at <= 0 ? Math.max(st.spot + d, FL + 5) : st.spot + d);
    let txt = `${nm(O, p.k)} punt ${plural(d, 'yard')}`;
    if (p.res === 'tb' || at <= 0){ bump(k, 'ptb'); t.pntTB++; newSeries(R, RU.tb); return txt + `, touchback. ${ab(R)} ball at the ${yl(R, RU.tb)}.`; }
    if (p.res === 'ret'){
      const r = kickReturn(R, 'pr', p, at);
      if (r.fin < 20) bump(k, 'pi20');
      return txt + ` to the ${yl(R, at)}` + r.txt;
    }
    if (at < 20) bump(k, 'pi20');
    newSeries(R, at);
    return txt + ` to the ${yl(R, at)}` + ({fc:`, fair catch by ${nm(R, p.ret)}.`, down:', downed.', oob:', out of bounds.'}[p.res] || '.');
  }

  function fieldGoal(p){
    const O = st.poss, D = other(O), t = S.team[O], k = pl(O, p.k);
    const dist = +p.d || Math.round(FL - st.spot + NFHS.fgExtra);
    driveTouch(); t.plays++; bump(k, 'fga');
    if (p.res !== 'blk') leg('kick', O, st.spot - 7, FL + 9, p.res !== 'good');   // held 7 yards back, to the posts on the end line
    if (p.res === 'good'){
      bump(k, 'fgm'); long(k, 'fglg', dist); if (k) k.pts += 3;
      closeDrive('FG', st.spot);
      score(O, 3, 'FG', `${nm(O, p.k)} ${dist}-yard field goal`);
      if (st.ot) otEnd(); else kickoffBy(O);
      return `${nm(O, p.k)} ${dist}-yard field goal is GOOD.`;
    }
    if (p.res === 'blk'){
      bump(pl(D, p.by), 'bk'); tags.push(['to', 'Blocked']);
      closeDrive('Blocked FG', st.spot);
      let txt = `${nm(O, p.k)} ${dist}-yard field goal BLOCKED${p.by ? ` by ${nm(D, p.by)}` : ''}`;
      if (st.ot){ otEnd(); return txt + '.'; }
      const at = clamp(FL - (st.spot - (+p.b || 0)), 1, FL), ry = +p.ry || 0, fin = at + ry;
      if (ry) leg('run', D, at, fin);
      txt += `, recovered by ${p.ret ? nm(D, p.ret) : ab(D)} at the ${yl(D, at)}`;
      if (ry) txt += `, returned ${plural(ry, 'yard')}`;
      if (fin >= FL) return txt + '.' + touchdown(D, `${p.ret ? nm(D, p.ret) : ab(D)} blocked field goal return`, pl(D, p.ret));
      newSeries(D, fin); return txt + '.';
    }
    closeDrive('Missed FG', st.spot);
    if (st.ot){ otEnd(); return `${nm(O, p.k)} ${dist}-yard field goal is NO GOOD.`; }
    // NFHS: a missed field goal into the end zone is a touchback — no "spot of the kick" rule.
    newSeries(D, RU.tb);
    return `${nm(O, p.k)} ${dist}-yard field goal is NO GOOD. Touchback, ${ab(D)} ball at the ${yl(D, RU.tb)}.`;
  }

  function twoPoint(p, good, what){
    const O = st.poss, scorer = pl(O, p.res === 'c' ? p.to : p.r);
    if (good){ bump(scorer, 'two'); bump(scorer, 'pts', 2); score(O, 2, 'try'); amendTry(what); }
    else amendTry(`${p.t === 'pass' ? 'pass' : 'run'} failed`);
    const txt = `Two-point try: ${what} is ${good ? 'GOOD' : 'NO GOOD'}.`;
    afterTry(); return txt;
  }
  function tryPlay(p){
    const O = st.poss;
    if (p.kind === 'kick'){
      const k = pl(O, p.k); bump(k, 'xpa');
      const good = p.res === 'good';
      if (p.res !== 'blk') leg('kick', O, st.spot - 7, FL + 9, !good);
      if (good){ bump(k, 'xpm'); bump(k, 'pts', 1); score(O, 1, 'try'); amendTry(`${nm(O, p.k)} kick`); }
      else amendTry(p.res === 'blk' ? 'kick blocked' : 'kick failed');
      const txt = `${nm(O, p.k)} kick is ${good ? 'GOOD' : p.res === 'blk' ? 'BLOCKED' : 'NO GOOD'}.`;
      afterTry(); return txt;
    }
    const good = p.res === 'good';
    if (p.kind === 'pass'){ leg('pass', O, st.spot, FL + 3, !good); return twoPoint({t:'pass', res:'c', to:p.to}, good, `${nm(O, p.qb)} pass to ${nm(O, p.to)}`); }
    leg('run', O, st.spot, good ? FL + 2 : FL - 1);
    return twoPoint({t:'run', r:p.r}, good, `${nm(O, p.r)} rush`);
  }

  function endPeriod(p){
    const q = st.q;
    if (q === 1 || q === 3){ st.q++; return `End of the ${ord(q)} quarter.`; }
    if (q === 2){
      closeDrive('Half'); st.q = 3; st.to = {A:3, H:3};
      kickoffBy(p.kick || other(g.set.firstKick || 'H'));
      return `End of the 1st half. ${ab(st.poss)} kicks off to open the 2nd half.`;
    }
    if (q === 4){
      if (st.score.A === st.score.H){
        closeDrive('End of regulation');
        st.q = 5; st.to = {A:1, H:1};
        st.ot = {n:1, first:p.first || 'A', cur:null, done:{A:false, H:false}};
        otSeries(st.ot.first);
        return `End of regulation, tied ${st.score.A}–${st.score.H}. Overtime: ${ab(st.ot.first)} ball first at the ${yl(st.ot.first, otSpot)}.`;
      }
      endGame(); return 'End of the 4th quarter.';
    }
    return '';
  }

  const PLAY = {run:1, pass:1, punt:1, ko:1, fg:1};
  function core(p){
    switch (p.t){
      case 'run': return run(p);
      case 'pass': return pass(p);
      case 'punt': return punt(p);
      case 'ko': return kickoff(p);
      case 'fg': return fieldGoal(p);
      case 'try': return tryPlay(p);
      case 'pen': return p.pen.enf === 'off' ? (tags.push(['flag', 'Flag']), `Offsetting penalties${p.pen.name ? ` (${p.pen.name})` : ''}. Replay the down.`) : penalize(p.pen, false);
      case 'to': st.to[p.side] = Math.max(0, st.to[p.side] - 1); tags.push(['info', 'Timeout']);
        return `Timeout ${T[p.side].name || ab(p.side)} (${st.to[p.side]} left).`;
      case 'note': tags.push(['info', 'Note']); return p.text || '';
      case 'set': {   // "N ball at N35 1-10": the scorer states the situation outright
        if (st.drive && st.drive.team !== p.poss) closeDrive();
        st.poss = p.poss; st.spot = clamp(+p.spot, 0.5, (FL - .5)); st.down = clamp(+p.down || 1, 1, 4);
        st.ltg = p.goal ? FL : Math.min(FL, st.spot + (+p.togo || 10)); st.phase = 'play'; st.fresh = true;
        if (st.ot) st.ot.cur = p.poss;
        tags.push(['info', 'Spot']);
        return `${ab(p.poss)} ball, ${ord(st.down)} & ${st.ltg >= FL ? 'Goal' : fy(st.ltg - st.spot)} at the ${yl(p.poss, st.spot)}.`;
      }
      case 'endq': return endPeriod(p);
      case 'final': endGame(); return 'Game ended.';
    }
    return '';
  }
  // Describe a play on a throwaway copy, for flags that wipe it out.
  function dry(p){
    const keep = [st, S, scoring, drives, tags, trace];
    st = structuredClone(st); S = {team:{A:zeros(TEAM_KEYS), H:zeros(TEAM_KEYS)}, pl:{A:{}, H:{}}};
    scoring = []; drives = []; tags = []; trace = [];
    let t = '';
    try { t = core({...p, pen:null}); } finally { [st, S, scoring, drives, tags, trace] = keep; }
    return t;
  }
  function apply(p){
    clk = p.clk ?? null; tags = []; trace = [];
    const pen = p.pen && PLAY[p.t] ? p.pen : null;
    if (pen && (pen.enf === 'prev' || pen.enf === 'off')){
      const wiped = dry(p);
      if (pen.enf === 'off'){ tags.push(['flag', 'Flag']); return {text:'Offsetting penalties. Replay the down.', wiped}; }
      return {text:'No play. ' + penalize(pen, false), wiped};
    }
    st.fresh = false;
    const beforePoss = st.poss;
    let text = core(p);
    if (pen && pen.enf === 'end') text += ' ' + penalize(pen, st.fresh || st.poss !== beforePoss);
    else if (pen && pen.enf === 'dec'){ text += ` Penalty ${ab(pen.side)} ${pen.name}, declined.`; tags.push(['flag', 'Declined']); }
    if (st.drive && st.drive.team === st.poss && st.phase === 'play') st.drive.last = st.spot;
    return {text};
  }

  for (let i = 0; i < upto && i < g.plays.length; i++){
    let p = g.plays[i];
    // A punt typed without a distance takes it from the spot typed next ("S ball at S10").
    if (p.t === 'punt' && p.d == null && p.res !== 'tb' && p.res !== 'blk' && st.phase === 'play'){
      const nx = g.plays[i + 1];
      if (nx && nx.t === 'set' && nx.poss === other(st.poss)) p = {...p, d:Math.max(0, FL - nx.spot - st.spot + (+p.ry || 0))};
    }
    // "punt to I25" then "I ball at I35": the difference is the return.
    else if (p.t === 'punt' && p.d != null && (p.res === 'spot' || (p.res === 'ret' && p.ry == null)) && st.phase === 'play'){
      const nx = g.plays[i + 1];
      if (nx && nx.t === 'set' && nx.poss === other(st.poss)){
        const ry = nx.spot - (FL - (st.spot + p.d));
        if (ry > 0) p = {...p, res:'ret', ry};
      }
    }
    if (p.t === 'ko' && p.d == null && !['tb', 'oob', 'onside'].includes(p.res) && st.phase === 'kick'){
      const nx = g.plays[i + 1];
      if (nx && nx.t === 'set' && nx.poss === other(st.poss)) p = {...p, d:Math.max(0, FL - st.kickFrom - nx.spot + (+p.ry || 0))};
    }
    curI = i;
    const pre = {sit: sit(), q: st.q, poss: st.poss};
    // The last quarter football was actually played in. A game stopped early — 8-man's 45-point rule from the half
    // on, or weather — never reaches the rest, and those quarters show an X instead of a 0. Ending the game is
    // bookkeeping, not a play: it is recorded after the half has already turned the clock to the 3rd quarter.
    if (!['final', 'note', 'to'].includes(p.t) && pre.q > st.qPlayed) st.qPlayed = pre.q;
    const r = apply(p);
    log.push({i, q:pre.q, clk:p.clk, sit:pre.sit, poss:pre.poss, trace, t:p.t, text:r.text, wiped:r.wiped, tags, src:p.q, A:st.score.A, H:st.score.H});
  }
  if (g.box) boxInto(g, st, S, scoring);   // entered from a pasted box score: no plays, just its totals
  if (g.lines && upto >= g.plays.length) applyLines(g.lines, st);   // a typed line score wins over the plays
  const open = st.drive ? [{...st.drive, res:'In progress', open:true}] : [];
  return {st, S, log, scoring, drives:drives.concat(open), sit:sit(), yl, nm, ab, FL, RU, box:!!g.box};
}
