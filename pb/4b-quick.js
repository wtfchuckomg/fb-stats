/* ================================================================
   Quick entry: one line of shorthand per play, e.g.
     N ball at N35 1-10 · 3-10 · 3--1 · 7-inc · 7-88-5 · 15-0-50-td
     N punt · S ball at S10 · 3-3-fumble S rec · pen S 15 pf · 15-xp
   ================================================================ */
const PEN_CODES = {fs:'False start', enc:'Encroachment', off:'Offside', os:'Offside', offside:'Offside',
  dog:'Delay of game', delay:'Delay of game', form:'Illegal formation', formation:'Illegal formation',
  motion:'Illegal motion', mot:'Illegal motion', shift:'Illegal shift', snap:'Illegal snap',
  sub:'Illegal substitution', too:'Too many players', idp:'Ineligible downfield', ineligible:'Ineligible downfield',
  ifp:'Illegal forward pass', ig:'Intentional grounding', grounding:'Intentional grounding', rik:'Running into the kicker',
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
function quickTeams(){
  const a = String(g.teams.A.abbr || 'V').toLowerCase(), h = String(g.teams.H.abbr || 'H').toLowerCase();
  let ka = a[0], kh = h[0];
  if (ka === kh){ ka = 'v'; kh = 'h'; }
  const map = {[a]:'A', [h]:'H', [ka]:'A', [kh]:'H'};
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
const PEN_PHRASES = [[/\bfalse start\b/g, 'fs'], [/\bpass interference\b/g, 'pi'], [/\bpersonal foul\b/g, 'pf'], [/\bdelay of game\b/g, 'dog'],
  [/\bface ?mask\b/g, 'fm'], [/\broughing the passer\b/g, 'rtp'], [/\broughing the kicker\b/g, 'rtk'], [/\bunsportsmanlike(?: conduct)?\b/g, 'uc'],
  [/\boffsides?\b/g, 'off'], [/\bhorse ?collar\b/g, 'hc'], [/\b(?:illegal )?block in the back\b/g, 'ibb'], [/\billegal motion\b/g, 'motion'],
  [/\billegal formation\b/g, 'form'], [/\bintentional grounding\b/g, 'ig'], [/\bunnecessary roughness\b/g, 'ur']];
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
    const pt = toks.slice(pi + 1); toks = toks.slice(0, pi);
    // "r pen 10": the team can come just before the word too.
    if (toks.length && T(toks[toks.length - 1])) pt.unshift(toks.pop());
    const side = pt.map(T).find(Boolean);
    if (!side) return bad(`Which team? Like pen ${L('A')} 5 or pen ${L('H')} 15.`);
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
    const offset = pt.some(t => ['offset', 'offsetting', 'offsets'].includes(t));
    const declined = pt.some(t => ['dec', 'declined'].includes(t));
    if (!toks.length){ delete pen.at; return ok({t:'pen', pen:{...pen, enf:offset ? 'off' : declined ? 'dec' : 'acc'}}); }
    pen.enf = offset ? 'off' : pt.some(t => ['np', 'noplay', 'nullified', 'replay'].includes(t)) ? 'prev'
      : declined ? 'dec' : 'end';
  }
  let fumErr = null;                       // set when a fumble's "ball on" spot can't be right
  const flag = p => {
    if (fumErr) return bad(fumErr);
    if (pen){
      // The flag's yard line counts from whoever has the ball once the play is over: the receiving team after a
      // kick, the defense after a pick or a lost fumble (and back again if the returner fumbles it away).
      if (pen.at){
        const kick = p.t === 'ko' || p.t === 'punt', flips = (kick && p.res !== 'muff') || (p.t === 'pass' && p.res === 'x');
        const after = flips !== !!(p.fum && p.fum.lost) ? D : O, pos = pen.at.side === after ? pen.at.n : FL - pen.at.n;
        if (pen.foul != null) pen.foul = pos; else if (pen.ball != null) pen.ball = pos;
      }
      delete pen.at; p.pen = pen;
    }
    return ok(p);
  };
  // Drop filler words, but never a team letter: for Augusta, "a" is the team, not the article.
  // A kickoff reads its yard lines off the words "caught at the 8 … to the 20", and those words are filler
  // everywhere else, so keep a copy of the line before they go.
  const rawToks = toks.slice();
  if (toks.some(isNum)) toks = toks.filter(t => !FILLER.includes(t) || T(t));

  // "muffed by 44, recovered by 22": who dropped it, and who fell on it. Anything before the word is
  // the kick itself, so the distance is never mistaken for a jersey number.
  const muffOf = list => {
    const i = list.findIndex(t => ['muff', 'muffed', 'muffs'].includes(t));
    if (i < 0) return null;
    const tail = list.slice(i + 1), ri = tail.findIndex(t => ['rec', 'recovered', 'recovers'].includes(t));
    const nums = (ri >= 0 ? tail.slice(0, ri) : tail).filter(isNum);
    const by = nums[0];
    // "…muff-44-22" with no word between them: the second number is whoever fell on it.
    const ret = ri >= 0 ? tail.slice(ri + 1).filter(isNum)[0] : nums[1];
    return {i, by:by != null ? by : null, ret:ret != null ? ret : null, before:list.slice(0, i).filter(isNum)};
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
    const tagged = rest.map(spotOf).filter(Boolean);
    const spots = tagged.concat(bare.filter(n => !tagged.some(x => x.side === Rk && x.n === n)).map(n => ({side:Rk, n})));
    const caught = rawToks.some(t => CAUGHT.includes(t));
    const before = toks.slice(0, kickWord).filter(isNum);
    const left = bare.slice();                     // a number already read as a yard line isn't a player
    const after = rest.filter(t => {
      if (!isNum(t) || spotOf(t)) return false;
      const k = left.indexOf(+t); if (k >= 0){ left.splice(k, 1); return false; }
      return true;
    });
    const muff = muffOf(rest);
    if (muff) after.length = 0, muff.before.forEach(n => after.push(n));   // only the kick's own numbers left
    const sp = spots[0] || null, endSp = spots[1] || null;   // where it was caught, and where the return ended
    const pos = x => x.side === Rk ? FL - x.n : x.n;         // a yard line as the kicking team sees it
    const p = {t:'ko', res:'spot'};
    // With no catch spot the first number is how far it was kicked — unless it's the one returning it.
    const leadIsRet = !sp && after[0] != null && retNums.includes(+after[0]);
    if (sp) p.d = Math.max(0, pos(sp) - st.kickFrom);
    else if (after[0] != null && !leadIsRet) p.d = Math.abs(+after[0]);
    const nx = (sp || leadIsRet ? after : after.slice(1)).filter(n => !ydNums.includes(+n));
    const ryTold = ydNums.find(n => !spots.some(x => x.n === n));   // yards said out loud: "for 15", "15 yards"
    // "1 caught the kickoff at the 8": with no number after the word, the one before it is the returner.
    const retNo = nx[0] != null ? nx[0] : (caught && before[0] != null ? before[0] : null);
    if (before[0] != null && retNo !== before[0]) p.k = before[0];
    // "ko-C25": no kick details, just where the receiving team's drive starts.
    if (sp && !endSp && !nx.length && !caught && ryTold == null && !has('tb', 'oob', 'onside', 'fc')){ delete p.d; p.bs = sp.side === Rk ? sp.n : FL - sp.n; return flag(p); }
    if (has('tb')) p.res = 'tb';
    else if (has('oob')) p.res = 'oob';
    else if (has('onside')){ p.res = 'onside'; if (retNo != null) p.ret = retNo; if (p.d == null) p.d = 10; }
    else if (muff){ p.res = 'muff'; if (muff.by != null) p.by = muff.by; if (muff.ret != null) p.ret = muff.ret; }
    else if (has('fc')){ p.res = 'fc'; if (retNo != null) p.ret = retNo; }
    else if (retNo != null || endSp || ryTold != null){
      p.res = 'ret';
      if (retNo != null) p.ret = retNo;
      p.ry = endSp ? pos(sp) - pos(endSp) : ryTold != null ? ryTold : Math.abs(+(nx[1] || 0));
      if (p.ry < 0) return bad(`Those don’t add up: caught at the ${sp.n} and returned to the ${endSp.n}.`);
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
    if (has('xp', 'pat', 'kick', '1pt')) return ok({t:'try', kind:'kick', ...(nums[0] != null ? {k:nums[0]} : {}), res:has('blk', 'blocked') ? 'blk' : no ? 'miss' : 'good'});
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
    const bare = [], ydNums = [], retNums = [];
    pRaw.forEach((t, n) => {
      if (!isNum(t) || +t < 0 || +t > FL / 2) return;
      let j = n - 1; while (j >= 0 && pRaw[j] === 'the') j--;
      if (j >= 0 && pAT.includes(pRaw[j]) && pRaw[n - 1] === 'the') bare.push(+t);   // "at the 30", never "to 30"
      let k = n - 1; while (k >= 0 && ['the', 'a', 'it'].includes(pRaw[k])) k--;
      if ((k >= 0 && pRaw[k] === 'for') || pYD.includes(pRaw[n + 1])) ydNums.push(+t);
      let m = n + 1; while (m < pRaw.length && ['the', 'it'].includes(pRaw[m])) m++;
      if (pRET.includes(pRaw[m])) retNums.push(+t);
    });
    const bareN = bare.length ? bare[0] : null;
    // "… I ball at I35": where the receiving team's drive starts.
    let start = null;
    const bi = rest.indexOf('ball');
    if (bi >= 0){
      const tail = rest.slice(bi + 1);
      start = tail.map(spotOf).find(Boolean) || (tail.includes(String(HALF)) ? {side:D, n:HALF} : null);
      if (!start) return bad(`Say where the drive starts, like ${L(D)} ball at ${L(D)}35.`);
      rest = rest.slice(0, bi).filter(t => !T(t));
    }
    if (has('blk', 'blocked')){
      const after = rest.filter(isNum);
      p.res = 'blk'; if (after[0] != null) p.by = after[0]; if (after[1] != null) p.ret = after[1];
      if (has('td')) p.ry = st.spot;          // picked up at the line and returned the whole way
      return flag(p);
    }
    if (has('tb')){ p.res = 'tb'; return flag(p); }
    // "I2 return 10", "return-10", "return to I40": who returned it and how far.
    // A team-lettered number right before "return" is the returner, not a yard line.
    let retNo = null, retYds = null, retEnd = null;
    const ri = rest.findIndex(t => ['return', 'returned', 'returns', 'ret', 'rt'].includes(t));
    if (ri >= 0){
      const prev = rest[ri - 1], ps = prev != null ? spotOf(prev) : null, ahead = rest.slice(ri + 1);
      const n = ahead.find(t => isNum(t) && !bare.includes(+t)), s = ahead.map(spotOf).find(Boolean);
      if (s) retEnd = s;
      else if (ydNums.length) retYds = ydNums[0];
      else if (n != null) retYds = Math.abs(+n);
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
    const sp = rest.map(spotOf).find(Boolean);   // "punt to I25" or a distance
    if (sp) p.d = Math.max(0, (FL - toR(sp)) - st.spot);
    else if (bareN != null) p.d = Math.max(0, (FL - bareN) - st.spot);   // caught at their 30
    else if (after[0] != null) p.d = Math.abs(+after[0]);
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
    if (muffP){ p.res = 'muff'; if (muffP.by != null) p.by = muffP.by; if (muffP.ret != null) p.ret = muffP.ret; }
    else if (has('fc')){ p.res = 'fc'; const r = retNo ?? nx[0]; if (r != null) p.ret = r; }
    else if (has('oob')) p.res = 'oob';
    else if (has('down', 'downed')) p.res = 'down';
    else {
      if (retEnd && landR != null) retYds = toR(retEnd) - landR;
      if (start && landR != null && retYds == null){ const r = toR(start) - landR; if (r > 0) retYds = r; }
      if (retYds == null && ydNums.length) retYds = ydNums[0];
      // "caught at the 30 and returned to the 38": both are the receiving team's, so the return is the gap.
      if (retYds == null && bare.length > 1) retYds = bare[1] - bare[0];
      if (retNo == null && nx[0] != null){ retNo = nx[0]; if (retYds == null && nx[1] != null) retYds = Math.abs(+nx[1]); }
      if (retNo != null || retYds != null || ri >= 0){ p.res = 'ret'; if (retNo != null) p.ret = retNo; if (retYds != null) p.ry = retYds; }
      else p.res = 'spot';
      if (has('td') && p.d != null){ p.res = 'ret'; p.ry = st.spot + p.d; }
    }
    return flag(p);
  }
  if (has('fg')){
    const i = toks.indexOf('fg'), bi = toks.findIndex(t => t === 'blk' || t === 'blocked');
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

  /* ---- a lateral: "8-5 lateral 11-35" is #8 for 5, then #11 for 35 more ---- */
  const li = toks.findIndex(t => ['lateral', 'laterals', 'lateraled', 'lat', 'pitch', 'pitches', 'pitched'].includes(t));
  if (li >= 0 && st.phase === 'play'){
    const a = toks.slice(0, li).filter(isNum), b = toks.slice(li + 1).filter(isNum);
    if (a.length < 2 || !b.length) return bad('A lateral takes both: 8-5 lateral 11-35 is #8 for 5, then #11 for 35 more.');
    return flag({t:'run', r:a[0], y:+a[1], lat:{r:b[0], y:+(b[1] || 0)}});
  }

  /* ---- runs and passes ---- */
  let fum = null;
  const fi = toks.findIndex(t => ['fum', 'fumble', 'fumbled', 'fumbles'].includes(t));
  if (fi >= 0){
    let ft = toks.slice(fi + 1); toks = toks.slice(0, fi);
    // "… ball on I24": where the next snap is; the advance is the difference.
    let endSpot = null;
    const bi = ft.indexOf('ball');
    if (bi >= 0){
      const tail = ft.slice(bi + 1);
      endSpot = tail.map(spotOf).find(Boolean) || (tail.includes(String(HALF)) ? {side:null, n:HALF} : null);
      if (!endSpot) return bad(`Say where the ball ended up, like ball on ${L(D)}24.`);
      ft = ft.slice(0, bi);
    }
    // "A31" is team A's #31 recovering; a bare "A" is just the team.
    const who = ft.map(spotOf).find(Boolean), fn = ft.filter(isNum);
    // "recovered it himself": the man who dropped it fell on it, so it stays with the offense.
    const selfRec = ft.some(t => ['himself', 'herself', 'themselves', 'themself', 'itself'].includes(t))
      || (ft.includes('own') && ft.some(t => ['rec', 'recs', 'recovers', 'recovered', 'recovery'].includes(t)));
    const side = who ? who.side : ft.map(T).find(Boolean) || (selfRec ? O : null), lost = !side || side !== O;
    const by = who ? String(who.n) : fn[0], adv = who ? fn[0] : fn[1];
    // td anywhere on a lost-fumble line is the defense's score; on a kept fumble it's the offense's.
    const tdLine = ft.includes('td') || toks.includes('td');
    if (lost) toks = toks.filter(t => t !== 'td'); else if (tdLine && !toks.includes('td')) toks.push('td');
    fum = {lost, by, ry:Math.abs(+(adv || 0)), td:lost && tdLine, endSpot, self:selfRec && by == null,
           rs:who ? who.side : ft.map(T).find(Boolean) || null, selfRec, tdLine};
  }
  const withFum = p => {
    if (!fum) return p;
    // Where the ball came loose, in the offense's frame.
    const y = p.res === 's' ? -Math.min(p.sy, st.spot) : (+p.y || 0), at = clamp(st.spot + y, 0, FL);
    let ry = fum.ry;
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
    p.fum = {lost:fum.lost, ...(fum.by != null ? {by:fum.by} : {}), ...(fum.self ? {self:true} : {}), ry};
    return p;
  };
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
      if (fum.endSpot){
        const e = fum.endSpot, endPos = e.side == null ? HALF : e.side === rec ? e.n : FL - e.n;
        ry = endPos - (lost ? FL - fin : fin);
      }
      if (fum.tdLine) ry = lost ? fin : FL - fin;
      p.fum = {lost, ...(fum.by != null ? {by:fum.by} : {}), ...(fum.self || (fum.selfRec && fum.by == null) ? {self:true} : {}), ry};
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
    [`5-5-fum-rec-${h}10 ball on ${h}24`, 'Same, with the advance worked out from where the next snap is.'],
    [`10-0 fum ${h} rec td`, `Fumble, ${h} recovers and returns it for a touchdown.`],
    [`${a} punt ${h} ball at ${h}25`, `Punt with no return: ${h}'s drive starts at its 25. Or just ${a} punt, then ${h} ball at ${h}25 on the next line.`],
    [`${a} punt to ${h}25-${h}2 return-10`, `Fielded at the ${h} 25, #2 returns it 10. Leave off the yards and type the drive start next (${h} ball at ${h}35); the return fills in.`],
    ['punt-11-at the 30-for 6 &nbsp;·&nbsp; 19-punt-40-11-6', 'Caught at their 30, back 6 — the punt’s own distance works itself out. Or say it the short way: #19 punts 40, #11 returns it 6. Also punt-tb, punt-fc, punt-oob, punt-blk.'],
    [`19 punt 11 return 5 ball at ${h}35`, `Give the return and where the drive starts and the punt's distance is worked out: #19 punts, #11 returns 5, ${h} ball at its 35.`],
    ['15-fg &nbsp;·&nbsp; 15-fg-no', 'Field goal good / no good (distance fills in)'],
    ['15-xp &nbsp;·&nbsp; 15-xp-no', 'Kick after a touchdown. For 2 points: 3 (run) or 7-88 (pass), add -no if it failed'],
    [`ko-${a}25 &nbsp;·&nbsp; ko-${a}25-3:25`, `Kickoff; the drive starts at the ${a} 25 (with 3:25 left). No need to say who kicked. After a touchdown, enter the extra point first.`],
    ['15-ko-tb &nbsp;·&nbsp; 15-ko-55-28-21', 'Kickoff with details: touchback / 55 yards, #28 returns it 21. Also 15-ko-oob, 15-ko-onside-44.'],
    ['ko-28-at the 8-for 12 &nbsp;·&nbsp; 28 caught the kickoff at the 8 and ran it to the 20', 'Never type how far it was kicked: say where it was caught and how far it came back. Both yard lines are the receiving team’s.'],
    [`pen ${h} 15 pf`, `15 yards on ${h}. Codes: fs off hold pi pf fm uc rtp ig dog and more. Add 1st for an automatic first down.`],
    [`3-12 pen ${a} 10 hold np`, 'Flag wipes out the play (np = no play). Without np, the yards add on to the end of the play.'],
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
  return `<div class="quick">
    <input id="qk" class="qk" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
      aria-label="Type the play" placeholder="3-10 · 7-88-5 · ${esc(String(g.teams.A.abbr || a).toLowerCase())} 15 runs for 15" value="${esc(ui.qtext || '')}">
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
  ui.qtext = '';
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
  if (p.clk != null && R.st.q <= 4) g.clk = {s:p.clk, run:g.clk.run, at:Date.now()};
  if (p.clk == null && R.st.q <= 4) p.clk = Math.ceil(clockNow());
  if (p.t === 'to' || p.t === 'final') g.clk = {s:clockNow(), run:false, at:Date.now()};
  g.plays.push(p); save(); refresh(); focusQuick();
  toast(p.t === 'set' ? 'Spot set' : 'Recorded');
}
function focusQuick(){ const q = $('#qk'); if (q) q.focus(); }
function insertKey(k){
  const inp = $('#qk'); if (!inp) return;
  let v = inp.value;
  if (k === '-') v += '-';
  else if (k === 'ball at') v = v.replace(/\s+$/, '') + (v.trim() ? ' ' : '') + 'ball at ';
  else if (/^[a-z]$/i.test(k)) v += (v && !/[\s-]$/.test(v) ? ' ' : '') + k.toUpperCase();
  else v += (v && !/[\s-]$/.test(v) ? '-' : '') + k;
  inp.value = v; ui.qtext = v; inp.focus(); inp.setSelectionRange(v.length, v.length); quickPreview();
}
