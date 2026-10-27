/* ================================================================
   Quick entry: one line of shorthand per play, e.g.
     N ball at N35 1-10 · 3-10 · 3--1 · 7-inc · 7-88-5 · 15-0-50-td
     N punt · S ball at S10 · 3-3-fumble S rec · pen S 15 pf · 15-xp
   ================================================================ */
// Every way a scorer says a kick was blocked: punts, field goals and tries.
const BLK_WORDS = ['blk', 'block', 'blocks', 'blocked'];
const PEN_CODES = {fs:'False start', enc:'Encroachment', off:'Offside', os:'Offside', offside:'Offside',
  dog:'Delay of game', delay:'Delay of game', form:'Illegal formation', formation:'Illegal formation',
  motion:'Illegal motion', mot:'Illegal motion', shift:'Illegal shift', snap:'Illegal snap',
  sub:'Illegal substitution', too:'Too many players', idp:'Ineligible downfield', ineligible:'Ineligible downfield',
  ifp:'Illegal forward pass', ig:'Intentional grounding', grounding:'Intentional grounding', rik:'Running into the kicker',
  touch:'Illegal touching', touching:'Illegal touching', itouch:'Illegal touching',
  hold:'Holding', holding:'Holding', iuh:'Illegal use of hands', hands:'Illegal use of hands',
  ibb:'Illegal block in the back', bib:'Illegal block in the back', pi:'Pass interference', dpi:'Pass interference',
  opi:'Pass interference', kci:'Kick-catch interference', fm:'Facemask', face:'Facemask', facemask:'Facemask',
  hc:'Horse-collar', horse:'Horse-collar', pf:'Personal foul', ur:'Unnecessary roughness', late:'Late hit',
  target:'Targeting', targeting:'Targeting', clip:'Clipping', clipping:'Clipping', chop:'Chop block',
  blw:'Illegal block below the waist', trip:'Tripping', tripping:'Tripping', slap:'Head slap',
  ip:'Illegal participation', uc:'Unsportsmanlike conduct', unsport:'Unsportsmanlike conduct', usc:'Unsportsmanlike conduct',
  rtp:'Roughing the passer', rtk:'Roughing the kicker', rth:'Roughing the holder', rts:'Roughing the snapper'};
const NO_WORDS = ['no', 'miss', 'missed', 'nogood', 'ng', 'wide', 'short', 'fail', 'failed'];
const TD_WORDS = ['td', 'dtd', 'deftd', 'pick6', 'touchdown'];
const FILLER = ['for', 'yds', 'yards', 'yd', 'to', 'ran', 'run', 'rush', 'pass', 'complete', 'comp', 'caught', 'gain', 'the', 'a'];

// Team letters come from the short names in Setup: NOR → N, SOU → S.
// Two-letter words a sentence uses, so never a school's first two letters ("in" is not Inman).
const TWO_TAKEN = ['an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on', 'or', 'ot', 'so', 'to', 'up', 'us', 'we', 'yd', 'td', 'fg', 'xp', 'ko', 'tb', 'fc', 'pi', 'pf', 'uc', 'ur', 'ig', 'fs', 'fm', 'hc', 'rn',
  'af', 'db', 'ez', 'kn', 'np', 'rt', 'sk', 'tm', 'ip', 'os', 'ng', 'ff', 'fr', 'bk', 'pr', 'kr', 'qb', 'rb', 'wr', 'te', 'lb', 'cb'];
function quickTeams(){
  const ab = s => String(g.teams[s].abbr || (s === 'A' ? 'V' : 'H')).toLowerCase();
  const a = ab('A'), h = ab('H');
  // The letter the hints show: the one typed in Setup, else the short name's first letter.
  const pick = s => (String(g.teams[s].key || '').toLowerCase().match(/[a-z]{1,2}/) || [''])[0];
  let ka = pick('A') || a[0], kh = pick('H') || h[0];
  // Two schools on the same letter (Augusta and Abilene) go by their first two: au and ab.
  if (ka === kh && !pick('A') && !pick('H') && a.length > 1 && h.length > 1 && a.slice(0, 2) !== h.slice(0, 2)
    && !TWO_TAKEN.includes(a.slice(0, 2)) && !TWO_TAKEN.includes(h.slice(0, 2))){ ka = a.slice(0, 2); kh = h.slice(0, 2); }
  if (ka === kh){ ka = pick('A') || 'v'; kh = ka === 'h' ? 'v' : 'h'; }
  const map = {};
  // Anything that names one team and not the other can be typed: "wichita collegiate" is w, c, wc or collegiate.
  const WORDS_TAKEN = ['at', 'to', 'td', 'inc', 'punt', 'fg', 'xp', 'int', 'sack', 'fum', 'pen', 'ko', 'ret', 'ball', 'rec',
    'oob', 'tb', 'fc', 'blk', 'block', 'blocks', 'blocked', 'down', 'half', 'end', 'final', 'undo', 'safety', 'saf', 'kneel', 'muff', 'lateral', 'team', 'rekick', 'rk'];
  const add = (w, side) => {
    const k = String(w || '').toLowerCase();
    if (!/^[a-z]+$/.test(k) || (k.length > 1 && WORDS_TAKEN.includes(k))) return;
    if (k in map && map[k] !== side) map[k] = null; else if (!(k in map)) map[k] = side;
  };
  ['A', 'H'].forEach(s => {
    const words = String(g.teams[s].name || '').toLowerCase().split(/[^a-z]+/i).filter(Boolean);
    const two = w => { if (w.length > 2 && !TWO_TAKEN.includes(w.slice(0, 2))) add(w.slice(0, 2), s); };
    add(ab(s), s); add(ab(s)[0], s); two(ab(s));
    words.forEach(w => { add(w, s); add(w[0], s); two(w); });
  });
  Object.keys(map).forEach(k => { if (!map[k]) delete map[k]; });
  map[ka] = 'A'; map[kh] = 'H';                       // the two the hints name always win
  if (!map.v) map.v = 'A';
  if (!map.h) map.h = 'H';
  return {map, key:{A:ka, H:kh}};
}

// Dashes separate; a dash right after a separator is a minus sign: 3-10 · 3--1 · 3-(-1) · 3 -1.
function tokenize(s){
  const out = []; let cur = '';
  const flush = () => { if (cur !== '' && cur !== '-') out.push(cur); cur = ''; };
  for (const ch of s.toLowerCase().replace(/#/g, '').replace(/&/g, ' ').replace(/\band\b/g, ' ')){
    if (/[\s,()\/]/.test(ch)){ flush(); continue; }
    if (ch === '-'){ if (cur === '') cur = '-'; else flush(); continue; }
    cur += ch;
  }
  flush(); return out;
}

/* ---------- plain English: "aug 15 runs for 15 yards tackled by indy 54 3:54" ----------
   A typed-out sentence is rewritten into the shorthand's own words before it's read, so either works,
   and both end up in the same parser. */
const PEN_PHRASES = [[/\boffsetting(?:\s+penalties|\s+fouls|\s+flags)?\b/g, ' pen offset '], [/\bpenalties\s+offset\b/g, ' pen offset '],
  [/\bfalse start\b/g, 'fs'], [/\bpass interference\b/g, 'pi'], [/\bpersonal foul\b/g, 'pf'], [/\bdelay of game\b/g, 'dog'],
  [/\bface ?mask\b/g, 'fm'], [/\broughing the passer\b/g, 'rtp'], [/\broughing the kicker\b/g, 'rtk'], [/\bunsportsmanlike(?: conduct)?\b/g, 'uc'],
  [/\boffsides?\b/g, 'off'], [/\bhorse ?collar\b/g, 'hc'], [/\b(?:illegal )?block in the back\b/g, 'ibb'], [/\billegal motion\b/g, 'motion'],
  [/\billegal formation\b/g, 'form'], [/\bintentional grounding\b/g, 'ig'], [/\billegal(?:ly)? touch(?:ing|ed)?\b/g, 'touch'], [/\bunnecessary roughness\b/g, 'ur']];
function plainWords(line){
  const {map} = quickTeams(), team = w => !!w && !!map[w];
  let s = ' ' + String(line).toLowerCase().replace(/#/g, '') + ' ';
  // School names, longest first, become their short names: "andover central" → "ac".
  [g.teams.A, g.teams.H].map(t => [String(t.name || '').toLowerCase().trim(), String(t.abbr || '').toLowerCase()])
    .sort((x, y) => y[0].length - x[0].length)
    .forEach(([name, ab]) => { if (name && ab && name !== ab) s = s.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ` ${ab} `); });
  PEN_PHRASES.forEach(([re, code]) => { s = s.replace(re, ` ${code} `); });
  const who = '(?:([a-z]+)\\s*)?', num = '(\\d+)';                // an optional team word ("r0" or "r 0"), then a player number
  const keep = w => w && !team(w) ? w + ' ' : '';                  // a word that wasn't a team stays
  const two = (w1, n1, w2, n2) => `${keep(w1)}@${n1}${n2 ? ` ${keep(w2)}@${n2}` : ''}`;
  s = s
    .replace(/\b(?:for )?(?:a )?first down\b/g, ' ')
    // tacklers (always the defense): "tackled by indy 54 and 20" → @54 @20
    .replace(new RegExp(`\\b(?:tackled|tackle|stopped|brought down|dropped|wrapped up|hit)\\s+by\\s+(?:the\\s+)?${who}${num}(?:\\s*(?:and|&|,|with)\\s*${who}${num})?`, 'g'),
      (m, w1, n1, w2, n2) => ` ${two(w1, n1, w2, n2)} `)
    .replace(new RegExp(`\\bsacked\\s+by\\s+${who}${num}(?:\\s*(?:and|&|,)\\s*${who}${num})?`, 'g'), (m, w1, n1, w2, n2) => ` sack ${two(w1, n1, w2, n2)} `)
    .replace(new RegExp(`\\b(?:intercepted|picked off|picked)\\s+by\\s+${who}${num}`, 'g'), (m, w, n) => ` ${keep(w)}int ${n} `)
    // "recovered by indy 31" → rec indy31 (a team-lettered number is the recoverer)
    .replace(new RegExp(`\\b(?:recovered|recovers|recovery)\\s+by\\s+${who}${num}`, 'g'), (m, w, n) => team(w) ? ` rec ${w}${n} ` : ` rec ${keep(w)}${n} `)
    // who knocked it loose (always the defense): "forced by 44", "caused by indy 44" → ff 44
    .replace(new RegExp(`\\b(?:forced|caused)(?:\\s+(?:it|the\\s+fumble))?\\s+(?:by\\s+)?(?:the\\s+)?${who}${num}`, 'g'), (m, w, n) => ` ${keep(w)}ff ${n} `)
    .replace(new RegExp(`\\breturned\\s+by\\s+${who}${num}`, 'g'), (m, w, n) => team(w) ? ` ${w}${n} return ` : ` ${keep(w)}${n} return `)
    // passes: "passes to 88", "throws a pass to aug 88", "complete to 88" → 88
    .replace(new RegExp(`\\b(?:complete[sd]?|throws?|threw|pass(?:es|ed)?|hits|finds|found|connects with)(?:\\s+(?:a|the))?(?:\\s+pass)?\\s+(?:to\\s+)?${who}${num}`, 'g'),
      (m, w, n) => ` ${keep(w)}${n} `)
    // yards: "for a loss of 3", "loses 3", "no gain", "a gain of 6"
    .replace(/\b(?:for\s+)?(?:a\s+)?loss\s+of\s+(\d+)/g, ' -$1 ')
    .replace(/\bloses\s+(\d+)/g, ' -$1 ')
    .replace(/\bno\s+gain\b/g, ' 0 ')
    .replace(/\b(?:for\s+)?(?:a\s+)?gain\s+of\s+(\d+)/g, ' $1 ')
    // a runner's verb, so "runs 12 yards for a touchdown" is never read as a pass
    .replace(/\b(?:runs?|ran|rushe[sd]|rush|carrie[sd]|carry|keeps|kept|scrambles|scrambled)\b/g, ' rn ')
    .replace(/\bspike[sd]?\b/g, ' inc ')            // a spike is an incompletion, and counts as one
    .replace(/\bpunt(?:s|ed)\b/g, ' punt ')
    .replace(/\bfield goal\b/g, ' fg ')
    .replace(/\b(?:extra point|pat)\b/g, ' xp ')
    .replace(/\bfair catch\b/g, ' fc ')
    .replace(/\btouchback\b/g, ' tb ')
    .replace(/\bout of bounds\b/g, ' oob ')
    .replace(/\b(?:re-?kicks?|re-?kicked|kick(?:s|ed)? again)\b/g, ' rekick ')
    .replace(/\b(?:kicks off|kicked off|kick off|kickoff)\b/g, ' ko ')
    .replace(/\btime ?out\b/g, ' timeout ')
    .replace(/\b(?:scores|scored|for a score)\b/g, ' td ')
    // a yard line said out loud: "at the indy 30" → indy30
    .replace(/\b(at|on|to|from|inside|past|near)\s+(?:the\s+)?([a-z]+)\s+(\d{1,2})\b(?!:)/g, (m, p, w, n) => team(w) ? ` ${p} ${w}${n} ` : m);
  return s.replace(/\s+/g, ' ').trim();
}

function parseQuick(raw, st){
  const line = String(raw || '').trim(); if (!line) return null;
  // "team" (or "tm") stands in for a player number: kneel-downs, snaps over the punter's head.
  // A sentence's full stop after a number ("returned 5. pen …") isn't part of it.
  let toks = tokenize(plainWords(line.replace(/(\d)\.(?=\s|$)/g, '$1'))).map(t => TD_WORDS.includes(t) ? 'td' : t === 'tm' ? 'team' : t);
  const {map, key} = quickTeams();
  const T = t => map[t], L = s => key[s].toUpperCase();
  // "N8 runs for 9", "aug8-9": a line that starts with a team stuck to a number is that team's player, not a yard line.
  const lead = (toks[0] || '').match(/^([a-z]+)(\d+)$/);
  if (lead && T(lead[1])) toks.splice(0, 1, lead[1], lead[2]);
  const FL = rulesOf(g).len, HALF = FL / 2;
  // "N5", "sou35": a yard line named by team.
  const spotOf = t => { const m = String(t).match(/^([a-z]+)(\d+(?:\.5)?)$/); return m && T(m[1]) ? {side:T(m[1]), n:+m[2]} : null; };
  const isNum = t => /^-?\d+(\.\d+)?$/.test(t);
  const has = (...w) => w.some(x => toks.includes(x));
  const O = st.poss, D = other(O);
  let clk;
  // A clock time can sit anywhere on the line: "8:40 3-10", "ko-c25-3:25".
  const ci = toks.findIndex(t => /^\d{1,2}:\d{2}$/.test(t));
  if (ci >= 0){ clk = parseClock(toks[ci]); toks.splice(ci, 1); }
  const tk = [];
  toks = toks.filter(t => { const m = t.match(/^(?:@|tk)(\d+)$/); if (m){ tk.push(m[1]); return false; } return true; });
  const bad = msg => ({error:msg});
  const ok = p => {
    if (clk != null) p.clk = clk;
    if (tk.length && ['run', 'pass', 'punt', 'ko'].includes(p.t) && !p.tk) p.tk = tk.slice(0, 2);
    p.q = line;
    return {play:p};
  };
  if (!toks.length) return bad('Type a play, like 3-10.');
  if (has('undo')) return {undo:true};

  /* ---- whose ball, where: "N ball at N35 1-10" ---- */
  // "pen m 10 ball spot 35" is a spot foul, not a spot: the word comes after the flag, and the flag reads it.
  const flagAt = toks.findIndex(t => ['pen', 'penalty', 'flag'].includes(t));
  if (has('ball') && (flagAt < 0 || toks.indexOf('ball') < flagAt) && !has('punt') && !has('fum', 'fumble', 'fumbled', 'fumbles')){
    const bi = toks.indexOf('ball');
    const side = T(toks[bi - 1]) || T(toks[bi + 1]);
    if (!side) return bad(`Start with the team letter, like ${L('A')} ball at ${L('A')}35.`);
    const rest = toks.slice(bi + 1).filter(t => !['at', 'on', 'the', 'own'].includes(t));
    if (T(rest[0]) === side && (rest[1] || '').match(/^[a-z]/)) rest.shift();
    let spotSide, n;
    const m = (rest[0] || '').match(/^([a-z]+)(\d+(?:\.5)?)$/);
    if (m && T(m[1])){ spotSide = T(m[1]); n = +m[2]; rest.shift(); }
    else if (T(rest[0]) && isNum(rest[1] || '')){ spotSide = T(rest[0]); n = +rest[1]; rest.splice(0, 2); }
    else if ([String(HALF), 'mid', 'midfield'].includes(rest[0])){ spotSide = side; n = HALF; rest.shift(); }
    else return bad(`Say whose yard line, like ${L(side)}35 or ${L(other(side))}35.`);
    if (!(n >= 1 && n <= HALF)) return bad(`Yard lines run from 1 to ${HALF}.`);
    const spot = spotSide === side ? n : FL - n;
    const dn = rest.map(t => t.replace(/(st|nd|rd|th)$/, ''));
    let down = 1, togo = 10, goal = false;
    if (dn.length){
      down = parseInt(dn[0], 10);
      if (!(down >= 1 && down <= 4)) return bad('Down should be 1 to 4, like 3-7.');
      if (dn[1] === 'g' || dn[1] === 'goal') goal = true;
      else if (dn[1] != null){ togo = +dn[1]; if (!(togo > 0)) return bad('Distance should be yards, like 3-7.'); }
    }
    if (spot + togo >= FL) goal = true;
    return ok({t:'set', poss:side, spot, down, ...(goal ? {goal:true} : {togo})});
  }

  /* ---- clock and game control ---- */
  // Only "to N", "N timeout" and the like: a "to" inside a play ("kick to N5") isn't a timeout.
  const nonTeam = toks.filter(t => !T(t));
  if (nonTeam.length && nonTeam.every(t => ['to', 'timeout', 'tmo'].includes(t))){
    const side = toks.map(T).find(Boolean);
    if (!side) return bad(`Whose timeout? Type to ${L('A')} or to ${L('H')}.`);
    return ok({t:'to', side});
  }
  // "end" ends the quarter — but not when the line is about the end zone.
  if (has('eoq', 'endq', 'half', 'halftime', 'eoh') || (has('end') && !has('zone', 'ez'))){
    const side = toks.map(T).find(Boolean);
    return ok({t:'endq', ...(side ? {kick:side, first:side} : {})});
  }
  if (has('final')) return ok({t:'final'});
  if (st.final) return bad('The game is final. Type undo to reopen it.');

  /* ---- penalties: alone, or after a play on the same line ---- */
  let pen = null;
  const pi = toks.findIndex(t => ['pen', 'penalty', 'flag'].includes(t));
  if (pi >= 0){
    let pt = toks.slice(pi + 1); toks = toks.slice(0, pi);
    // "r pen 10": the team can come just before the word too.
    if (toks.length && T(toks[toks.length - 1])) pt.unshift(toks.pop());
    // Offsetting fouls cancel, so they need neither a team nor a yardage: "pen offset" says it all. A flag on
    // each team on the same line says it too: "pen C 10 pen R 10".
    let offset = pt.some(t => ['offset', 'offsetting', 'offsets'].includes(t));
    const pi2 = pt.findIndex(t => ['pen', 'penalty', 'flag'].includes(t));
    if (pi2 >= 0){
      const s1 = pt.slice(0, pi2).map(T).find(Boolean), s2 = pt.slice(pi2 + 1).map(T).find(Boolean);
      if (s1 && s2 && s1 !== s2) offset = true;
      else if (!offset) pt = pt.slice(0, pi2);          // the same team twice: the first one is the flag
    }
    const side = pt.map(T).find(Boolean);
    if (!side && !offset) return bad(`Which team? Like pen ${L('A')} 5 or pen ${L('H')} 15.`);
    if (offset){
      const both = pt.filter(t => PEN_CODES[t]).map(t => PEN_CODES[t]);
      pen = {side:side || st.poss, name:both.length ? [...new Set(both)].join(' and ') : '', y:0, enf:'off'};
      if (!toks.length) return ok({t:'pen', pen});
    }
    else {
    const code = pt.find(t => PEN_CODES[t]);
    const preset = code && PENALTIES.find(x => x.name === PEN_CODES[code]);
    // A spot foul: "pen m 10 ball spot 35" is where the ref put the ball, "pen m 10 foul at the 25" is where
    // it happened. A bare yard line is read as whichever side of the field is nearer the line of scrimmage.
    const near = n => Math.abs(n - st.spot) <= Math.abs((FL - n) - st.spot) ? n : FL - n;
    const spotAfter = words => {
      const at = pt.findIndex(t => words.includes(t)); if (at < 0) return null;
      const tail = pt.slice(at + 1), s = tail.map(spotOf).find(Boolean);
      if (s) return {pos:s.side === st.poss ? s.n : FL - s.n, raw:s.n, side:s.side};
      const n = tail.find(t => isNum(t) && +t >= 0 && +t <= FL);
      return n == null ? null : {pos:near(+n), raw:+n};
    };
    // "pen r 10 at r28" with neither word: a yard line named with a team is where the foul was.
    const foulAt = pt.includes('foul') ? spotAfter(['foul'])
      : !pt.some(t => ['spot', 'ballspot', 'ball'].includes(t)) && pt.includes('at') && (spotAfter(['at']) || {}).side ? spotAfter(['at']) : null;
    const ballAt = foulAt ? null : spotAfter(['spot', 'ballspot', 'ball']);
    const said = foulAt || ballAt;
    const nums = pt.filter(isNum).map(x => Math.abs(+x));
    if (said){ const k = nums.indexOf(said.raw); if (k >= 0) nums.splice(k, 1); }   // a yard line isn't a jersey
    const y = nums.length ? nums[0] : preset ? preset.y : null;
    if (y == null) return bad('How many yards? Like pen S 15, or add a code like hold.');
    pen = {side, name:preset ? preset.name : 'Penalty', y, a:preset ? preset.a : false, l:preset ? preset.l : false};
    if (nums[1] != null) pen.n = String(nums[1]);
    if (foulAt) pen.foul = foulAt.pos; else if (ballAt) pen.ball = ballAt.pos;
    if (said && said.side) pen.at = {side:said.side, n:said.raw};   // re-read once we know who has the ball after the play
    if (pt.some(t => ['1st', 'auto', 'af'].includes(t))) pen.a = true;
    if (pt.includes('lod')) pen.l = true;
    const declined = pt.some(t => ['dec', 'declined'].includes(t));
    if (!toks.length){ delete pen.at; return ok({t:'pen', pen:{...pen, enf:declined ? 'dec' : 'acc'}}); }
    pen.enf = pt.some(t => ['np', 'noplay', 'nullified', 'replay'].includes(t)) ? 'prev'
      : declined ? 'dec'
      : pt.some(t => ['db', 'dead', 'deadball', 'after'].includes(t)) ? 'dead' : 'end';
    }
  }
  let fumErr = null;                       // set when a fumble's "ball on" spot can't be right
  const flag = p => {
    if (fumErr) return bad(fumErr);
    // A fumble on a kick return: the returner is the carrier, and "lost" gives the ball back to the kicking team.
    if (fum && !p.fum && (p.t === 'ko' || p.t === 'punt')){
      if (p.res !== 'ret') return bad('Say the return first, then the fumble: punt 40 returned 10 fum ' + L(O) + ' rec 31.');
      p.fum = {lost:fum.lost, ...(fum.by != null ? {by:fum.by} : {}), ...(fum.self ? {self:true} : {}),
               ...(fum.at ? {at:fum.at} : {}), ...(fum.lost && fum.tdLine ? {td:true} : {}), ...(fum.ez ? {ez:true} : {}), ...(fum.ff ? {ff:fum.ff} : {}), ry:fum.ry};
    }
    if (pen){
      // The flag's yard line counts from whoever has the ball once the play is over: the receiving team after a
      // kick, the defense after a pick or a lost fumble (and back again if the returner fumbles it away).
      if (pen.at){
        const kick = p.t === 'ko' || p.t === 'punt', flips = (kick && p.res !== 'muff') || (p.t === 'pass' && p.res === 'x');
        const after = flips !== !!(p.fum && (p.fum.then ? p.fum.endLost : p.fum.lost)) ? D : O, pos = pen.at.side === after ? pen.at.n : FL - pen.at.n;
        if (pen.foul != null) pen.foul = pos; else if (pen.ball != null) pen.ball = pos;
      }
      delete pen.at; p.pen = pen;
    }
    return ok(p);
  };
  // Drop filler words, but never a team letter: for Augusta, "a" is the team, not the article.
  // A kickoff reads its yard lines off the words "caught at the 8 … to the 20", and those words are filler
  // everywhere else, so keep a copy of the line before they go.
  /* ---- a fumble, read off the end of the line: the rest of it is the play itself ---- */
  let fum = null;
  const FUMW = ['fum', 'fumble', 'fumbled', 'fumbles'];
  const fi = toks.findIndex(t => FUMW.includes(t));
  if (fi >= 0){
    let ft = toks.slice(fi + 1); toks = toks.slice(0, fi);
    // It came loose a second time: everything after the second "fum" belongs to that one.
    const fj = ft.findIndex(t => FUMW.includes(t));
    let ft2 = null;
    if (fj >= 0){ ft2 = ft.slice(fj + 1); ft = ft.slice(0, fj); }
    // Who was carrying it: the offense, or the returner on a kick.
    const kickLine = has('punt', 'ko', 'kickoff'), carrier = kickLine ? D : O;
    // One "fum …" tail: who came up with it, where, and how far it went after.
    const readTail = (ft, carrier) => {
      // "… rec at B6": where the ball was recovered, when it isn't where it came loose (a bounce, a scramble).
      let recAt = null;
      const ai = ft.indexOf('at');
      if (ai >= 0){
        const j = ft.slice(ai + 1).findIndex(t => spotOf(t));
        if (j >= 0){ const s = spotOf(ft[ai + 1 + j]); recAt = {side:s.side, n:s.n}; ft = ft.slice(0, ai).concat(ft.slice(ai + 2 + j)); }
      }
      // "… ball on I24", or "… returned to the I24": where the next snap is; the advance is the difference.
      let endSpot = null, bi = ft.indexOf('ball');
      if (bi < 0){ const ti = ft.indexOf('to'); if (ti >= 0 && ft.slice(ti + 1).some(spotOf)) bi = ti; }
      if (bi >= 0){
        const tail = ft.slice(bi + 1);
        endSpot = tail.map(spotOf).find(Boolean) || (tail.includes(String(HALF)) ? {side:null, n:HALF} : null);
        if (!endSpot) return {err:`Say where the ball ended up, like ball on ${L(D)}24.`};
        ft = ft.slice(0, bi);
      }
      // "ff 44" or "ff44": who forced it, always a man on the other side from the carrier.
      let ff = null;
      const fk = ft.findIndex(t => t === 'ff' || /^ff\d+$/.test(t));
      if (fk >= 0){
        const own = ft[fk].slice(2), nx = ft[fk + 1], sp = nx != null && spotOf(nx);
        if (own){ ff = own; ft = ft.slice(0, fk).concat(ft.slice(fk + 1)); }
        else if (nx != null && (isNum(nx) || sp)){ ff = sp ? String(sp.n) : nx; ft = ft.slice(0, fk).concat(ft.slice(fk + 2)); }
        else return {err:'Who forced it? Put his number after ff, like ff 44.'};
      }
      // "A31" is team A's #31 recovering; a bare "A" is just the team.
      const who = ft.map(spotOf).find(Boolean), fn = ft.filter(isNum);
      // "recovered it himself": the man who dropped it fell on it, so it stays with the offense.
      const selfRec = ft.some(t => ['himself', 'herself', 'themselves', 'themself', 'itself'].includes(t))
        || (ft.includes('own') && ft.some(t => ['rec', 'recs', 'recovers', 'recovered', 'recovery'].includes(t)));
      const side = who ? who.side : ft.map(T).find(Boolean) || (selfRec ? carrier : null), lost = !side || side !== carrier;
      const by = who ? String(who.n) : fn[0], adv = who ? fn[0] : fn[1];
      const tdLine = ft.includes('td');
      // Nobody came up with it and it left the field beyond a goal line: "fum tb", or said in words,
      // "fumbles out of the end zone". Only when no one is named as recovering it.
      const ez = ft.includes('tb') || ((ft.includes('end') && ft.includes('zone')) && !who && !fn.length);
      return {lost, by, ry:Math.abs(+(adv || 0)), td:lost && tdLine, endSpot, at:recAt, self:selfRec && by == null,
              rs:who ? who.side : ft.map(T).find(Boolean) || null, selfRec, tdLine, ...(ez ? {ez:true} : {}), ...(ff ? {ff} : {})};
    };
    fum = readTail(ft, carrier);
    if (fum.err) return bad(fum.err);
    if (ft2){
      if (kickLine || has('int', 'pick', 'picked', 'intercepted'))
        return bad('Two fumbles on one play only work on a run, a sack or a catch. Put the second one on its own line.');
      if (fum.ez) return bad('Nobody recovered the first fumble, so there was no second one. Drop one of them.');
      const h1 = fum.lost ? other(carrier) : carrier;
      const r2 = readTail(ft2, h1);
      if (r2.err) return bad(r2.err);
      fum.then = r2;
      fum.endLost = (r2.lost ? other(h1) : h1) !== carrier;
    }
    // td anywhere on a lost-fumble line is the defense's score; on a kept fumble it's the offense's.
    const last = fum.then || fum;
    if (!fum.then && toks.includes('td')){ last.tdLine = true; last.td = last.lost; }
    if (fum.then ? fum.endLost : fum.lost) toks = toks.filter(t => t !== 'td');
    else if (last.tdLine && !toks.includes('td')) toks.push('td');
  }
  const rawToks = toks.slice();
  if (toks.some(isNum)) toks = toks.filter(t => !FILLER.includes(t) || T(t));

  // "muffed by 44, recovered by 22": who dropped it, and who fell on it. Anything before the word is
  // the kick itself, so the distance is never mistaken for a jersey number.
  // A team-lettered number names the team too: "rec h10" is the home team's #10. "at v10" after the word is
  // where it was muffed and fallen on, never a player.
  const muffOf = list => {
    const i = list.findIndex(t => ['muff', 'muffed', 'muffs'].includes(t));
    if (i < 0) return null;
    const tail = [], raw = list.slice(i + 1);
    let spot = null;
    for (let k = 0; k < raw.length; k++){
      if (['at', 'on', 'inside'].includes(raw[k]) && raw[k + 1] && spotOf(raw[k + 1])){ spot = spotOf(raw[++k]); continue; }
      tail.push(raw[k]);
    }
    const who = t => { const x = spotOf(t); return x ? {n:String(x.n), side:x.side} : isNum(t) ? {n:t, side:null} : null; };
    const ri = tail.findIndex(t => ['rec', 'recovered', 'recovers'].includes(t));
    const pre = (ri >= 0 ? tail.slice(0, ri) : tail).map(who).filter(Boolean);
    // "…muff-44-22" with no word between them: the second number is whoever fell on it.
    const rec = ri >= 0 ? tail.slice(ri + 1).map(who).filter(Boolean)[0] : pre[1];
    const recSide = (rec && rec.side) || (ri >= 0 ? tail.slice(ri + 1).map(T).find(Boolean) : null) || null;
    return {i, by:pre[0] ? pre[0].n : null, ret:rec ? rec.n : null, recSide, spot,
      before:list.slice(0, i).filter(isNum), beforeToks:list.slice(0, i)};
  };

  /* ---- kickoffs ---- */
  const kickWord = toks.findIndex(t => ['ko', 'kickoff', 'kicks', 'kicked', 'onside'].includes(t) || (t === 'kick' && st.phase === 'kick'));
  if (st.phase === 'kick' && kickWord < 0){
    const R = L(other(st.poss));
    return bad(`${L(st.poss)} is kicking off. Type the kick (15-ko-tb, 15-ko-55-28-21, or just ko) or where the ball ends up: ${R} ball at ${R}25.`);
  }
  if (kickWord >= 0){
    if (st.phase === 'try') return bad('Extra point first: 15-xp (or 15-xp-no, or 3 / 7-88 for a two-point try). Then the kickoff.');
    if (st.phase !== 'kick') return bad(`No kickoff is due — ${L(O)} has the ball. If there was one, type where it ended: ${L(O)} ball at ${L(O)}25.`);
    const Rk = other(st.poss), rest = toks.slice(kickWord + 1);
    // Nobody at the game measures a kickoff: they see it caught and they see where it ends. Both yard lines
    // are the receiving team's, so "caught at the 8 and returned to the 20" needs no team on either number.
    const AT = ['at', 'to', 'on', 'inside', 'near'], CAUGHT = ['caught', 'catch', 'catches', 'fielded', 'fields'];
    const KICK = ['ko', 'kickoff', 'kicks', 'kicked', 'onside'];
    const rk0 = rawToks.findIndex(t => KICK.includes(t) || (t === 'kick' && st.phase === 'kick'));
    const rawRest = rk0 >= 0 ? rawToks.slice(rk0 + 1) : rest;
    const bare = [];
    rawRest.forEach((t, i) => {
      if (!isNum(t) || +t < 0 || +t > FL / 2) return;
      let j = i - 1; while (j >= 0 && rawRest[j] === 'the') j--;
      if (j >= 0 && AT.includes(rawRest[j])) bare.push(+t);
    });
    // "for 15" or "15 yards" is a distance, never a jersey; a number in front of "returns" is the returner.
    const YD = ['yard', 'yards', 'yd', 'yds'], RET = ['return', 'returns', 'returned', 'ret', 'brought', 'ran', 'runs'];
    const ydNums = [], retNums = [];
    rawRest.forEach((t, i) => {
      if (!isNum(t)) return;
      let j = i - 1; while (j >= 0 && ['the', 'a', 'it'].includes(rawRest[j])) j--;
      if ((j >= 0 && rawRest[j] === 'for') || YD.includes(rawRest[i + 1])) ydNums.push(+t);
      let n = i + 1; while (n < rawRest.length && ['the', 'it'].includes(rawRest[n])) n++;
      if (RET.includes(rawRest[n])) retNums.push(+t);
    });
    const muff = muffOf(rest);
    const tagged = (muff ? muff.beforeToks : rest).map(spotOf).filter(Boolean);
    if (muff && muff.spot) tagged.unshift(muff.spot);
    const spots = tagged.concat(bare.filter(n => !tagged.some(x => x.side === Rk && x.n === n)).map(n => ({side:Rk, n})));
    const caught = rawToks.some(t => CAUGHT.includes(t));
    const before = toks.slice(0, kickWord).filter(isNum);
    const left = bare.slice();                     // a number already read as a yard line isn't a player
    const after = rest.filter(t => {
      if (!isNum(t) || spotOf(t)) return false;
      const k = left.indexOf(+t); if (k >= 0){ left.splice(k, 1); return false; }
      return true;
    });
    if (muff) after.length = 0, muff.before.forEach(n => after.push(n));   // only the kick's own numbers left
    const sp = spots[0] || null, endSp = spots[1] || null;   // where it was caught, and where the return ended
    const pos = x => x.side === Rk ? FL - x.n : x.n;         // a yard line as the kicking team sees it
    const p = {t:'ko', res:'spot'};
    // With no catch spot the first number is how far it was kicked — unless it's the one returning it.
    const leadIsRet = !sp && after[0] != null && retNums.includes(+after[0]);
    if (sp) p.d = Math.max(0, pos(sp) - st.kickFrom);
    else if (after[0] != null && !leadIsRet) p.d = Math.abs(+after[0]);
    const nx = (sp || leadIsRet ? after : after.slice(1)).filter(n => !ydNums.includes(+n));
    // Yards said out loud: "for 15", "15 yards". The number already taken as the kick's own distance is not
    // the return — "kicks off 55 yards returned by 28 for 21" is a 21-yard return, not a 55-yard one.
    const ydLeft = p.d != null && !sp && !leadIsRet && ydNums.length > 1 ? ydNums.slice(1) : ydNums;
    const ryTold = ydLeft.find(n => !spots.some(x => x.n === n));
    // "1 caught the kickoff at the 8": with no number after the word, the one before it is the returner.
    const retNo = nx[0] != null ? nx[0] : (caught && before[0] != null ? before[0] : null);
    if (before[0] != null && retNo !== before[0]) p.k = before[0];
    // "ko-C25": no kick details, just where the receiving team's drive starts.
    if (sp && !endSp && !nx.length && !caught && !muff && ryTold == null && !has('tb', 'oob', 'onside', 'fc')){ delete p.d; p.bs = sp.side === Rk ? sp.n : FL - sp.n; return flag(p); }
    if (has('tb')) p.res = 'tb';
    else if (has('oob') && retNo == null && !endSp){
      // Nobody returned it and nobody's spot is given: it went out of bounds, and any yards said are how far
      // it was kicked. "15 kicks off 45 yards out of bounds" used to read as a 45-yard return.
      p.res = 'oob';
      if (p.d == null && ryTold != null) p.d = Math.abs(+ryTold);
      // "ko oob rk": the receiving team took the 5 yards and made them kick again
      if (has('rekick', 'rk')) p.rk = true;
    }
    else if (has('onside')){
      p.res = 'onside';
      // Who fell on it: "rec 44", "recovered by R44". A number on its own after an onside kick is the recoverer,
      // not the distance — nobody measures an onside kick.
      let recNo = retNo, recSide = null;
      const recI = rest.findIndex(t => ['rec', 'recs', 'recovers', 'recovered', 'recovery'].includes(t));
      if (recI >= 0){
        const tail = rest.slice(recI + 1);
        let tok = null;                                   // the first number that isn't a yard line ("at the 48")
        for (let i2 = 0; i2 < tail.length; i2++){
          if (!isNum(tail[i2]) && !spotOf(tail[i2])) continue;
          let j2 = i2 - 1; while (j2 >= 0 && tail[j2] === 'the') j2--;
          if (j2 >= 0 && AT.includes(tail[j2])) continue;
          tok = tail[i2]; break;
        }
        const st2 = tok && spotOf(tok);
        if (st2){ recSide = st2.side; recNo = String(st2.n); }
        else if (tok != null) recNo = tok;
        recSide = recSide || tail.map(T).find(Boolean) || rest.slice(0, recI).map(T).find(Boolean) || null;
      } else recSide = rest.map(T).find(Boolean) || null;
      // Nobody measures an onside kick: a lone number is the man who recovered it, not the distance.
      if (recNo == null && !sp && ryTold == null && after[0] != null && +after[0] === +(p.d || 0)){ recNo = after[0]; delete p.d; }
      if (!sp && ryTold == null && recNo != null && after[0] != null && +after[0] === +recNo) delete p.d;
      if (p.d == null) p.d = 10;
      if (recSide === Rk) p.res = 'spot';                 // the receiving team fell on it: a plain short kick
      else if (recNo != null) p.ret = String(recNo);
    }
    else if (muff){ p.res = 'muff'; if (muff.by != null) p.by = muff.by; if (muff.ret != null) p.ret = muff.ret; if (muff.recSide === Rk) p.mr = true; }
    else if (has('fc')){ p.res = 'fc'; if (retNo != null) p.ret = retNo; }
    else if (retNo != null || endSp || ryTold != null){
      p.res = 'ret';
      if (has('oob')) p.oob = true;
      if (retNo != null) p.ret = retNo;
      p.ry = endSp ? pos(sp) - pos(endSp) : ryTold != null ? ryTold : Math.abs(+(nx[1] || 0));
      // Caught at the 25 and run back to the 23 is a return for a loss of 2 (Chuck, 2026-10-23: "it's a loss").
    }
    if (p.res === 'ret' && p.d == null) return bad('Say where it was caught — ko 28 at the 8 for 12 — or how far it was kicked: 15-ko-55-28-21.');
    if (p.res === 'ret' && has('td')) p.ry = st.kickFrom + p.d;
    return flag(p);
  }

  /* ---- the try after a touchdown ---- */
  if (st.phase === 'try'){
    const nums = toks.filter(isNum), no = has(...NO_WORDS);
    if (has('fg', 'punt', 'sack', 'sacked', 'sk', 'int', 'fum', 'fumble'))
      return bad('This is the try after the touchdown: 15-xp for the kick (15-xp-no if missed), 3 for a two-point run, 7-88 for a two-point pass.');
    if (has('xp', 'pat', 'kick', '1pt')) return ok({t:'try', kind:'kick', ...(nums[0] != null ? {k:nums[0]} : {}), res:has(...BLK_WORDS) ? 'blk' : no ? 'miss' : 'good'});
    const need = FL - st.spot;
    if (has('inc')) return ok({t:'pass', qb:nums[0], res:'i', ...(nums[1] != null ? {to:nums[1]} : {})});
    if (nums.length === 1) return ok({t:'run', r:nums[0], y:no ? 0 : need});
    if (nums.length >= 2) return ok({t:'pass', qb:nums[0], to:nums[1], res:'c', y:no ? 0 : need});
    return bad('After a touchdown: 15-xp for the kick (15-xp-no if missed), 3 for a 2-point run, 7-88 for a 2-point pass.');
  }

  /* ---- punts and field goals ---- */
  if (has('punt')){
    const i = toks.indexOf('punt'), before = toks.slice(0, i);
    const kickSide = before.map(T).find(Boolean);
    if (kickSide && kickSide !== O) return bad(`The log has ${L(O)} with the ball. Set it first: ${L(kickSide)} ball at …`);
    const p = {t:'punt'};
    const kicker = before.filter(isNum)[0];
    if (kicker != null) p.k = kicker;
    const toR = s => s.side === D ? s.n : FL - s.n;              // a yard line as the receiving team sees it
    let rest = toks.slice(i + 1);
    // Read a punt the way a kickoff is read: "at the 30" is where the receiving team caught it, "for 8" is
    // the return. Nobody at the game measures the punt itself, and this way nobody has to.
    const pRaw = rawToks.slice(rawToks.indexOf('punt') + 1);
    const pAT = ['at', 'to', 'on', 'inside', 'near'], pYD = ['yard', 'yards', 'yd', 'yds'];
    const pRET = ['return', 'returns', 'returned', 'ret', 'rt', 'brought', 'ran', 'runs'];
    const bare = [], bareAt = [], ydAt = [], retNums = [];
    let ydNums = [];
    pRaw.forEach((t, n) => {
      if (!isNum(t) || +t < 0 || +t > FL / 2) return;
      let j = n - 1; while (j >= 0 && pRaw[j] === 'the') j--;
      if (j >= 0 && pAT.includes(pRaw[j]) && pRaw[n - 1] === 'the'){ bare.push(+t); bareAt.push(n); }   // "at the 30", never "to 30"
      let k = n - 1; while (k >= 0 && ['the', 'a', 'it'].includes(pRaw[k])) k--;
      if ((k >= 0 && pRaw[k] === 'for') || pYD.includes(pRaw[n + 1])) ydAt.push({v:+t, i:n});
      let m = n + 1; while (m < pRaw.length && ['the', 'it'].includes(pRaw[m])) m++;
      if (pRET.includes(pRaw[m])) retNums.push(+t);
    });
    // "40 yards" before the word "return" is the punt itself; yards said after the return word — or after where
    // it was caught ("at the 30 for 6") — are the return.
    const rIdx = pRaw.findIndex(t => pRET.includes(t)), cIdx = bareAt.length ? bareAt[0] : -1;
    ydNums = ydAt.filter(x => rIdx >= 0 ? x.i > rIdx : (cIdx >= 0 && x.i > cIdx)).map(x => x.v);
    const bareN = bare.length ? bare[0] : null;
    // "… I ball at I35": where the receiving team's drive starts.
    let start = null;
    const bi = rest.indexOf('ball');
    let saidSide = null;
    if (bi >= 0){
      const tail = rest.slice(bi + 1);
      start = tail.map(spotOf).find(Boolean) || (tail.includes(String(HALF)) ? {side:D, n:HALF} : null);
      if (!start) return bad(`Say where the drive starts, like ${L(D)} ball at ${L(D)}35.`);
      saidSide = rest.slice(0, bi).map(T).find(Boolean) || null;
      rest = rest.slice(0, bi).filter(t => !T(t));
    }
    if (has(...BLK_WORDS)){
      const after = rest.filter(isNum);
      p.res = 'blk'; if (after[0] != null) p.by = after[0]; if (after[1] != null) p.ret = after[1];
      // Blocked out of the back of the end zone: a safety for the other team, and nobody recovered it.
      if (has('safety', 'saf', 'sfty')){ p.saf = true; delete p.ret; return flag(p); }
      // The kicking team can fall on its own blocked punt, and "ball at …" says where it was recovered.
      const who = saidSide || rest.map(T).find(Boolean);
      if (who === O){ p.own = true; if (after[0] != null && after[1] == null){ p.ret = after[0]; delete p.by; } }
      if (start) p.b = st.spot - (start.side === O ? start.n : FL - start.n);
      if (has('td')) p.ry = st.spot;          // picked up at the line and returned the whole way
      return flag(p);
    }
    if (has('tb')){ p.res = 'tb'; return flag(p); }
    // "I2 return 10", "return-10", "return to I40": who returned it and how far.
    // A team-lettered number right before "return" is the returner, not a yard line.
    let retNo = null, retYds = null, retEnd = null;
    const ri = rest.findIndex(t => ['return', 'returned', 'returns', 'ret', 'rt'].includes(t));
    if (ri >= 0){
      // "to the I30 returned …": a yard line said with to/at/the before it is where it was caught, not a returner.
      const said = i => { const r = pRaw.indexOf(rest[i]); let j = r - 1; while (j >= 0 && pRaw[j] === 'the') j--; return r > 0 && j >= 0 && pAT.includes(pRaw[j]); };
      const prev = rest[ri - 1], ps = prev != null && !said(ri - 1) ? spotOf(prev) : null, ahead = rest.slice(ri + 1);
      const n = ahead.find(t => isNum(t) && !bare.includes(+t)), s = ahead.map(spotOf).find(Boolean);
      if (s) retEnd = s;
      else if (n != null) retYds = +n;   // a minus is a return for a loss (Chuck, 2026-10-23)
      else if (ydNums.length) retYds = ydNums[0];
      // Where the drive starts is given, so the distance comes from that: a number before "return" is a player.
      const kickNamed = start || rest.slice(0, Math.max(0, ri - 1)).some(t => isNum(t) || spotOf(t));
      if (ps && ps.side === D) retNo = String(ps.n);
      else if (prev != null && isNum(prev) && kickNamed && !bare.includes(+prev)) retNo = prev;
      rest = rest.slice(0, retNo != null ? ri - 1 : ri);
    }
    const muffP = muffOf(rest);
    const skip = bare.concat(ydNums, retNums.length ? [] : []);   // yard lines and return yards aren't the punt
    const after = (muffP ? muffP.before : rest.filter(isNum)).filter(t => {
      const k = skip.indexOf(+t); if (k < 0) return true; skip.splice(k, 1); return false;
    });
    const sp = muffP ? muffP.spot || muffP.beforeToks.map(spotOf).find(Boolean) : rest.map(spotOf).find(Boolean);   // "punt to I25" or a distance
    // "punt I30 I28", as a kickoff is typed: caught at the 30, returned to the 28 — a second yard line of the
    // receiving team's, with no return word, is where the return ended.
    if (!muffP && !retEnd && ri < 0){ const two = rest.map(spotOf).filter(Boolean); if (two.length === 2 && two[1].side === D && two[0].side === D) retEnd = two[1]; }
    // A punt can lose ground: one off the side of the foot that never crosses the line is minus yardage on the
    // punter (NCAA Section 6, Article 6). So a spot behind the line, or a typed "-5", keeps its sign.
    if (sp) p.d = (FL - toR(sp)) - st.spot;
    else if (bareN != null) p.d = (FL - bareN) - st.spot;                // caught at their 30
    else if (after[0] != null) p.d = +after[0] < 0 ? +after[0] : Math.abs(+after[0]);
    else if (start && retYds != null){
      // "5 punt 15 return 5 ball at SOU35": the ball was fielded retYds short of where the drive starts,
      // and the punt is however far that is from the line of scrimmage.
      const land = toR(start) - retYds, d = FL - land - st.spot;
      if (land < 0 || d < 0) return bad(`Those don’t add up: a ${retYds}-yard return ending at ${L(start.side)} ${start.n}.`);
      p.d = d;
    }
    else if (start && retYds == null && !retEnd) p.d = Math.max(0, (FL - toR(start)) - st.spot);   // no return
    const nx = sp || bareN != null ? after : after.slice(1);  // the older "19-punt-40-11-6" form
    const landR = p.d != null ? FL - (st.spot + p.d) : null;  // where the receiving team fielded it
    // "out of bounds" with a return on the line is the returner going out, not the kick: the return still counts.
    const retSaid = retNo != null || retYds != null || retEnd != null || ri >= 0;
    if (muffP){ p.res = 'muff'; if (muffP.by != null) p.by = muffP.by; if (muffP.ret != null) p.ret = muffP.ret; if (muffP.recSide === D) p.mr = true; }
    else if (has('fc')){ p.res = 'fc'; const r = retNo ?? nx[0]; if (r != null) p.ret = r; }
    else if (has('oob') && !retSaid) p.res = 'oob';
    else if (has('down', 'downed')) p.res = 'down';
    else {
      if (retEnd && landR != null) retYds = toR(retEnd) - landR;
      if (start && landR != null && retYds == null){ const r = toR(start) - landR; if (r > 0) retYds = r; }
      if (retYds == null && ydNums.length) retYds = ydNums[0];
      // "caught at the 30 and returned to the 38": both are the receiving team's, so the return is the gap.
      if (retYds == null && bare.length > 1) retYds = bare[1] - bare[0];
      if (retNo == null && nx[0] != null){ retNo = nx[0]; if (retYds == null && nx[1] != null) retYds = +nx[1]; }   // "19-punt-40-11--6": a loss of 6
      if (retNo != null || retYds != null || ri >= 0){ p.res = 'ret'; if (retNo != null) p.ret = retNo; if (retYds != null) p.ry = retYds; if (has('oob')) p.oob = true; }
      else p.res = 'spot';
      if (has('td') && p.d != null){ p.res = 'ret'; p.ry = st.spot + p.d; }
    }
    return flag(p);
  }
  if (has('fg')){
    const i = toks.indexOf('fg'), bi = toks.findIndex(t => BLK_WORDS.includes(t));
    const before = toks.slice(0, i).filter(isNum), after = toks.slice(i + 1, bi > i ? bi : undefined).filter(isNum);
    const p = {t:'fg', res:bi >= 0 ? 'blk' : has(...NO_WORDS) ? 'miss' : 'good'};
    if (before[0] != null) p.k = before[0];
    if (after[0] != null) p.d = Math.abs(+after[0]);
    if (bi >= 0){
      const bn = toks.slice(bi + 1).filter(isNum);
      if (bn[0] != null) p.by = bn[0];
      if (bn[1] != null) p.ret = bn[1];
      if (has('td')) p.ry = st.spot;
    }
    return flag(p);
  }

  /* ---- a jersey change: "5 is now 35", "N 5 changes to 35" ---- */
  if (has('jersey') || (has('now', 'changes', 'changed', 'switches', 'switched') && toks.filter(isNum).length >= 2)){
    const nums = toks.filter(isNum), side = toks.map(T).find(Boolean) || O;
    if (nums.length < 2) return bad('Which numbers? Like 5 is now 35.');
    return ok({t:'jersey', side, from:nums[0], to:nums[1]});
  }

  /* ---- a safety said as one: "3 tackled in the end zone", "7 sacked for a safety" ---- */
  if (has('safety', 'saf') && st.phase === 'play'){
    const nums = toks.filter(isNum);
    if (has('sack', 'sacked', 'sk')) return flag({t:'pass', qb:nums[0], res:'s', sy:st.spot, ...(nums[1] != null ? {by:nums[1]} : {})});
    return flag({t:'run', r:nums[0], y:-st.spot});
  }

  /* ---- runs and passes ---- */
  // The second fumble on a play, cut down to what the engine reads.
  const slim = f => ({lost:f.lost, ...(f.by != null ? {by:f.by} : {}), ...(f.at ? {at:f.at} : {}),
                      ...(f.td ? {td:true} : {}), ...(f.ez ? {ez:true} : {}), ry:f.ry});
  const withFum = p => {
    if (!fum) return p;
    // Where the ball came loose, in the offense's frame.
    const y = p.res === 's' ? -Math.min(p.sy, st.spot) : (+p.y || 0) + (p.lat ? +p.lat.y || 0 : 0), at = clamp(st.spot + y, 0, FL);
    let ry = fum.ry;
    // The offense fell on its own fumble somewhere else: the ball moves from where it came loose to there.
    if (fum.at && !fum.lost) ry = (fum.at.side === O ? fum.at.n : FL - fum.at.n) - at;
    if (fum.endSpot){
      const mine = fum.lost ? D : O, e = fum.endSpot;
      const endPos = e.side == null ? HALF : e.side === mine ? e.n : FL - e.n;   // in the recovering team's frame
      ry = endPos - (fum.lost ? FL - at : at);
      // Far behind the recovery is almost always the wrong team letter on the yard line.
      if (ry < -10){
        const recPos = fum.lost ? FL - at : at;
        // Team short names, not letters: "where I recovered it" reads like the pronoun.
        const nameOf = s => g.teams[s].abbr || L(s);
        const ylq = pos => pos === HALF ? String(HALF) : pos < HALF ? `${nameOf(mine)} ${fy(pos)}` : `${nameOf(other(mine))} ${fy(FL - pos)}`;
        fumErr = `That's ${fy(-ry)} yards backward from where ${nameOf(mine)} recovered it (the ${ylq(recPos)}). Check the yard line${e.side ? `: ball on ${L(other(e.side))}${e.n}?` : '.'}`;
      }
    }
    if (fum.td) ry = at;                     // the recovering team runs it back the whole way
    p.fum = {lost:fum.lost, ...(fum.by != null ? {by:fum.by} : {}), ...(fum.self ? {self:true} : {}), ...(fum.at ? {at:fum.at} : {}), ...(fum.td ? {td:true} : {}), ...(fum.ez ? {ez:true} : {}), ...(fum.ff ? {ff:fum.ff} : {}), ry, ...(fum.then ? {endLost:!!fum.endLost, then:slim(fum.then)} : {})};
    return p;
  };
  /* ---- a lateral: "8-5 lateral 11-35" is #8 for 5, then #11 for 35 more ---- */
  const li = toks.findIndex(t => ['lateral', 'laterals', 'lateraled', 'lat', 'pitch', 'pitches', 'pitched'].includes(t));
  if (li >= 0 && st.phase === 'play'){
    const a = toks.slice(0, li).filter(isNum), b = toks.slice(li + 1).filter(isNum);
    if (a.length < 2 || !b.length) return bad('A lateral takes both: 8-5 lateral 11-35 is #8 for 5, then #11 for 35 more.');
    return flag(withFum({t:'run', r:a[0], y:+a[1], lat:{r:b[0], y:+(b[1] || 0)}}));
  }

  // "aug 15 …": the runner or passer named with his team, which has to be the team with the ball.
  if (toks.length > 1 && T(toks[0]) && isNum(toks[1])){
    const s = T(toks[0]);
    if (s !== O) return bad(`The log has ${g.teams[O].abbr || L(O)} with the ball. If ${g.teams[s].abbr || L(s)} has it, set that first: ${L(s)} ball at ${L(s)}__.`);
    toks = toks.slice(1);
  }
  const runV = toks.includes('rn'); toks = toks.filter(t => t !== 'rn');   // said "runs", so it's a run
  const nums = toks.filter(t => isNum(t) || t === 'team'), td = has('td'), toGoal = FL - st.spot;
  // A kneel-down is TEAM's, never the quarterback's: "kneel" loses 1 unless told otherwise.
  if (has('kneel', 'kneels', 'kneeled', 'kn', 'victory')){
    const n = nums.find(x => x !== 'team');
    return flag(withFum({t:'run', r:'team', y:-Math.abs(n != null ? +n : 1)}));
  }
  if (has('inc', 'incomplete', 'incomp')) return flag({t:'pass', qb:nums[0], res:'i', ...(nums[1] != null ? {to:nums[1]} : {}), ...(tk[0] ? {pbu:tk[0]} : {})});
  if (has('int', 'pick', 'picked', 'intercepted')){
    // Two bare numbers after the man who picked it: yard lines or yards? Don't guess.
    if (nums.length > 3) return bad(`Name the yard lines with a team: ${nums[0]}-int-${nums[1]}-${L(D)}30-${L(D)}45 is picked at the ${L(D)} 30 and returned to the ${L(D)} 45.`);
    const p = {t:'pass', qb:nums[0], res:'x', at:0, ry:nums[2] != null ? Math.abs(+nums[2]) : 0};
    if (nums[1] != null) p.ib = nums[1];
    // "2-int-2-S10": where it was picked off ("ez" = in the end zone); a second yard line is where the return ended.
    const spots = toks.map(spotOf).filter(Boolean), ez = has('ez', 'endzone');
    const posO = s => s.side === O ? s.n : FL - s.n;              // yards from the passing team's goal
    if (ez) p.at = FL - st.spot; else if (spots[0]) p.at = posO(spots[0]) - st.spot;
    const endAt = spots[ez ? 0 : 1], caught = st.spot + p.at;
    if (endAt) p.ry = caught - posO(endAt);                        // the defense runs back toward the passer's goal
    if (td && !fum) p.ry = caught;
    // A fumble on the return: "lost" now means the intercepting team lost it, back to the passing team.
    if (fum){
      const lost = fum.rs ? fum.rs !== D : !fum.selfRec, rec = lost ? O : D;
      const fin = FL - clamp(caught, 0, FL) + p.ry;                  // where it came loose, in the intercepting team's frame
      if (fin >= FL) return bad('That return already reached the end zone, so there was no fumble on it. Leave off the fum part.');
      let ry = fum.ry;
      // Recovered somewhere other than where it came loose ("rec W28 at C45"): the return runs from there.
      const recPos = fum.at ? (fum.at.side === rec ? fum.at.n : FL - fum.at.n) : (lost ? FL - fin : fin);
      if (fum.endSpot){
        const e = fum.endSpot, endPos = e.side == null ? HALF : e.side === rec ? e.n : FL - e.n;
        ry = endPos - recPos;
      }
      if (fum.tdLine) ry = FL - recPos;
      p.fum = {lost, ...(fum.by != null ? {by:fum.by} : {}), ...(fum.self || (fum.selfRec && fum.by == null) ? {self:true} : {}), ...(fum.ez ? {ez:true} : {}),
        ...(fum.at ? {at:fum.at} : {}), ...(fum.ff ? {ff:fum.ff} : {}), ry};
    }
    return flag(p);
  }
  if (has('sack', 'sacked', 'sk')){
    const by = nums.slice(2).length ? nums.slice(2) : tk.slice(0, 2);
    return flag(withFum({t:'pass', qb:nums[0], res:'s', sy:Math.abs(+(nums[1] || 0)), by}));
  }
  if (nums.length === 1 && td) return flag(withFum({t:'run', r:nums[0], y:toGoal}));
  if (nums.length === 2){
    const [a, b] = nums;
    // "15-0-td": a TD whose second number isn't the distance to the goal is a pass to that player.
    if (td && !runV && Math.abs(+b - toGoal) > 1) return flag({t:'pass', qb:a, res:'c', to:b, y:toGoal});
    return flag(withFum({t:'run', r:a, y:td ? toGoal : +b}));
  }
  if (nums.length === 3){ const [a, b, c] = nums; return flag(withFum({t:'pass', qb:a, res:'c', to:b, y:td ? toGoal : +c})); }
  if (nums.length === 1) return bad(`Add the yards: ${nums[0]}-5 is #${nums[0]} running for 5.`);
  return bad(`Didn't catch that. Try 3-10 (run), 7-88-5 (pass), 7-inc, ${L(O)} punt, or ${L(D)} ball at ${L(D)}20.`);
}

/* ---------- quick-entry pad ---------- */
function cheatHtml(a, h){
  const sa = String(g.teams.A.abbr || a).toLowerCase(), sh = String(g.teams.H.abbr || h).toLowerCase();
  const rows = [
    [`${sa} 15 runs for 15 yards tackled by ${sh} 54 3:54`, `Or just type what happened. The preview shows how it read the line before you record it.`],
    [`${sa} 7 passes to 88 for 12 yards tackled by ${sh} 20`, '#7 completes to #88 for 12, tackled by #20. Also: incomplete, sacked by … for a loss of 6, intercepted by …'],
    [`${sa} 5 runs for 3 fumbles recovered by ${sh} 31`, `Fumble, ${sh.toUpperCase()}'s #31 recovers. Also: punts 40 yards returned by ${sh} 2 for 10, field goal, extra point, fair catch, touchback.`],
    [`penalty on ${sa} false start`, 'Penalties by name: holding, false start, pass interference, personal foul, face mask, delay of game and more.'],
    [`${a}8 runs for 9 yards &nbsp;·&nbsp; ${a}8-9`, `Mix them: the team letter stuck to the number is ${g.teams.A.name}'s #8.`],
    [`${a} ball at ${a}35 1-10`, `${g.teams.A.name} ball, 1st & 10 at its own 35. Down and distance are optional (1st & 10 if left off; use 1-g for goal to go).`],
    ['3-10', '#3 runs for 10'],
    ['3--1 &nbsp;or&nbsp; 3-(-1)', '#3 runs for a loss of 1'],
    ['kneel &nbsp;·&nbsp; kneel-2', 'Kneel-down, charged to TEAM, not the quarterback: a 1-yard loss unless you give the yards'],
    ['team--20', 'A team play, like a snap over the punter’s head: TEAM rush for a loss of 20. It counts in team rushing, not against any player.'],
    ['8-5 lateral 11-35', 'A lateral: #8 for 5, then #11 for 35 more. Each keeps the yards he made; the carry is #8’s.'],
    ['3 tackled in the end zone for a safety', 'A safety in words. So is 7 sacked in the end zone for a safety.'],
    ['19-punt-40-muff-44 &nbsp;·&nbsp; 15-ko-55-muff-28', 'Muffed by the receiving team and recovered by the kicking team, which keeps the ball.'],
    ['3-td', '#3 runs it in from wherever the ball is'],
    ['7-88-5', '#7 completes to #88 for 5'],
    ['15-0-50-td', '#15 to #0, 50-yard touchdown'],
    ['7-inc &nbsp;·&nbsp; 7-inc-88', 'Incomplete (intended for #88)'],
    ['7-sack-6-90', '#7 sacked for a loss of 6 by #90'],
    [`7-int-24-${h}10 &nbsp;·&nbsp; 7-int-24-${h}10-${h}40`, `#7 intercepted by #24 at the ${h} 10 / and returned to the ${h} 40. Without a yard line the pick is placed at the line of scrimmage.`],
    [`7-int-24-${h}10-12 &nbsp;·&nbsp; 7-int-24-td &nbsp;·&nbsp; 7-int-24-ez`, 'Returned 12 yards / returned for a touchdown / picked off in the end zone (a touchback if not returned)'],
    [`7-int-24-${h}10-${h}40 fum ${a} rec 22`, `Picked off, returned to the ${h} 40, then fumbled; ${a}'s #22 recovers and the ball goes back to ${a}. Add td if the recovery was run in.`],
    [`5-5-fum-rec-${h}31-1`, `#5 runs for 5 and fumbles; ${h}'s #31 recovers and advances 1. Just fum ${h} rec if you don't know who.`],
    [`5-5-fum ff 44 ${h} rec 31`, `Add ff and a number for who forced it (or say forced by 44). It always goes to the defense.`],
    [`5-5-fum-rec-${h}10 ball on ${a}24`, 'Same, with the advance worked out from where the next snap is.'],
    ['22--5 fum tb', 'Fumbled out of bounds beyond a goal line, nobody on it: a touchback through their end zone, a safety out of your own.'],
    [`10-0 fum ${h} rec td`, `Fumble, ${h} recovers and returns it for a touchdown.`],
    [`10-1 fum ${a} rec to ${a}34 fum ${h}34 rec at ${a}35`, `Two fumbles on one play: ${a.toUpperCase()} falls on the first one and carries it to its 34, then loses it to ${h.toUpperCase()}'s #34 at the 35.`],
    ['8-5 lateral 11-35 fum ' + h + ' rec 21', 'A fumble after a lateral: the man who took the pitch is the one who put it on the ground.'],
    [`1-sack-13 fum rec 6 at ${h}6 td`, `Add at ${h.toUpperCase()}6 when the ball was recovered somewhere else than where it came loose. Works on any fumble.`],
    [`punt 40 5 return 10 fum ${a} rec 22`, `A fumble on a punt or kickoff return: say the return first, then who recovered.`],
    [`${a} punt ${h} ball at ${h}25`, `Punt with no return: ${h}'s drive starts at its 25. Or just ${a} punt, then ${h} ball at ${h}25 on the next line.`],
    [`${a} punt to ${h}25-${h}2 return-10`, `Fielded at the ${h} 25, #2 returns it 10. Leave off the yards and type the drive start next (${h} ball at ${h}35); the return fills in.`],
    ['punt-11-at the 30-for 6 &nbsp;·&nbsp; 19-punt-40-11-6', 'Caught at their 30, back 6 — the punt’s own distance works itself out. Or say it the short way: #19 punts 40, #11 returns it 6. Also punt-tb, punt-fc, punt-oob, punt-blk. With a return on the line, oob means the returner ran out of bounds.'],
    ['13 punt blk 55 22 &nbsp;·&nbsp; 13 punt blk 55 ' + h + ' rec 20 ball at ' + h.toUpperCase() + '43', 'Blocked by #55 and recovered by the other team\u2019s #22 / by the kicking team\u2019s own #20, with where it was recovered. Add td if it was run in. blk, block or blocked all work.'],
    ['13 punt blk 55 safety', 'Blocked by #55 and out of the back of the end zone: a safety for the other team.'],
    [`19 punt 11 return 5 ball at ${h}35`, `Give the return and where the drive starts and the punt's distance is worked out: #19 punts, #11 returns 5, ${h} ball at its 35.`],
    ['15-fg &nbsp;·&nbsp; 15-fg-no', 'Field goal good / no good (distance fills in)'],
    ['15-xp &nbsp;·&nbsp; 15-xp-no', 'Kick after a touchdown. For 2 points: 3 (run) or 7-88 (pass), add -no if it failed'],
    [`ko-${a}25 &nbsp;·&nbsp; ko-${a}25-3:25`, `Kickoff; the drive starts at the ${a} 25 (with 3:25 left). No need to say who kicked. After a touchdown, enter the extra point first.`],
    ['15-ko-tb &nbsp;·&nbsp; 15-ko-55-28-21', 'Kickoff with details: touchback / 55 yards, #28 returns it 21. Also 15-ko-oob.'],
    ['15-ko-onside-44 &nbsp;·&nbsp; ko onside ' + h + ' rec 44', 'Onside kick recovered by the kicking team\u2019s #44. The other team\u2019s letter instead means they fell on it. Add at ' + h.toUpperCase() + '48 for where.'],
    ['ko-28-at the 8-for 12 &nbsp;·&nbsp; 28 caught the kickoff at the 8 and ran it to the 20', 'Never type how far it was kicked: say where it was caught and how far it came back. Both yard lines are the receiving team’s.'],
    [`pen ${h} 15 pf`, `15 yards on ${h}. Codes: fs off hold pi pf fm uc rtp ig dog and more. Add 1st for an automatic first down.`],
    [`pen ${a} 10 pen ${h} 10 &nbsp;·&nbsp; offsetting pen`, 'Flags on both teams: they cancel and the down is played again. Neither one counts in the totals.'],
    [`3-12 pen ${a} 10 hold np`, 'Flag wipes out the play (np = no play). Without np, the yards add on to the end of the play.'],
    [`22-12 pen ${a} 15 uc db`, 'A dead-ball foul (db) after the play: the play counts, a first down earned on it stays 1st & 10, and the yards are marked off from there.'],
    [`pen ${h} 10 ball spot 35 &nbsp;·&nbsp; pen ${h} 10 foul at the 25`, 'A spot foul, marched off from where it happened rather than the line of scrimmage. Say where the ref put the ball, or where the foul was.'],
    [`to ${a}`, `${g.teams.A.name} timeout`],
    ['28 is now 35', 'A jersey change. From there on #35 is that player: the play-by-play shows the number he is wearing, the box score keeps one line.'],
    ['eoq', 'End of the quarter (at halftime: eoq S = S kicks off)'],
    ['3-10 8:40 @54', 'Optional: a clock time anywhere on the line (it also sets the game clock), tacklers with @'],
    ['undo', 'Remove the last play']];
  return `<p class="hint" style="margin-top:6px"><b>td</b> always means a touchdown was scored. On a run or pass it's the offense's; on an interception or a fumble the other team recovered, it's the defense's. A line marked td that doesn't score is refused.</p>
    <div class="tbl-wrap"><table><tbody>${rows.map(([c, m]) => `<tr><td><code>${c}</code></td><td>${esc(m)}</td></tr>`).join('')}</tbody></table></div>`;
}
function quickHtml(){
  const {key} = quickTeams(), a = key.A.toUpperCase(), h = key.H.toUpperCase(), editing = ui.editing != null;
  const keys = [a, h, 'ball at', '-', 'inc', 'td', 'punt', 'fg', 'xp', 'int', 'sack', 'fum', 'pen', 'to'];
  const mic = canVoice() ? `<button type="button" class="qmic" id="qmic" data-qmic aria-pressed="false" aria-label="Call the play out loud">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"/><path fill="currentColor" d="M18 11a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.92V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.08A6 6 0 0 0 18 11Z"/></svg></button>` : '';
  return `<div class="quick">
    <div class="qrow">
      <input id="qk" class="qk" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
        aria-label="Type the play" placeholder="3-10 · 7-88-5 · ${esc(String(g.teams.A.abbr || a).toLowerCase())} 15 runs for 15" value="${esc(ui.qtext || '')}">${mic}
    </div>
    <div class="qheard" id="qheard" aria-live="polite" hidden></div>
    <div class="qkeys">${keys.map(k => `<button type="button" class="qkey" data-qkey="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    <div class="qprev" id="qprev" aria-live="polite"></div>
    <div class="actions"><button class="btn primary" id="qrec">${ui.ins ? 'Add play' : editing ? 'Save changes' : 'Record'}</button>
      ${editing ? '<button class="btn" data-cancel-edit>Cancel</button>' : `<button class="btn" data-undo ${g.plays.length ? '' : 'disabled'}>Undo last</button>`}</div>
    <p class="hint"><b>${a}</b> = ${esc(g.teams.A.name)} · <b>${h}</b> = ${esc(g.teams.H.name)} · Enter records the play</p>
    <details class="cheat" ${ui.cheat ? 'open' : ''}><summary>Shorthand</summary>${cheatHtml(a, h)}</details>
  </div>`;
}
// Parse a line against the situation before it, and hold "td" to its word: it must score one.
function quickResult(line){
  const idx = ui.editing ?? g.plays.length, st = ui.ctx.st;
  const r = parseQuick(line, st);
  if (!r || r.error || r.undo) return {r};
  const rr = replay({...g, plays:[...g.plays.slice(0, idx), r.play]});
  if (st.phase !== 'try' && tokenize(line).some(t => TD_WORDS.includes(t)) && !rr.scoring.slice(ui.ctx.scoring.length).some(e => e.how === 'TD')){
    const msg = st.ot ? 'In overtime the ball is dead as soon as the defense takes it, so it can’t be returned for a score.'
      : 'You marked td, but this line doesn’t score one. Check who has the ball and where, or say who scored: 7-int-24-td, 10-0 fum S rec td.';
    return {r:{error:msg}};
  }
  return {r, rr};
}
function quickPreview(){
  const el = $('#qprev'); if (!el) return;
  const {r, rr} = quickResult(ui.qtext);
  el.className = 'qprev';
  if (!r){ el.innerHTML = `<span class="eyebrow">Now</span><div class="next">${esc(ui.ctx.sit)}</div>`; return; }
  if (r.error){ el.className = 'qprev err'; el.textContent = r.error; return; }
  if (r.undo){ el.textContent = g.plays.length ? 'Removes the last play.' : 'Nothing to undo yet.'; return; }
  const last = rr.log[rr.log.length - 1];
  let tip = '';
  if (r.play.t === 'punt' && !/\bball\b/i.test(ui.qtext) && ['spot', 'ret'].includes(r.play.res) && (r.play.d == null || r.play.ry == null)){
    const R = quickTeams().key[other(ui.ctx.st.poss)].toUpperCase();
    tip = `<div class="hint">Next, type where the drive starts — ${R} ball at ${R}__ — and the ${r.play.d == null ? 'punt distance' : 'return'} fills in.</div>`;
  }
  if (r.play.t === 'ko' && r.play.d == null && r.play.res === 'spot'){
    const R = quickTeams().key[other(ui.ctx.st.poss)].toUpperCase();
    tip = `<div class="hint">Next, type where the return ended — ${R} ball at ${R}__ — and the kick fills in.</div>`;
  }
  if (r.play.t === 'set' && ui.ctx.st.phase === 'try'){
    const S = quickTeams().key[ui.ctx.st.poss].toUpperCase();
    tip = `<div class="hint">No extra point recorded for ${S}. If there was one, type it first: 15-xp or 15-xp-no.</div>`;
  }
  el.className = 'qprev ok';
  el.innerHTML = `<div>${last.wiped ? `<s>${esc(last.wiped)}</s> ` : ''}${esc(last.text)}</div><div class="next">Then: ${esc(rr.sit)}</div>${tip}`;
}
function recordQuick(){
  const {r} = quickResult(ui.qtext);
  if (!r) return;
  if (r.error){ const el = $('#qprev'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); return; }
  ui.qtext = ''; voiceClear();
  if (r.undo){ undo(); return focusQuick(); }
  const p = JSON.parse(JSON.stringify(r.play));
  if (ui.editing != null && ui.ins){
    if (p.clk == null) p.clk = insClock(ui.editing);
    g.plays.splice(ui.editing, 0, p); ui.editing = null; ui.ins = false; ui.open = null;
    save(); refresh(); return toast('Play added');
  }
  if (ui.editing != null){
    const old = g.plays[ui.editing];
    if (p.clk == null && old.clk != null) p.clk = old.clk;
    g.plays[ui.editing] = p; ui.editing = null; ui.qedit = false; ui.open = null;
    save(); refresh(); return toast('Play updated');
  }
  if (p.t === 'endq'){ endq(p.kick, p.q); return focusQuick(); }
  // A time typed on the line also resets the scoreboard clock to it.
  if (p.clk != null && R.st.q <= 4){ g.clk = {s:p.clk, run:g.clk.run, at:Date.now()}; g.clkUsed = true; }
  if (p.clk == null && R.st.q <= 4 && clockUsed(g)) p.clk = Math.ceil(clockNow());
  if (p.t === 'to' || p.t === 'final') g.clk = {s:clockNow(), run:false, at:Date.now()};
  stopClockFor(p);
  g.plays.push(p); save(); refresh(); focusQuick();
  toast(p.t === 'set' ? 'Spot set' : 'Recorded');
}
// While the mic is on he isn't typing, so don't bring the phone's keyboard back up between plays.
function focusQuick(){ if (voiceListening()) return; const q = $('#qk'); if (q) q.focus(); }
function insertKey(k){
  const inp = $('#qk'); if (!inp) return;
  let v = inp.value;
  if (k === '-') v += '-';
  else if (k === 'ball at') v = v.replace(/\s+$/, '') + (v.trim() ? ' ' : '') + 'ball at ';
  else if (/^[a-z]$/i.test(k)) v += (v && !/[\s-]$/.test(v) ? ' ' : '') + k.toUpperCase();
  else v += (v && !/[\s-]$/.test(v) ? '-' : '') + k;
  inp.value = v; ui.qtext = v; inp.focus(); inp.setSelectionRange(v.length, v.length); quickPreview();
}
/* ---------- calling the play out loud: the phone's own speech recognition ---------- */
/* Phones only. The words land in the entry box and nothing else — the preview reads them the way a typed
   line reads, and the play is recorded only when Record is pressed. A bad hearing is a line to fix, never
   a play in the game. */

const ON_PHONE = () => (window.KMS_DEVICE ? window.KMS_DEVICE !== 'other' : /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent || ''));
const VOICE_API = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const canVoice = () => !!(ON_PHONE() && VOICE_API() && window.isSecureContext);

const ONES = {zero:0, oh:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
  eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19};
const TENS = {twenty:20, thirty:30, forty:40, fourty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90};
const ORD = {first:1, second:2, third:3, fourth:4, '1st':1, '2nd':2, '3rd':3, '4th':4};

// What was said, in the shape the parser already reads. Numbers are the whole job: a phone writes some of
// them as digits and some as words, and the same sentence has to read the same either way.
function voiceText(raw){
  let s = ' ' + String(raw || '').toLowerCase().replace(/[,!?]/g, ' ').replace(/\.(?=\s|$)/g, ' ') + ' ';
  const tens = Object.keys(TENS).join('|'), ones = Object.keys(ONES).join('|');
  s = s
    .replace(new RegExp(`\\b(${tens})[\\s-]+(${ones})\\b`, 'g'), (m, a, b) => ` ${TENS[a] + ONES[b]} `)   // "twenty two"
    .replace(new RegExp(`\\b(${tens})\\b`, 'g'), (m, a) => ` ${TENS[a]} `)
    .replace(new RegExp(`\\b(${ones})\\b`, 'g'), (m, a) => ` ${ONES[a]} `)
    // "first and ten", "3rd and goal" — the down and distance, said the way it shows on the board
    .replace(/\b(first|second|third|fourth|1st|2nd|3rd|4th|[1-4])\s+(?:and|&)\s+(goal|g|\d{1,2})\b/g,
      (m, d, t) => ` ${ORD[d] || d}-${/^g/.test(t) ? 'g' : t} `)
    .replace(/\b(\d{1,2})\s+yard\s+line\b/g, ' $1 ')
    .replace(/\bnumber\s+(\d{1,3})\b/g, ' $1 ');
  return s.replace(/\s+/g, ' ').trim();
}

let voice = null;          // the live recogniser, when it is listening
let voiceHeard = '';       // the last thing it heard, shown while listening

function voiceStop(){
  const r = voice; voice = null;
  if (r){ r.onend = null; try { r.stop(); } catch (e) {} }
  voiceHeard = ''; voicePaint();
}
function voiceStart(){
  const API = VOICE_API(); if (!API) return;
  const r = new API();
  r.lang = 'en-US'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
  r.onresult = e => {
    let said = '', done = false;
    for (let i = e.resultIndex; i < e.results.length; i++){
      const res = e.results[i];
      if (res[0]) said = res[0].transcript;
      if (res.isFinal) done = true;
    }
    if (!said.trim()) return;
    voiceHeard = said.trim();
    const line = voiceText(said);
    const inp = $('#qk'); if (inp) inp.value = line;
    ui.qtext = line; quickPreview(); voicePaint();
  };
  // A phone stops listening on its own after a pause; pick it straight back up until the mic is turned off.
  // If it keeps dropping the moment it starts, something is wrong with it — stop rather than spin on the battery.
  let spun = 0, went = Date.now();
  r.onend = () => {
    if (voice !== r) return;
    spun = Date.now() - went < 400 ? spun + 1 : 0;
    if (spun > 5){ voice = null; voicePaint(); return toast('The microphone keeps dropping out'); }
    went = Date.now();
    try { r.start(); } catch (e) { voice = null; voicePaint(); }
  };
  r.onerror = e => {
    const why = e && e.error;
    if (why === 'no-speech' || why === 'aborted') return;          // ordinary silence: onend restarts it
    voice = null; voicePaint();
    toast(why === 'not-allowed' || why === 'service-not-allowed' ? 'The microphone is blocked for this site'
      : why === 'network' ? 'No signal for the microphone' : 'The microphone stopped');
  };
  try { r.start(); } catch (e) { return toast('The microphone would not start'); }
  voice = r; voiceHeard = ''; voicePaint();
}
function voiceToggle(){ if (voice) voiceStop(); else voiceStart(); }
function voiceListening(){ return !!voice; }
// The play was recorded: forget what was said so the line under the box belongs to the next one.
function voiceClear(){ if (!voice) return; voiceHeard = ''; voicePaint(); }

// Just the mic button and the heard line, so a word arriving mid-sentence doesn't redraw the entry box.
function voicePaint(){
  const b = $('#qmic'); if (b){ b.classList.toggle('on', !!voice); b.setAttribute('aria-pressed', voice ? 'true' : 'false'); }
  const h = $('#qheard'); if (!h) return;
  h.hidden = !voice;
  h.textContent = voice ? (voiceHeard ? `“${voiceHeard}”` : 'Listening…') : '';
}
/* ================================================================
   Excel export: a real .xlsx workbook built in the browser — a zip
   of spreadsheet XML, one sheet per stat group — with no library.
   ================================================================ */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b){ let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

// An uncompressed ("stored") zip: exactly what Excel expects inside an .xlsx.
function zipStore(files){
  const enc = new TextEncoder(), parts = [], central = [];
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let offset = 0;
  for (const f of files){
    const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, size, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

const xesc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]))
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');   // characters XML can't hold
const colName = i => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
const XL_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const XL_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XL_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const XL_STYLES = `${XL_HEAD}<styleSheet xmlns="${XL_NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>`
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

// rows: arrays of cells (numbers stay numbers so Excel can sort and sum); a row marked .bold is a header.
function sheetXml(rows){
  const widths = [];
  const body = rows.map((row, r) => `<row r="${r + 1}">${(row || []).map((v, c) => {
    if (v === '' || v == null) return '';
    widths[c] = Math.max(widths[c] || 0, String(v).length);
    const ref = colName(c) + (r + 1), s = row.bold ? ' s="1"' : '';
    return typeof v === 'number' && isFinite(v) ? `<c r="${ref}"${s}><v>${v}</v></c>`
      : `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const cols = Array.from(widths, (w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(70, Math.max(6, (w || 0) + 2))}" customWidth="1"/>`).join('');
  return `${XL_HEAD}<worksheet xmlns="${XL_NS}">${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${body}</sheetData></worksheet>`;
}
function xlsxBlob(sheets){
  const used = new Set();
  sheets.forEach(s => { let n = s.name.replace(/[\[\]:*?\/\\]/g, '').slice(0, 31) || 'Sheet'; while (used.has(n)) n = n.slice(0, 29) + '_'; used.add(n); s.name = n; });
  const files = [
    {name:'[Content_Types].xml', data:`${XL_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '</Types>'},
    {name:'_rels/.rels', data:`${XL_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${XL_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:'xl/workbook.xml', data:`${XL_HEAD}<workbook xmlns="${XL_NS}" xmlns:r="${XL_REL}"><sheets>${sheets.map((s, i) => `<sheet name="${xesc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`},
    {name:'xl/_rels/workbook.xml.rels', data:`${XL_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="${XL_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${sheets.length + 1}" Type="${XL_REL}/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml', data:XL_STYLES},
    ...sheets.map((s, i) => ({name:`xl/worksheets/sheet${i + 1}.xml`, data:sheetXml(s.rows)}))
  ];
  return zipStore(files);
}

// The open game as sheets: summary, team stats, each player stat group, drives, play-by-play.
function gameSheets(){
  const st = R.st, T = g.teams, S = R.S, both = ['A', 'H'];
  const hdr = a => Object.assign(a, {bold:true});
  const num = n => /^\d+$/.test(String(n)) ? Number(n) : String(n);
  const cell = v => typeof v === 'number' ? v : /^-?\d+(\.\d+)?$/.test(String(v)) ? Number(v) : String(v);
  const avg1 = (y, n) => n ? Math.round(y / n * 10) / 10 : 0;
  const P = (name, heads, keep, row, key) => ({name, rows:[hdr(['Team', '#', 'Name', ...heads]),
    ...both.flatMap(s => Object.values(S.pl[s]).filter(keep).sort((a, b) => (b[key] || 0) - (a[key] || 0))
      .map(p => [T[s].abbr, p.n === 'team' ? '' : num(p.n), p.n === 'team' ? 'TEAM' : rosterName(s, p.n), ...row(p)]))]});
  const cols = lineCols(st);
  const summary = [
    hdr([`${T.A.name} at ${T.H.name}`]),
    ['Date', new Date(g.created).toLocaleDateString()],
    ['Game', rulesOf(g).men === 8 ? '8-man' : '11-man'],
    ['Status', st.final ? 'Final' : `In progress, ${perLabel(st.q)}`],
    [],
    hdr(['Team', ...cols.map(i => i < 4 ? `Q${i + 1}` : colLabel(i)), 'Total']),
    ...both.map(s => [T[s].name, ...cols.map(i => qCell(st, s, i)), st.score[s]]),
    [],
    hdr(['Scoring plays']),
    hdr(['Qtr', 'Clock', 'Team', 'Play', T.A.abbr, T.H.abbr]),
    ...R.scoring.map(e => [perLabel(e.q), e.clk != null ? mmss(e.clk) : '', T[e.side].abbr, e.desc, e.A, e.H])];
  return [
    {name:'Summary', rows:summary},
    {name:'Team stats', rows:[hdr(['Team stats', T.A.abbr, T.H.abbr]), ...teamRows().map(([l, f]) => [l, cell(f('A')), cell(f('H'))])]},
    P('Passing', ['Comp', 'Att', 'Yds', 'TD', 'Int', 'Long', 'Sacked', 'Sack yds'], p => p.pa || p.psk, p => [p.pc, p.pa, p.py, p.ptd, p.pint, p.plg, p.psk, p.pskY], 'py'),
    P('Rushing', ['Car', 'Yds', 'Avg', 'TD', 'Long'], p => p.ru, p => [p.ru, p.ry, avg1(p.ry, p.ru), p.rtd, p.rlg], 'ry'),
    P('Receiving', ['Rec', 'Yds', 'Avg', 'TD', 'Long'], p => p.re, p => [p.re, p.rey, avg1(p.rey, p.re), p.retd, p.relg], 'rey'),
    P('Defense', ['Solo', 'Ast', 'Total', 'TFL', 'Sacks', 'Int', 'Int yds', 'PBU', 'FF', 'FR', 'Blocked kicks'],
      p => p.tk || p.ast || p.sk || p.dint || p.pbu || p.ff || p.fr || p.bk,
      p => [p.tk, p.ast, p.tk + p.ast, p.tfl, p.sk, p.dint, p.dintY, p.pbu, p.ff, p.fr, p.bk], 'tk'),
    P('Kicking', ['FGM', 'FGA', 'FG long', 'XPM', 'XPA', 'Kickoffs', 'KO yds', 'Touchbacks'], p => p.fga || p.xpa || p.ko,
      p => [p.fgm, p.fga, p.fglg, p.xpm, p.xpa, p.ko, p.koy, p.ktb], 'fga'),
    P('Punting', ['Punts', 'Yds', 'Avg', 'Long', 'Inside 20', 'Touchbacks'], p => p.pu, p => [p.pu, p.puy, avg1(p.puy, p.pu), p.pulg, p.pi20, p.ptb], 'pu'),
    P('Returns', ['KR', 'KR yds', 'KR long', 'KR TD', 'PR', 'PR yds', 'PR long', 'PR TD'], p => p.kr || p.pr,
      p => [p.kr, p.kry, p.krlg, p.krtd, p.pr, p.pry, p.prlg, p.prtd], 'kry'),
    P('Scoring', ['TD', '2-pt', 'XP', 'FG', 'Points'], p => p.pts, p => [p.tds, p.two, p.xpm, p.fgm, p.pts], 'pts'),
    {name:'Drives', rows:[hdr(['Team', 'Qtr', 'Clock', 'Start', 'Plays', 'Yards', 'Time', 'Result']),
      ...R.drives.map(d => [T[d.team].abbr, perLabel(d.q), d.clk != null ? mmss(d.clk) : '', R.yl(d.team, d.start), d.plays,
        Math.round(d.last - d.start), d.time != null ? mmss(d.time) : '', d.res])]},
    {name:'Play-by-play', rows:[hdr(['Play', 'Qtr', 'Clock', 'Offense', 'Situation', 'Typed', 'Play', T.A.abbr, T.H.abbr]),
      ...R.log.map(e => [e.i + 1, perLabel(e.q), e.clk != null ? mmss(e.clk) : '', T[e.poss] ? T[e.poss].abbr : '', e.sit, e.src || '',
        (e.wiped ? `[${e.wiped}] ` : '') + e.text, e.A, e.H])]}];
}
function saveBlob(blob, name){
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function downloadXlsx(){
  const name = `${g.teams.A.abbr}-at-${g.teams.H.abbr}-${new Date(g.created).toISOString().slice(0, 10)}.xlsx`.toLowerCase().replace(/[^a-z0-9.\-]+/g, '-');
  saveBlob(xlsxBlob(gameSheets()), name);
  toast('Excel file saved');
}
/* ================================================================
   Importing someone else's gamecast (TurboStats).

   A crew keeping a game on TurboStats publishes it at
   turbogamecast.com/football/webcast/<id>, and the same game comes back
   as data from their API. Every play in it — who carried, who threw,
   how far, from where — is turned into this site's own plays, so the
   game arrives as a real game: the gamecast, the box score, the drive
   chart and every player's stats are worked out here, from the plays,
   exactly as they are for a game kept in the press box.

   Nothing is guessed. A play this doesn't understand is left out and
   counted, and the import says how many and what they were, so a game
   that came over short is obvious rather than quietly wrong. The score
   is checked against theirs, play by play.
   ================================================================ */
const TURBO_RE = /(?:webcast\/)?(\d{10,})/;
const turboId = s => { const m = String(s || '').match(TURBO_RE); return m ? m[1] : ''; };
const turboUrl = id => `https://turbogamecast.com/api/v1/gamecast/${id}?sport=football`;

async function turboFetch(link){
  const id = turboId(link);
  if (!id) throw new Error('That doesn’t look like a TurboStats gamecast link.');
  const r = await fetch(turboUrl(id), {cache:'no-cache'});
  if (!r.ok) throw new Error(`Their site answered ${r.status}. Check the link.`);
  const feed = await r.json();
  if (!feed || !Array.isArray(feed.playbyplay)) throw new Error('That gamecast has no play-by-play in it.');
  return {id, feed};
}

/* ---------- reading their rows ---------- */
// "WV:17" — a yard line with the side it's on. In the engine a spot is yards from the team with the ball, so
// their own 17 is 17 and the other team's 17 is 83.
function turboSpot(txt, poss, side, FL){
  const m = String(txt || '').match(/([A-Za-z]+)\s*:\s*(\d{1,3})/);
  if (!m) return null;
  const n = +m[2];
  return m[1].toUpperCase() === String(side[poss] || '').toUpperCase() ? n : FL - n;
}
// "WV:17" as the site keeps a spot: which team's half, and the number on it.
function turboAt(txt, side){
  const m = String(txt || '').match(/([A-Za-z]+)\s*:\s*(\d{1,3})/);
  if (!m) return null;
  const up = m[1].toUpperCase();
  const s = up === String(side.A).toUpperCase() ? 'A' : up === String(side.H).toUpperCase() ? 'H' : null;
  return s ? {side:s, n:+m[2]} : null;
}
const turboNum = s => { const m = String(s || '').match(/^\s*(\d{1,2})\b/); return m ? m[1] : null; };
const turboName = s => String(s || '').replace(/^\s*\d{1,2}\s+/, '').trim();
const turboYards = ev => { const m = String(ev).match(/for\s+(-?\d+)\s+yard/i); return m ? +m[1] : null; };
const turboClock = s => { const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
const turboTD = ev => /:TouchDown:/i.test(ev || '');
// A two-point try: the points on the row say whether it was good, whatever their wording for it was.
const turboGood = (ev, pts) => (pts > 0 || turboTD(ev) || /:Good:|:Extra Point:/i.test(ev || '')) ? 'good' : 'no';
// ":Penalty D:, Encroachment:" — the foul's name, matched to the site's list when it knows it.
function turboFoul(ev){
  const bits = String(ev || '').split(':').map(s => s.replace(/^[,\s]+|[,\s]+$/g, '')).filter(Boolean);
  const last = bits[bits.length - 1] || '';
  const said = /penalty\s*[do]/i.test(last) || /^for\s/i.test(last) ? '' : last;
  const known = PENALTIES.find(p => p.name.toLowerCase() === said.toLowerCase());
  return known || (said ? {name:said.replace(/\b[a-z]/, c => c.toUpperCase()), y:0, a:false, l:false} : null);
}

/* ---------- their game as this site's game ---------- */
async function turboGame(feed, id){
  const gi = feed.gameInfo || {}, skipped = [];
  const side = {A:gi.visId || 'V', H:gi.homeId || 'H'};            // their code for each side
  const codeSide = c => String(c || '').toUpperCase() === String(side.A).toUpperCase() ? 'A'
    : String(c || '').toUpperCase() === String(side.H).toUpperCase() ? 'H' : null;
  // A crew can key a quarter wrong: McPherson at Winfield (10/23/26) went 1, 2, 3 and then back to "2" for the whole
  // fourth, which filed the fourth under the third and left "End 3rd" and "End 4th" side by side (Chuck, 2026-10-25).
  // Their quarter number changing at all is the next quarter; a jump up (into overtime) is taken as written.
  let qPrev = null, qNow = 0;
  const rows = feed.playbyplay.filter(r => r && r.qtr && /^[1-9]$/.test(String(r.qtr))).map(r => {
    const n = +r.qtr;
    if (qPrev === null) qNow = n; else if (n !== qPrev) qNow = Math.max(n, qNow + 1);
    qPrev = n;
    return n === qNow ? r : Object.assign({}, r, {qtr:String(qNow)});
  });
  const FL = 100;

  // Their names carry the mascot ("Winfield Vikings"); the site's own spelling wins when it knows the school.
  const school = full => {
    const words = String(full || '').trim().split(/\s+/);
    for (let n = words.length; n > 0; n--){
      const tryName = words.slice(0, n).join(' ');
      const hit = (logoLib.list || []).find(t => canonSchool(t.name) === canonSchool(tryName)
        || (t.aliases || []).some(a => canonSchool(a) === canonSchool(tryName)));
      if (hit) return hit.name;
    }
    return words.length > 1 ? words.slice(0, -1).join(' ') : words.join(' ');
  };
  const team = (nameFull, code) => {
    const name = school(nameFull), t = findTeam(name);
    return {name, abbr:(t && t.abbr) || String(code || '').toUpperCase() || shortName(name), color:(t && t.color) || '#4A4B4D', mascot:''};
  };

  // Everyone the play-by-play names, by number, for each side.
  const roster = {A:{}, H:{}};
  rows.forEach(r => {
    const s = codeSide(r.team); if (!s) return;
    [r.player, r.qb].forEach(v => {
      const n = turboNum(v), nm = turboName(v);
      if (n && nm && !/^intercepted/i.test(nm) && !roster[s][n]) roster[s][n] = nm.replace(/\s+intercepted.*$/i, '').trim();
    });
  });

  // Their rows carry the spot and the down outright; this engine works them out from the plays. The two are
  // squared up afterwards, not play by play: replaying a whole game 150 times over took fifteen seconds and sat
  // on the page while it did. The plays go in first, each remembering what their row said the situation was,
  // and then a couple of passes put the ball where they say it is wherever the reading has drifted.
  const plays = [], want = [];
  const add = (p, r, w) => { const c = turboClock(r && r.clock); plays.push(c != null ? {...p, clk:c} : p); want.push(w || null); };
  const DOWN = {'1st':1, '2nd':2, '3rd':3, '4th':4};
  const wantOf = (r, s, spot) => spot == null ? null : {poss:s, spot,
    down:DOWN[String(r.down || '').replace(/[^a-z0-9]/gi, '').slice(0, 3)] || null,
    togo:/^\d+$/.test(String(r.dist || '').trim()) ? +r.dist : null};
  const isPlay = r => r.spot && String(r.spot).trim() && r.down !== '';
  // Their drive summaries ("Punted", "TD", "Fum") sit between a kick and its return, and a timeout can too.
  // The return belongs to the kick all the same, so look past anything that isn't a play of its own.
  const after = (i, n = 6) => { for (let j = i + 1; j < rows.length && j <= i + n; j++) if (isPlay(rows[j])) return {r:rows[j], j}; return null; };
  const used = new Set();                  // rows already taken as part of the play before them
  // Every row carries the score after it, which settles a try far better than reading their markers.
  const scoreAt = i => { for (let j = i; j >= 0; j--){ const v = rows[j].scoreV, h = rows[j].scoreH;
    if (/^\d+$/.test(String(v).trim()) && /^\d+$/.test(String(h).trim())) return {A:+v, H:+h}; } return {A:0, H:0}; };
  const gained = (i, s) => { const now = scoreAt(i), was = scoreAt(i - 1); return (now[s] || 0) - (was[s] || 0); };
  let q = 1;

  for (let i = 0; i < rows.length; i++){
    if (used.has(i)) continue;
    const r = rows[i], t = String(r.type || '').trim(), s = codeSide(r.team);
    const nx = after(i), next = (nx && nx.r) || {};
    const ev = String(r.event || '');
    // A new quarter: the clock stopping is a play of its own here. The one that opens overtime has to say who
    // takes the ball first, or the engine picks for itself and the whole extra period lands on the wrong team.
    while (+r.qtr > q){
      const otFirst = q === 4 ? codeSide((rows.find(x => +x.qtr === 5 && isPlay(x)) || {}).team) : null;
      plays.push({t:'endq', ...(otFirst ? {first:otFirst} : {})}); want.push(null); q++;
    }

    if (t === 'TimeOut'){ if (s){ plays.push({t:'to', side:s}); want.push(null); } continue; }
    // Drive summaries carry no down or spot: the plays themselves say what happened.
    if (!isPlay(r)) continue;
    if (!s){ skipped.push(ev); continue; }

    // The spot this play started from, in the possessing team's own frame.
    const spot = turboSpot(r.spot, s, side, FL);
    const yds = turboYards(ev);
    const isTryRow = /^pat/i.test(String(r.down || '')) || t === 'Extra Point';
    // A return is part of the play it came from, and a try follows a score: neither starts a new spot.
    const PART_OF_LAST = ['Kick Return', 'Punt Return', 'Int Return', 'Fumble Return'];
    // On a flag their team code is whoever committed it, not whoever has the ball, so a penalty row never says
    // where the ball is: the play after it does. Nor does a return, which belongs to the play before it.
    const isFlag = t === 'Penalty D' || t === 'Penalty O';
    const says = (!isTryRow && !isFlag && t !== 'Kickoff' && !PART_OF_LAST.includes(t)) ? wantOf(r, s, spot) : null;

    if (t === 'Kickoff'){
      const k = turboNum(r.player) || turboNum(r.number);
      const back = next && String(next.type).trim() === 'Kick Return' ? next : null;
      const d = yds != null ? yds : null;
      const p = {t:'ko', ...(k ? {k} : {}), ...(d != null ? {d} : {})};
      if (back){ const ry = turboYards(back.event); add({...p, res:'ret', ret:turboNum(back.number) || turboNum(back.player), ry:ry || 0}, r, says); used.add(nx.j); }
      else if (/touchback/i.test(ev)) add({...p, res:'tb'}, r, says);
      else add({...p, res:'spot'}, r, says);
      poss = null; continue;
    }
    if (t === 'Kick Return'){ skipped.push(ev); continue; }   // handled with its kickoff

    if (t === 'Punt'){
      const k = turboNum(r.player) || turboNum(r.number);
      const back = next && String(next.type).trim() === 'Punt Return' ? next : null;
      const p = {t:'punt', ...(k ? {k} : {}), ...(yds != null ? {d:Math.abs(yds)} : {})};
      if (back){ add({...p, res:'ret', ret:turboNum(back.number), ry:turboYards(back.event) || 0}, r, says); used.add(nx.j); }
      else if (/touchback/i.test(ev)) add({...p, res:'tb'}, r, says);
      else if (/out of bounds/i.test(ev)) add({...p, res:'oob'}, r, says);
      else if (/fair catch/i.test(ev)) add({...p, res:'fc', ret:turboNum(next.number)}, r, says);
      else add({...p, res:'down'}, r, says);
      continue;
    }
    if (t === 'Punt Return'){ skipped.push(ev); continue; }

    if (t === 'Penalty D' || t === 'Penalty O'){
      const foul = turboFoul(ev), y = Math.abs(turboYards(ev) || (foul && foul.y) || 5);
      // Their team code on a flag is whoever committed it.
      add({t:'pen', pen:{side:s, name:(foul && foul.name) || 'Other', y, a:!!(foul && foul.a), l:!!(foul && foul.l), enf:'acc'}}, r, says);
      continue;
    }

    if (t === 'Field Goal'){
      const k = turboNum(r.player) || turboNum(r.number);
      const d = turboYards(ev);
      add({t:'fg', ...(k ? {k} : {}), ...(d != null ? {d:Math.abs(d)} : {}),
        res:/block/i.test(ev) ? 'blk' : (gained(i, s) >= 3 || /:Good:/i.test(ev)) ? 'good' : 'no'}, r, says);
      continue;
    }

    if (t === 'Extra Point'){
      const k = turboNum(r.player) || turboNum(r.number);
      const blocked = /block/i.test(ev), good = gained(i, s) > 0 || /:Good:/i.test(ev);
      add({t:'try', kind:'kick', ...(k ? {k} : {}), res:blocked ? 'blk' : good ? 'good' : 'no'}, r, says);
      continue;
    }

    // ":Fumble/Lost:" on their play row, and the recovery on a Fumble Return row a line or two later.
    const fumOf = () => {
      if (!/fumble/i.test(ev)) return null;
      const hit = rows.slice(i + 1, i + 5).map((x, k) => ({x, j:i + 1 + k}))
        .find(({x}) => String(x.type).trim() === 'Fumble Return' && !used.has(x.j));
      if (!hit) return {lost:/lost/i.test(ev)};                       // nobody's recovery row: at least record it
      used.add(hit.j);
      const rs = codeSide(hit.x.team), by = turboNum(hit.x.number) || turboNum(hit.x.player);
      const at = turboAt(hit.x.spot, side), ry = turboYards(hit.x.event) || 0;
      return {lost:rs !== s, ...(by ? {by} : {}), ...(at ? {at} : {}),
        ...(turboTD(hit.x.event) ? {td:true} : {ry})};
    };
    const isTry = isTryRow;
    if (t === 'Rush'){
      const n = turboNum(r.player) || turboNum(r.number);
      if (isTry){ add({t:'try', kind:'run', ...(n ? {r:n} : {}), res:turboGood(ev, gained(i, s))}, r, says); continue; }
      // ":Safety:" on a run their crew wrote as 0 yards at the 2 (McPherson at Winfield, 10/23/26): it ends in the end
      // zone, so it goes all the way back there — otherwise the two points never count.
      const saf = /:Safety:/i.test(ev) && spot != null;
      if (yds == null && !saf){ skipped.push(ev); continue; }
      const fum = fumOf();
      add({t:'run', ...(n ? {r:n} : {}), y:saf ? -spot : yds, ...(fum ? {fum} : {})}, r, says);
      continue;
    }

    if (t === 'Pass'){
      const qb = turboNum(r.qb) || turboNum(r.player), to = turboNum(r.number);
      if (/intercepted/i.test(ev)){
        // Where it was picked off, and what the return did: their Int Return row holds that.
        const back = rows.slice(i + 1, i + 4).find(x => String(x.type).trim() === 'Int Return');
        const at = turboSpot(ev.match(/on the\s+([A-Za-z]+\s*:\s*\d+)/i) ? RegExp.$1 : (back && back.spot), s, side, FL);
        const by = ev.match(/intercepted by\s+(\d{1,2})/i) ? RegExp.$1 : (back ? turboNum(back.number) : null);
        const ry = back ? (turboYards(back.event) || 0) : 0;
        add({t:'pass', ...(qb ? {qb} : {}), res:'x', at:(at != null && spot != null) ? at - spot : 0, ry,
          ...(by ? {ib:by} : {})}, r);
        continue;
      }
      if (isTry){ add({t:'try', kind:'pass', ...(qb ? {qb} : {}), ...(to ? {to} : {}), res:turboGood(ev, gained(i, s))}, r, says); continue; }
      if (/incomplete/i.test(ev)){ add({t:'pass', ...(qb ? {qb} : {}), ...(to ? {to} : {}), res:'i'}, r, says); continue; }
      if (/sack/i.test(ev)){ const fum = fumOf();
        const saf = /:Safety:/i.test(ev) && spot != null;   // sacked in the end zone, as with a run
        add({t:'pass', ...(qb ? {qb} : {}), res:'s', sy:saf ? spot : Math.abs(yds || 0), ...(fum ? {fum} : {})}, r, says); continue; }
      if (yds == null){ skipped.push(ev); continue; }
      const fum = fumOf();
      add({t:'pass', ...(qb ? {qb} : {}), ...(to ? {to} : {}), res:'c', y:yds, ...(fum ? {fum} : {})}, r, says);
      continue;
    }

    if (t === 'Int Return' || t === 'Fumble Return'){ skipped.push(ev); continue; }   // taken with the play they came from
    skipped.push(ev);
  }
  while (q < 4){ plays.push({t:'endq'}); want.push(null); q++; }
  plays.push({t:'endq'}); want.push(null);
  if (/final/i.test(String(gi.clock || ''))){ plays.push({t:'final'}); want.push(null); }

  // Now square our reading with theirs. One replay says where this engine thinks the ball was for every play;
  // wherever that isn't where their row said, the ball is put there first — the same as a scorer typing
  // "M ball at M35" — and a score their crew took no try for gets one, or the next play is read as the try.
  const shell = {set:{qtr:12, men:11, firstKick:(rows.find(r => String(r.type).trim() === 'Kickoff') && codeSide(rows.find(r => String(r.type).trim() === 'Kickoff').team)) || 'H'},
    teams:{A:{name:'A', abbr:'A', roster:{}}, H:{name:'H', abbr:'H', roster:{}}}};
  let fixes = 0;
  for (let pass = 0; pass < 6; pass++){
    const log = replay({...shell, plays}).log, ins = [];
    log.forEach(e => {
      const w = want[e.i]; if (!w) return;
      if (e.phase === 'try'){ ins.push([e.i, {t:'try', kind:'kick', res:'no'}]); return; }
      if (e.phase !== 'play') return;                       // a kickoff stands on its own
      if (e.poss === w.poss && e.spot === w.spot && (!w.down || e.down === w.down)) return;
      ins.push([e.i, {t:'set', poss:w.poss, spot:w.spot, ...(w.down ? {down:w.down} : {}),
        ...(w.togo ? {togo:w.togo} : {}), ...(w.togo == null && w.spot + 10 >= FL ? {goal:1} : {})}]);
    });
    if (!ins.length) break;
    ins.reverse().forEach(([at, p]) => { plays.splice(at, 0, p); want.splice(at, 0, null); });
    fixes += ins.length;
  }

  // Who kicked off first, so the engine opens the game the same way they did.
  const firstKo = rows.find(r => String(r.type).trim() === 'Kickoff');
  const game = {
    id:`tg-${id}`, created:Date.now(), updated:Date.now(), share:true, from:'turbostats', src:turboUrl(id),   // the boards are the whole point of bringing one in
    teams:{A:{...team(gi.visName, gi.visId), roster:roster.A}, H:{...team(gi.homeName, gi.homeId), roster:roster.H}},
    set:{qtr:12, men:11, firstKick:(firstKo && codeSide(firstKo.team)) || 'H',
      date:turboDate(gi.date), roster:{A:roster.A, H:roster.H}},
    roster:{A:roster.A, H:roster.H},
    date:turboDate(gi.date), clk:{s:12 * 60, run:false, at:0}, plays
  };
  // The same matchup already brought in from this link within a few days is this game: keep its name and the date it
  // carries now, so a date fixed by hand stays fixed when the gamecast is read again (Chuck, 2026-10-17: Winfield at
  // Buhler kept going back to Saturday, the date the crew's feed has, after he set it to Friday).
  const kept = turboSameGame(id, game.date, game.teams.A.name, game.teams.H.name);
  if (kept){ game.id = kept.id; game.date = game.set.date = kept.date; }
  else game.id = turboGameId(id, game.date, game.teams.A.name, game.teams.H.name);
  return {game, skipped};
}
// A crew can keep one gamecast link all season (Winfield's does), and the link then serves whichever game is newest.
// So a game is named by the link and its date, and the next one goes beside the last instead of over it: Augusta at
// Winfield replaced Winfield at Mulvane that way (2026-09-26). Importing the same game again updates it, including
// one brought in before this under the link alone.
function turboSameGame(id, date, A, H){
  const day = d => fromYmd(d).getTime(), near = 3 * 864e5;
  return Object.values(db.games || {}).find(x => x && x.id && (x.id === `tg-${id}` || x.id.startsWith(`tg-${id}-`)) && x.date && x.teams &&
    Math.abs(day(x.date) - day(date)) <= near && sameSchool(x.teams.A.name, A) && sameSchool(x.teams.H.name, H)) || null;
}
function turboGameId(id, date, A, H){
  const old = db.games[`tg-${id}`];
  if (old && old.date === date && old.teams && sameSchool(old.teams.A.name, A) && sameSchool(old.teams.H.name, H)) return `tg-${id}`;
  return `tg-${id}-${date}`;
}
// "09/18/26" the way the site keeps a date.
function turboDate(s){
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return ymd(new Date());
  const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
  return `${y}-${String(+m[1]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`;
}

// Their score against ours, quarter by quarter and at the end: an import that doesn't add up says so.
function turboCheck(feed, game){
  const gi = feed.gameInfo || {}, r = replay(game);
  const last = feed.playbyplay.filter(x => x && /^[1-9]$/.test(String(x.qtr))).slice(-1)[0] || {};
  const theirs = {A:+last.scoreV || 0, H:+last.scoreH || 0};   // V is the visiting side, which is A here
  const ours = r.st.score;
  return {ours, theirs, agree:ours.A === theirs.A && ours.H === theirs.H, teams:[gi.visName, gi.homeName]};
}

/* ---------- bringing one in ---------- */
const turbo = {busy:false, msg:'', ok:null};
function turboBlock(){
  if (!sync.user || sync.user.uid !== ADMIN_UID) return '';   // the admin's own tool, like the Others list
  const note = turbo.msg ? `<p class="hint"${turbo.ok === false ? ' style="color:var(--flag-ink)"' : ''}>${esc(turbo.msg)}</p>` : '';
  return `<div class="grp"><h3>Import a game</h3>
    <div class="acct"><div style="flex:1;min-width:0">
      <p class="hint">Paste a TurboStats gamecast link (its whole play-by-play comes in) or a Hudl box score link (the box score comes in). It goes on the scoreboards straight away; the Share window takes it back off.</p>
      <input class="inp" id="tg-link" placeholder="turbogamecast.com or hudl.com link" autocomplete="off" spellcheck="false"></div>
      <button class="btn small primary" data-turbo="go"${turbo.busy ? ' disabled' : ''}>${turbo.busy ? 'Reading…' : 'Import'}</button></div>
    ${note}</div>`;
}
async function turboImport(){
  const el = $('#tg-link'), link = el ? el.value.trim() : '';
  if (!link) return toast('Paste the link first');
  turbo.busy = true; turbo.msg = ''; turbo.ok = null; redrawGames();
  try {
    if (isHudl(link)){
      const {game, p} = await hudlImport(link), A = game.teams.A, H = game.teams.H;
      turbo.ok = !p.warn.length;
      turbo.msg = `${A.name} ${p.total.A} at ${H.name} ${p.total.H} — the Hudl box score.${p.warn.length ? ' ' + p.warn.join(' ') : ''} It’s live on the scoreboards.`;
      turbo.busy = false; return;
    }
    if (!turboId(link)) throw new Error('That isn’t a TurboStats or Hudl link.');
    const {id, feed} = await turboFetch(link);
    const {game, skipped} = await turboGame(feed, id);
    if (!game.plays.filter(p => PLAY_KINDS.includes(p.t)).length) throw new Error('That gamecast hasn’t got any plays in it yet.');
    const chk = turboCheck(feed, game);
    const A = game.teams.A, H = game.teams.H;
    turbo.ok = chk.agree;
    turbo.msg = `${A.name} ${chk.ours.A} at ${H.name} ${chk.ours.H} — ${game.plays.length} plays.`
      + (chk.agree ? ' The score matches their gamecast.' : ` Their gamecast says ${chk.theirs.A}-${chk.theirs.H}: check the play-by-play.`)
      + (skipped.length ? ` ${skipped.length} ${skipped.length === 1 ? 'play' : 'plays'} couldn’t be read and were left out.` : '')
      + ' It’s live on the scoreboards.';
    db.games[game.id] = game; g = game; resetUi(); save(); closeDialog(); refresh();
    toast(`Imported ${A.abbr || A.name} at ${H.abbr || H.name}`);
  } catch (e) {
    turbo.ok = false; turbo.msg = String((e && e.message) || e) || 'That didn’t work.';
    if (/fetch|network|Failed/i.test(turbo.msg)) turbo.msg = 'Couldn’t reach their site. Check the link and your connection.';
  }
  turbo.busy = false; redrawGames();
}
const PLAY_KINDS = ['run', 'pass', 'punt', 'ko', 'fg'];
const redrawGames = () => { if (ui.dlg === 'games' && dlg() && dlg().open) dlg().innerHTML = dlgGames(); };
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-turbo]');
  if (!b) return;
  if (b.dataset.turbo === 'go') return void turboImport();
  // From the start screen: open Games, where the box lives, and put the cursor in it.
  if (b.dataset.turbo === 'open'){
    openDialog('games');
    setTimeout(() => { const el = $('#tg-link'); if (el){ el.scrollIntoView({block:'center'}); el.focus(); } }, 60);
  }
});
/* ================================================================
   Hudl box scores by link (Chuck, 2026-10-26: "make the turbo cast import just a link import… like hudl").
   hudl.com/game/<teams>/<sport>/<id>/box-score has no play-by-play, only the box score: the line score, the
   scoring summary and every stat table. It's written out here as the newspaper box score the paste window
   reads (parseBox), and saved the way a pasted one is, so Edit on the game shows it and a fix to the reader
   reaches it too.

   Hudl doesn't let another site read its pages, so the page comes through a reader that will: r.jina.ai, or
   allorigins.win and codetabs when it's down.
   Hudl lists the home team first.
   ================================================================ */
const HUDL_RE = /hudl\.com\/game\/([^?#\s]+?)(?:\/box-score)?\/?(?:[?#\s]|$)/i;
const isHudl = s => HUDL_RE.test(String(s || ''));
const hudlUrl = s => { const m = String(s).match(HUDL_RE); return m ? `https://www.hudl.com/game/${m[1]}/box-score` : ''; };
async function hudlFetch(link){
  const url = hudlUrl(link);
  if (!url) throw new Error('That isn’t a Hudl game link.');
  // These are free and now and then slow or down, so each is tried in turn, twice over.
  const q = encodeURIComponent(url);
  const via = [[`https://r.jina.ai/${url}`, t => t, {'X-Return-Format':'html'}],
    [`https://api.allorigins.win/get?url=${q}`, t => JSON.parse(t).contents], [`https://api.codetabs.com/v1/proxy?quest=${url}`, t => t]];
  for (let round = 0; round < 2; round++) for (const [u, read, headers] of via){
    try {
      const ctl = new AbortController(), stop = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch(u, {cache:'no-cache', signal:ctl.signal, ...(headers ? {headers} : {})}).finally(() => clearTimeout(stop));
      if (!r.ok) continue;
      const html = read(await r.text());
      if (/game-periods/.test(html || '')) return {url, html};
    } catch (e) {}
  }
  throw new Error('Couldn’t reach Hudl. Check the link and your connection.');
}
// Hudl's name for a school ("Wichita-Collegiate", "Clearwater High") as the site knows it.
function hudlSchool(n){
  const s = String(n || '').replace(/\s+/g, ' ').trim(), bare = s.replace(/\s+(?:high(?:\s+school)?|hs|jr\.?\s*\/?\s*sr\.?\s+high)$/i, '');
  const tries = [s, s.replace(/-/g, ' '), bare, bare.replace(/-/g, ' ')];
  const hit = tries.find(t => typeof knownSchool === 'function' && knownSchool(t));
  return hit ? schoolName(hit) : bare;
}
// The box score as text parseBox reads.
function hudlText(html){
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
  const num = v => { v = String(v || '').trim(); return /^-?\d+(?:\.\d+)?$/.test(v) ? +v : 0; };
  const cell = v => { const n = Math.round(num(v)); return n < 0 ? `(${n})` : String(n); };
  const names = [txt(doc.querySelector('.team-1 .team-name')), txt(doc.querySelector('.team-2 .team-name'))].map(hudlSchool);
  if (!names[0] || !names[1]) throw new Error('That Hudl page has no box score on it.');
  // Hudl: home first. The paste: visitor first. side[i] is what Hudl's i-th team is here.
  const side = ['H', 'A'], nameOf = {A:names[1], H:names[0]};
  const label = s => nameOf[s].replace(/-/g, ' ');
  const out = [];
  // The line score.
  const rows = [...doc.querySelectorAll('table.game-periods tbody tr')].map(tr => [...tr.cells].map(td => txt(td)));
  if (rows.length < 2) throw new Error('That Hudl game has no score yet.');
  const abbr = {};
  rows.forEach((r, i) => { abbr[r[0]] = side[i]; });
  const line = i => { const r = rows[i], q = r.slice(1, -1); return `${nameOf[side[i]]} ${q.map(v => v === '' || v === '-' ? 'X' : v).join(' ')} — ${r[r.length - 1]}`; };
  out.push(line(1), line(0), '');
  // The scoring summary: a table for each quarter; whose score it is shows in the running score.
  const full = {};   // Hudl athlete id → the full name the summary gives him
  const WORDS = /\b(Yd|Yds|Yard|Yards|Pass|From|Run|Rush|Kick|No|Good|Failed|Fail|Two-Point|Conversion|For|Field|Goal|Return|Interception|Fumble|Punt|Kickoff|Safety|Recovery|Blocked|Extra|Point|Attempt|Reception|Lateral|Defensive|Missed|Incomplete)\b/g;
  let run = [0, 0];
  doc.querySelectorAll('.scoring-summary table').forEach(t => {
    const head = txt(t.querySelector('thead th'));
    out.push(/over|^ot/i.test(head) ? (/\d/.test(head) ? head : 'OT') : head);
    t.querySelectorAll('tbody tr').forEach(tr => {
      const c = [...tr.cells]; if (c.length < 5) return;
      const kind = txt(c[1]), at = [num(txt(c[3])), num(txt(c[4]))];
      let d = '';
      c[2].childNodes.forEach(n => {
        if (n.nodeType === 1 && n.tagName === 'A'){
          const nm = txt(n), id = (n.getAttribute('href') || '').match(/athlete\/(\d+)/);
          if (id && /\s/.test(nm)) full[id[1]] = nm;
          d += nm;
        } else d += String(n.textContent || '').replace(WORDS, w => w.toLowerCase());
      });
      d = d.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
      if (/^FG$/i.test(kind) && !/field goal|\bfg\b/i.test(d)) d += ' field goal';
      if (/^S(?:AF|afety)/i.test(kind) && !/safety/i.test(d)) d = `safety, ${d}`;
      const who = at[0] !== run[0] ? 0 : 1;
      run = at;
      out.push(`${label(side[who])} — ${d}`);
    });
  });
  out.push('');
  // The stat tables: "WCS Passing", "CHS Rushing", … one per team.
  const pl = {A:{}, H:{}}, order = {A:[], H:[]};
  const who = (s, td) => {
    const a = td.querySelector('a'), id = a && (a.getAttribute('href') || '').match(/athlete\/(\d+)/);
    let nm = txt(td).replace(/^#\d+\s*/, '').trim();
    if (/^rest of team$/i.test(nm)) nm = 'Team';
    else if (id && full[id[1]]) nm = full[id[1]];
    if (!pl[s][nm]){ pl[s][nm] = {}; order[s].push(nm); }
    return pl[s][nm];
  };
  doc.querySelectorAll('section.compare table').forEach(t => {
    const th = t.querySelector('thead th'); if (!th) return;
    const ab = txt(th.querySelector('.school-abbreviation')), s = abbr[ab];
    if (!s) return;
    const what = txt(th).slice(ab.length).trim().toLowerCase();
    const cols = [...t.querySelectorAll('thead th')].slice(1).map(x => txt(x).toLowerCase());
    t.querySelectorAll('tbody tr').forEach(tr => {
      const c = [...tr.cells]; if (c.length < 2) return;
      const p = who(s, c[0]), v = {};
      cols.forEach((k, i) => { v[k] = txt(c[i + 1]); });
      (p[what] = p[what] || {});
      Object.assign(p[what], v);
    });
  });
  const sec = (head, kind, f) => {
    const parts = ['A', 'H'].map(s => {
      const items = order[s].filter(n => pl[s][n][kind]).map(n => { const x = f(pl[s][n][kind], n, s); return x == null ? null : `${n} ${x}`; }).filter(Boolean);
      return items.length ? `${nameOf[s]} — ${items.join('; ')}.` : '';
    }).filter(Boolean);
    if (parts.length) out.push(`${head}: ${parts.join(' ')}`);
  };
  sec('PASSING (cmp-att-yds-td-int)', 'passing', v => { const [c, a] = String(v['cp/att'] || '0/0').split('/'); return [cell(c), cell(a), cell(v.yds), cell(v.td), cell(v.int)].join('-'); });
  sec('RUSHING (att-yds-td-long)', 'rushing', v => [cell(v.att), cell(v.yds), cell(v.td), cell(v.long)].join('-'));
  sec('RECEIVING (rec-yds-td-long)', 'receiving', v => [cell(v.rec), cell(v.yds), cell(v.td), cell(v.long)].join('-'));
  // Tackles and the defensive table (interceptions, fumbles recovered, blocks) in one line apiece.
  ['A', 'H'].forEach(s => order[s].forEach(n => {
    const p = pl[s][n];
    if (p.tackles || p.defensive) p.def = {...(p.tackles || {}), ...(p.defensive || {})};
    const fum = num((p.rushing || {}).fum) + num((p.receiving || {}).fum);
    if (fum) p.fum = {fum};
  }));
  sec('TACKLES (solo-assists-sacks-tfl-int-fr-blk)', 'def', v => [v.tk, v.ast, v.sck, v.tfl, v.int, v.fum, v.blks].map(cell).join('-'));
  sec('FUMBLES (fum-lost)', 'fum', v => `${v.fum}-0`);
  // Returns: Hudl gives the average, the paste wants the yards.
  const ret = v => { const n = num(v.ret); return [cell(n), cell(n * num(v.avg)), cell(v.td), cell(v.long)].join('-'); };
  sec('KICKOFF RETURNS (no-yds-td-long)', 'kickoff returns', ret);
  sec('PUNT RETURNS (no-yds-td-long)', 'punt returns', ret);
  sec('PUNTING (punts-yards-long-i20)', 'punting', v => { const n = num(v.num); return [cell(n), cell(n * num(v.avg)), cell(v.long), cell(v['in 20'])].join('-'); });
  // Field goals made come from the scoring summary; the misses only from here ("1/3").
  sec('MISSED FIELD GOALS', 'kicking', v => { const [m, a] = String(v.fg || '').split('/').map(num); return a > m ? Array(a - m).fill(0).join(' ') : null; });
  // Team totals: a row a stat, Hudl's first team, then its second.
  const tt = {};
  doc.querySelectorAll('.team-totals tr').forEach(tr => {
    const c = [...tr.cells]; if (c.length !== 3) return;
    let k = txt(c[0]).toLowerCase();
    if (k === 'yards' && tt.penalties && !tt['penalty yards']) k = 'penalty yards';
    tt[k] = [txt(c[1]), txt(c[2])].map(v => v.replace(/\s*\(.*\)\s*/, '').trim());
  });
  const T = s => {
    const i = side.indexOf(s), at = k => (tt[k] || [])[i], ok = v => v != null && v !== '' && v !== '-', bits = [];
    const sum = (kind, k) => order[s].reduce((a, n) => a + (pl[s][n][kind] ? num(pl[s][n][kind][k]) : 0), 0);
    if (ok(at('first downs'))) bits.push(`first downs ${at('first downs')}`);
    if (ok(at('third down efficiency'))) bits.push(`third downs ${at('third down efficiency')}`);
    if (ok(at('fourth down efficiency'))) bits.push(`fourth downs ${at('fourth down efficiency')}`);
    if (ok(at('penalties'))) bits.push(`penalties ${at('penalties')}-${ok(at('penalty yards')) ? at('penalty yards') : 0}`);
    if (ok(at('fumbles lost'))) bits.push(`fumbles-lost ${Math.max(num(at('fumbles lost')), order[s].reduce((a, n) => a + ((pl[s][n].fum || {}).fum || 0), 0))}-${at('fumbles lost')}`);
    if (ok(at('total plays'))) bits.push(`${at('total plays')} plays`);
    if (ok(at('time of possession'))) bits.push(`time of possession ${at('time of possession')}`);
    const ko = sum('kickoff', 'num');
    if (ko) bits.push(`kickoff yards ${ko}-${sum('kickoff', 'yds')}`, `kickoffs ${ko}-${sum('kickoff', 'tb')}`);
    const pn = sum('punting', 'num');
    if (pn) bits.push(`punt yards ${pn}-${Math.round(order[s].reduce((a, n) => a + (pl[s][n].punting ? num(pl[s][n].punting.num) * num(pl[s][n].punting.avg) : 0), 0))}`);
    return bits.length ? `${nameOf[s]} — ${bits.join('; ')}.` : '';
  };
  const ts = [T('A'), T('H')].filter(Boolean);
  if (ts.length) out.push(`TEAM STATS: ${ts.join(' ')}`);
  const date = (txt(doc.querySelector('title')).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/) || []);
  return {text:out.join('\n'), date:date.length ? `${date[3]}-${date[1].padStart(2, '0')}-${date[2].padStart(2, '0')}` : ''};
}
async function hudlImport(link){
  // The school list, so Hudl's names come out as the site's.
  if (!logoLib.list){ loadLogos(); for (let i = 0; i < 50 && !logoLib.list; i++) await new Promise(r => setTimeout(r, 100)); }
  const {url, html} = await hudlFetch(link);
  const {text, date} = hudlText(html), p = parseBox(text);
  if (!p.ok) throw new Error(p.error || 'Couldn’t read that Hudl box score.');
  ui.boxGame = ui.boxFrom = null;
  const x = saveBox({txt:text, date, extra:{from:'hudl', src:url}});
  return {game:x, p};
}
