/* ================================================================
   Box scores: a game entered after the fact from a pasted newspaper
   box score, with no plays. The line score, the scoring summary and the
   RUSHING / PASSING / RECEIVING lines become the game's totals; the
   replay reads them (boxInto), so the box score, team stats, leaders
   and the scoreboard work as they do for a statted game.

     Andover 7 7 8 10 — 32
     Hutchinson 0 7 0 14 — 21
     And – Will Quinn 79 run (Pete Vega kick)
     RUSHING: Andover — Vega 14-94; Quinn 14-92, TD; Team 2-(-33). Totals: 39-190. Hutchinson — …
     PASSING (cmp-att-yds-td-int): Andover — Quinn 6-8-87-1-0; …
     RECEIVING: Andover — Goentzel 2-80, TD; …

   The first team in the line score is the visitor. Players are keyed by
   name; a last name in the stat lines takes the full name the scoring
   summary gives it ("Vega" is "Pete Vega").
   ================================================================ */
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lastName = n => String(n).trim().split(/\s+/).pop().toLowerCase();
// A school's name as the logo library knows it, so "Collegiate" and "Wichita Collegiate" read as one school.
function canonSchool(n){
  const k = logoSlug(n);
  for (const t of logoLib.list || []) if (t.slug === k || logoSlug(t.name) === k || (t.aliases || []).some(a => logoSlug(a) === k)) return logoSlug(t.name);
  return k;
}
const sameSchool = (a, b) => { const x = logoSlug(a), y = logoSlug(b); return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x) || canonSchool(a) === canonSchool(b)); };

// The clock on a scoring line. Papers put it at the end, usually after a semicolon —
// "Will Quinn 79 run (Vega kick); 3:45" — and sometimes at the front instead.
function pullTime(d){
  const s = String(d).trim();
  let m = s.match(/[;,–—-]?\s*\(?(\d{1,2}:\d{2})\)?\s*(?:left|remaining|to go)?\s*[.]?\s*$/);
  if (m) return {desc:s.slice(0, m.index).replace(/[;,\s–—-]+$/, '').trim(), time:m[1]};
  m = s.match(/^\(?(\d{1,2}:\d{2})\)?\s*[;,—–-]?\s*/);
  if (m) return {desc:s.slice(m[0].length).trim(), time:m[1]};
  return {desc:s, time:null};
}

// What a paper calls each column — "(tackles-solo-assists-sacks-TFL-INT)", "(punts-yards-average-I20)".
const COL_WORDS = {
  tackles:'tot', tackle:'tot', tkl:'tot', tot:'tot', total:'tot', totals:'tot',
  solo:'tk', unassisted:'tk', ua:'tk', assists:'ast', assisted:'ast', assist:'ast', ast:'ast', asst:'ast',
  sacks:'sk', sack:'sk', sk:'sk', tfl:'tfl', tfls:'tfl', 'tackles for loss':'tfl',
  int:'int', ints:'int', interception:'int', interceptions:'int', picks:'int', pick:'int',
  pbu:'pbu', pd:'pbu', bu:'pbu', ff:'ff', forced:'ff', fr:'fr', recovered:'fr', recoveries:'fr', blk:'blk', blocked:'blk',
  fg:'fg', fgm:'fg', fgs:'fg', fga:'fga', xp:'xp', xpm:'xp', pat:'xp', pats:'xp', xpa:'xpa', points:'pts', pts:'pts',
  punts:'no', punt:'no', no:'no', number:'no', num:'no', returns:'no', ret:'no', rets:'no', att:'no',
  yards:'yds', yds:'yds', yard:'yds', yd:'yds', average:'avg', avg:'avg', ave:'avg',
  long:'lng', lng:'lng', lg:'lng', i20:'i20', in20:'i20', 'inside 20':'i20', tb:'tb', touchbacks:'tb', td:'td', tds:'td'
};
// The same column name means a different stat in each section, and this is the order when a heading doesn't say.
const KIND_COLS = {
  def:  {order:['tot', 'tk', 'ast', 'sk', 'tfl', 'int'], keys:{tk:'tk', ast:'ast', sk:'sk', tfl:'tfl', int:'dint', pbu:'pbu', ff:'ff', fr:'fr', blk:'bk'}},
  kick: {order:['fg', 'fga', 'xp', 'pts'], keys:{fg:'fgm', fga:'fga', xp:'xpm', xpa:'xpa', lng:'fglg'}},
  punt: {order:['no', 'yds', 'avg', 'i20'], keys:{no:'pu', yds:'puy', lng:'pulg', i20:'pi20', tb:'ptb'}},
  pret: {order:['no', 'yds', 'td'], keys:{no:'pr', yds:'pry', lng:'prlg', td:'prtd'}},
  kret: {order:['no', 'yds', 'td'], keys:{no:'kr', yds:'kry', lng:'krlg', td:'krtd'}},
  int:  {order:['no', 'yds', 'td'], keys:{no:'dint', yds:'dintY'}}
};

// Points and kind for one scoring-summary line, e.g. "Will Quinn 79 run (Pete Vega kick)".
function scoreLine(d){
  const main = d.split('(')[0];
  if (/\bFG\b|field goal/i.test(main)) return {how:'FG', pts:3};
  if (/\bsafety\b/i.test(main)) return {how:'Safety', pts:2};
  // The try is in the last parentheses, or a trailing "Vega kick)" when the "(" went missing.
  const i = d.lastIndexOf('('), pat = i >= 0 ? d.slice(i + 1) : /\bkick\)?\s*$/i.test(d) ? 'kick' : '';
  // "(Smith run)", "(Jones pass from Smith)" and "(Jones to Goentzel)" are two-point tries.
  const extra = /fail|no good|miss|block|incomplete|no try|stopped|short/i.test(pat) ? 0 : /kick|good/i.test(pat) ? 1 : /\b(run|rush|pass|catch|to)\b/i.test(pat) ? 2 : 0;
  return {how:'TD', pts:6 + extra};
}

// Passing numbers with no column heading. AP style is cmp-att-int-yds(-td), "Meeker 4-7-1-93"; others write
// cmp-att-yds-td-int, "Quinn 6-8-87-1-0". Yardage is nearly always the biggest number, which tells them apart.
function passOrder(v){
  const tail = v.slice(2), big = 2 + tail.indexOf(Math.max(...tail));
  return big === 3 ? ['cmp', 'att', 'int', 'yds', 'td'] : ['cmp', 'att', 'yds', 'td', 'int'];
}

function parseBox(txt){
  const out = {ok:false, error:'', names:[], lines:{A:[], H:[]}, total:{A:0, H:0}, scoring:[], pl:{A:{}, H:{}}, team:{A:{}, H:{}}, warn:[]};
  const rows = String(txt || '').replace(/\r/g, '').split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  // "RUSHING: Andover — …", "RUSHING – Winfield: …", "RUSHING—Winfield, …", "PASSING (cmp-att-yds-td-int): …",
  // "Passing: (cmp-att-yds-td-int): Douglass – …"
  const SEC = /^(RUSHING|PASSING|RECEIVING|KICKING|FIELD GOALS|MISSED FIELD GOALS|MISSED FGS?|FIELD GOAL ATTEMPTS|BLOCKED KICKS|INTERCEPTIONS|TACKLES|DEFENSE|DEFENSIVE|PUNTING|PUNT RETURNS|KICKOFF RETURNS|KICK RETURNS|FUMBLES|SACKS|TEAM STATS)\b\s*[:—–-]?\s*(\([^)]*\))?\s*[:—–-]?\s*(.*)$/i;
  const QTR = /^(?:(first|second|third|fourth|1st|2nd|3rd|4th)\s+(?:quarter|qtr)|(ot|overtime))\b/i;
  const QN = {first:1, '1st':1, second:2, '2nd':2, third:3, '3rd':3, fourth:4, '4th':4};
  // Which team a label like "And", "Hutch" or "Andover" means.
  const sideOf = label => {
    const k = logoSlug(label); if (!k) return null;
    const score = ['A', 'H'].map((s, i) => { const n = logoSlug(out.names[i] || ''), ini = n.split('-').map(w => w[0]).join('');
      return !n ? 0 : n === k ? 3 : ini === k ? 2 : n.startsWith(k) || k.startsWith(n) ? 1 : 0; });
    return score[0] > score[1] ? 'A' : score[1] > score[0] ? 'H' : null;
  };
  const sections = [];
  let sec = null, curQ = 0;
  for (const l of rows){
    const m = l.match(SEC);
    if (m){ sec = {kind:m[1].toUpperCase(), head:m[2] || '', body:m[3]}; sections.push(sec); continue; }
    // A stat section can run onto the next line ("Hutchinson — McCuan 12-56; …").
    if (sec && /\d+\s*-\s*\(?-?\d+/.test(l)){ sec.body += ' ' + l; continue; }
    if (out.names.length < 2){
      // A quarter is a number, or an X (or a bare dash) for one that was never played — how a mercy-rule game is
      // posted: "Flinthills 44 14 X X — 58". The dash before the total is often jammed against that last column.
      // Up to twelve columns: four quarters and as many overtimes as the game went to.
      const ls = l.match(/^(.*?[A-Za-z][^\d]*?)\s+((?:(?:\d+|[Xx]|[—–-])\s*[ ]\s*){2,11}(?:\d+|[Xx]|[—–-]))\s*(?:[—–-]+\s*(\d+))?$/);
      if (ls){
        const cell = v => /^[Xx]$/.test(v) || /^[—–-]$/.test(v) ? null : Number(v);
        let q = ls[2].trim().split(/\s+/).map(cell), tot = ls[3] != null ? +ls[3] : null;
        const add = a => a.reduce((t, v) => t + (v || 0), 0);
        if (tot == null && q.length >= 5 && q[q.length - 1] != null && q[q.length - 1] === add(q.slice(0, -1))) tot = q.pop();
        // Each overtime keeps its own column, however many there were: "10 10 0 7 0 6 0 6 0 — 39".
        const s = out.names.length ? 'H' : 'A', name = ls[1].replace(/[\s:,.—–-]+$/, ''), sum = add(q);
        out.names.push(name); out.lines[s] = q; out.total[s] = tot ?? sum;
        if (tot != null && tot !== sum) out.warn.push(`${name}’s quarters add up to ${sum}, but the total says ${tot}. Using ${tot}.`);
        sec = null; continue;
      }
    }
    const qh = l.match(QTR);
    if (qh){ curQ = qh[2] ? 5 : QN[qh[1].toLowerCase()]; sec = null; continue; }
    const sc = out.names.length === 2 && l.match(/^([A-Za-z][A-Za-z.'& ]{0,24}?)\s*[—–:-]\s+(.+)$/);
    const side = sc && sideOf(sc[1]);
    if (side){
      const t = pullTime(sc[2]);
      out.scoring.push({side, label:sc[1].trim(), desc:t.desc, time:t.time, q:curQ, ...scoreLine(t.desc)});
      sec = null; continue;
    }
    if (sec) sec.body += ' ' + l;
  }
  if (out.names.length < 2){
    out.error = 'Couldn’t find the line score: each team’s name, its quarter scores and the total, like “Andover 7 7 8 10 — 32”.';
    return out;
  }

  // Full names from the scoring summary, so "Vega" in the stat lines reads as "Pete Vega". A "first name"
  // that is some other player's last name ("from Quinn Vega kick", with a "(" missing) isn't one.
  const full = {A:{}, H:{}};
  out.scoring.forEach(e => (e.desc.match(/\b[A-Z][a-zA-Z'’.-]+(?: [A-Z][a-zA-Z'’.-]+)+/g) || []).forEach(n => {
    const m = full[e.side], k = lastName(n); (m[k] = m[k] || {})[n] = (m[k][n] || 0) + 1; }));
  ['A', 'H'].forEach(s => Object.values(full[s]).forEach(opts => Object.keys(opts).forEach(n => {
    if (full[s][n.split(' ')[0].toLowerCase()]) delete opts[n]; })));
  const display = (s, raw) => {
    const opts = full[s][lastName(raw)];
    if (raw.includes(' ') || !opts || !Object.keys(opts).length) return raw;
    return Object.entries(opts).sort((a, b) => b[1] - a[1])[0][0];
  };
  // A player by name. Full names stay apart ("Mason Rush", "Brody Rush"); a bare last name ("Vega") joins the one
  // player with that last name; and a full name takes over a bare one met earlier.
  const player = (s, raw) => {
    raw = raw.trim();
    if (/^team$/i.test(raw)) return out.pl[s].team || (out.pl[s].team = {});
    const name = display(s, raw), k = lastName(name), keys = Object.keys(out.pl[s]).filter(n => n !== 'team');
    const exact = keys.find(n => n.toLowerCase() === name.toLowerCase()), same = keys.filter(n => lastName(n) === k);
    if (exact) return out.pl[s][exact];
    if (!name.includes(' ')) return same.length === 1 ? out.pl[s][same[0]] : (out.pl[s][name] = {});
    const bare = same.find(n => !n.includes(' '));
    if (bare){ out.pl[s][name] = out.pl[s][bare]; delete out.pl[s][bare]; return out.pl[s][name]; }
    return (out.pl[s][name] = {});
  };
  // Kickers go by last name, sometimes with a stray word ("from Quinn Vega kick)"): the one player with that last name.
  const kicker = (s, raw) => {
    const k = lastName(raw), same = Object.keys(out.pl[s]).filter(n => n !== 'team' && lastName(n) === k);
    return same.length === 1 ? out.pl[s][same[0]] : player(s, raw);
  };
  const add = (o, k, v) => { o[k] = (o[k] || 0) + v; };
  // A name with no team on it: whichever side already knows him — from a stat line, or from the scoring
  // summary, where a kicker turns up as "(McFadden kick)". Only when exactly one side does.
  function whoseName(raw){
    const k = lastName(raw), re = new RegExp(`\\b${escRe(String(raw).trim())}\\b`, 'i');
    const sides = ['A', 'H'].filter(s =>
      Object.keys(out.pl[s]).some(n => lastName(n) === k)
      || out.scoring.some(e => e.side === s && re.test(e.desc)));
    return sides.length === 1 ? sides[0] : null;
  }
  // Numbers in "14-94", "3--5", "2-(-33)" or "1-(4)"; a number in parentheses is a loss.
  const nums = s => [...s.replace(/(\d)\s*-\s*-(\d+)/g, '$1-(-$2)').matchAll(/\((-?\d+)\)|(\d+)/g)].map(m => m[1] != null ? -Math.abs(+m[1]) : +m[2]);
  const tds = rest => { const m = rest.match(/(\d+)?\s*TDs?\b/i); return m ? +(m[1] || 1) : 0; };
  // A section's body, split at each team's name: "Andover — …. Hutchinson — …".
  const splitTeams = body => {
    // One-letter labels ("W", "C") mark scoring plays but are too short to split a stat line on.
    const alts = [...new Set([...out.names, ...out.scoring.map(e => e.label)])].filter(a => a && a.length > 1).sort((a, b) => b.length - a.length);
    const re = new RegExp(`(?:^|[.;:)]\\s*)(${alts.map(escRe).join('|')})\\s*(?:[—–:,]|\\s-)\\s*`, 'gi'), hits = [...body.matchAll(re)];
    return hits.map((h, i) => [sideOf(h[1]), body.slice(h.index + h[0].length, i + 1 < hits.length ? hits[i + 1].index : undefined)]).filter(x => x[0]);
  };
  const kicked = new Set(), missed = new Set();   // kickers a section has already counted
  for (const sc of sections){
    const K = sc.kind.toUpperCase();
    const kind = /^RUSH/.test(K) ? 'rush' : /^PASS/.test(K) ? 'pass' : /^REC/.test(K) ? 'rec'
      : /^PUNT RET/.test(K) ? 'pret' : /^KICK(OFF)? RET/.test(K) ? 'kret'
      : /^MISSED|^BLOCKED KICKS|^FIELD GOAL ATTEMPTS/.test(K) ? 'miss'
      : /^DEF|^TACKL|^SACK|^FUMBLE/.test(K) ? 'def' : /^KICKING|^FIELD GOAL/.test(K) ? 'kick'
      : /^PUNTING/.test(K) ? 'punt' : /^INTERCEPT/.test(K) ? 'int' : /^TEAM/.test(K) ? 'team' : '';
    if (!kind){ out.warn.push(`${sc.kind[0]}${sc.kind.slice(1).toLowerCase()} lines aren’t read yet, so they’re left out.`); continue; }
    // "Mulvane — 333 total yards, 62 plays, 243 rushing, 90 passing, 17 first downs, 2-10 penalties"
    if (kind === 'team'){
      for (const [s, part] of splitTeams(sc.body)){
        const one = re => { const m = part.match(re); return m ? +m[1] : null; };
        const set = (k, v) => { if (v != null) out.team[s][k] = v; };
        set('plays', one(/(\d+)\s*(?:total\s*)?plays\b/i));
        set('rushY', one(/(\d+)\s*(?:yards\s*)?rushing\b/i) ?? one(/rushing[^\d]{0,12}(\d+)/i));
        set('passY', one(/(\d+)\s*(?:yards\s*)?passing\b/i) ?? one(/passing[^\d]{0,12}(\d+)/i));
        set('fd', one(/(\d+)\s*first downs\b/i));
        const pen = part.match(/(\d+)\s*-\s*(\d+)\s*penalt/i);
        if (pen){ out.team[s].pen = +pen[1]; out.team[s].penY = +pen[2]; }
      }
      continue;
    }
    // "MISSED FIELD GOALS: Newton — Oswald 39 (blocked), 45." Each distance is an attempt and no make;
    // a blocker who is named gets the block.
    if (kind === 'miss'){
      const teamed = splitTeams(sc.body);
      // Often written with no team and no distance at all — "Missed field goals: McFadden".
      for (const [s0, part] of (teamed.length ? teamed : [[null, sc.body]])){
        part.split(/;\s*|,\s*(?=[A-Za-z])|\.\s+/).map(x => x.trim().replace(/\.$/, '')).filter(Boolean).forEach(item => {
          // "McFadden 39", "McFadden, 36", "McFadden – 36 (blocked)": a name, then however it is separated
          // from the distances, if there are any.
          const m = item.match(/^([A-Za-z][A-Za-z.'’ -]*?)\s*[,;:–—-]?\s*(\d[\s\S]*)?$/);
          if (!m || !m[1].trim()) return;
          const who = m[1].trim(), s = s0 || whoseName(who);
          if (!s){ out.warn.push(`Couldn’t tell which team ${who} kicks for, so that missed kick was left out. Put the team in front of it.`); return; }
          const p = kicker(s, who), dist = ((m[2] || '').match(/\d+/g) || []).map(Number);
          missed.add(s + '|' + lastName(who));
          (dist.length ? dist : [0]).forEach(() => add(p, 'fga', 1));
          const by = item.match(/blocked\s+by\s+([A-Za-z][A-Za-z.'’ -]*)/i);
          if (by) add(player(s === 'A' ? 'H' : 'A', by[1]), 'bk', 1);
        });
      }
      continue;
    }
    // Columns follow the heading when it names them — "(cmp-att-yds-td-int)", "(punts-yards-average-I20)".
    const named = ((sc.head.match(/\(([^)]*)\)/) || [])[1] || '').toLowerCase().split(/[-–,]/).map(x => x.trim()).filter(Boolean);
    const order = kind === 'pass' ? named
      : KIND_COLS[kind] ? (named.map(w => COL_WORDS[w] || w).filter(w => w) .length ? named.map(w => COL_WORDS[w] || w) : KIND_COLS[kind].order)
      : null;
    for (const [s, part] of splitTeams(sc.body)){
      // Players are split by semicolons, or by commas when the next thing is another player ("Chattam 16-133, Bergeson
      // 10-124"); a comma before "TD" or "3 TD" stays with its player.
      part.split(/;\s*|\.\s+(?=totals?\b)/i).flatMap(x => x.split(/,\s*(?=[A-Za-z][A-Za-z.'’ -]*\s\(?-?\d+\)?\s*-\s*\(?-?\d)/))
        .map(x => x.trim().replace(/\.$/, '')).filter(Boolean).forEach(item => {
        const tot = item.match(/^totals?:?\s*(.*)$/i);
        if (tot){ const v = nums(tot[1]); if (kind === 'rush' && v.length >= 2) Object.assign(out.team[s], {rushN:v[0], rushY:v[1]}); return; }
        const m = item.match(/^(.+?)\s+(\(?-?\d+\)?(?:\s*-\s*\(?-?\d+\)?)+)(.*)$/);
        if (!m) return;
        const v = nums(m[2]), p = player(s, m[1]), td = tds(m[3]);
        if (kind === 'rush'){ add(p, 'ru', v[0] || 0); add(p, 'ry', v[1] || 0); add(p, 'rtd', td); }
        if (kind === 'rec'){ add(p, 're', v[0] || 0); add(p, 'rey', v[1] || 0); add(p, 'retd', td); }
        if (kind === 'pass'){
          const f = {}; (order.length ? order : passOrder(v)).forEach((k, i) => { f[k] = v[i] || 0; });
          add(p, 'pc', f.cmp || f.c || 0); add(p, 'pa', f.att || f.a || 0); add(p, 'py', f.yds || f.y || 0); add(p, 'ptd', f.td || 0); add(p, 'pint', f.int || f.i || 0);
        }
        if (KIND_COLS[kind]){
          const {keys} = KIND_COLS[kind], f = {};
          order.forEach((c, i) => { if (c && v[i] != null) f[c] = v[i]; });
          // Tackles are printed as total-solo-assists; the book keeps solo and assists and adds them back up.
          if (kind === 'def'){
            if (f.tk == null && f.tot != null) f.tk = f.ast != null ? Math.max(0, f.tot - f.ast) : f.tot;
            if (f.ast == null && f.tot != null && f.tk != null && f.tot > f.tk) f.ast = f.tot - f.tk;
          }
          Object.entries(f).forEach(([c, n]) => { const k = keys[c]; if (k && n) add(p, k, n); });
          if (kind === 'kick') kicked.add(s + '|' + lastName(m[1]));
          // An extra point made is an extra point tried, unless the paper counted the tries itself.
          if (kind === 'kick' && f.xp && f.xpa == null) add(p, 'xpa', f.xp);
        }
      });
    }
  }
  // Stat lines that don't mark touchdowns get them from the scoring summary, written either way round: "Bergeson 48 run",
  // "Cosby 17 pass from Wilbur", "1 yd run Carter Green", "26 yd pass Kane Ast to Ryan Stiner". Whatever the stat lines
  // do mark ("Quinn 14-92, TD", or a TD column in the passing line) is left as it is.
  const YD = String.raw`\d+\s*(?:-?\s*(?:yd|yard)s?\.?)?`;
  const RUN = [new RegExp(String.raw`^(.+?)\s+${YD}\s+run\b`, 'i'), new RegExp(String.raw`^${YD}\s+run\s+(?:by\s+)?(.+)$`, 'i')];
  const PASS = [[new RegExp(String.raw`^(.+?)\s+${YD}\s+pass\s+from\s+(.+)$`, 'i'), 1, 2],        // receiver, passer
                [new RegExp(String.raw`^${YD}\s+pass\s+(?:from\s+)?(.+?)\s+to\s+(.+)$`, 'i'), 2, 1]];  // passer, receiver
  const RETS = String.raw`(?:fumble|interception|int|kickoff|kick|punt|blocked\s+(?:punt|kick|field\s+goal|fg))`;
  const RET = [new RegExp(String.raw`^(.+?)\s+${YD}\s+${RETS}\s+return\b`, 'i'), new RegExp(String.raw`^${YD}\s+${RETS}\s+return\s+(?:by\s+)?(.+)$`, 'i')];
  ['A', 'H'].forEach(s => {
    const has = k => Object.values(out.pl[s]).some(p => p[k]), noR = !has('rtd'), noRe = !has('retd'), noP = !has('ptd');
    out.scoring.filter(e => e.side === s && e.how === 'TD').map(e => e.desc.split('(')[0].trim()).forEach(d => {
      const r = RUN.map(re => d.match(re)).find(Boolean);
      if (r){ if (noR) add(player(s, r[1]), 'rtd', 1); return; }
      for (const [re, ri, qi] of PASS){
        const m = d.match(re);
        if (m){ if (noRe) add(player(s, m[ri]), 'retd', 1); if (noP) add(player(s, m[qi]), 'ptd', 1); return; }
      }
      // Return touchdowns ("Higgins 4 fumble return", "22 yd punt return Smith"); no stat line carries these.
      const t = RET.map(re => d.match(re)).find(Boolean);
      if (t) add(player(s, t[1]), 'rettd', 1);
    });
  });
  // Kickers, from the scoring summary: "Vega 29 FG", "(Pete Vega kick)". A kicking section counted those men
  // already, so they are left alone; a missed-kicks section only counted what didn't go through.
  const counted = (s, raw) => kicked.has(s + '|' + lastName(raw));
  out.scoring.forEach(e => {
    if (e.how === 'FG'){
      // "Vega 29 FG" or "29 yd FG Vega"
      const m = e.desc.match(/^(.+?)\s+(\d+)\s*(?:-?\s*(?:yd|yard)s?\.?)?\s*(?:FG|field goal)/i);
      const m2 = e.desc.match(/^(\d+)\s*(?:-?\s*(?:yd|yard)s?\.?)?\s*(?:FG|field goal)\s+(?:by\s+)?([A-Z][^(]*?)\s*(?:\(|$)/i);
      const who = m && !/^\d+$/.test(m[1]) ? [m[1], m[2]] : m2 ? [m2[2], m2[1]] : null;
      if (who && !counted(e.side, who[0])){ const p = kicker(e.side, who[0]); add(p, 'fga', 1); add(p, 'fgm', 1); p.fglg = Math.max(p.fglg || 0, +who[1]); }
    }
    if (e.how === 'TD'){
      const i = e.desc.lastIndexOf('('), km = (i >= 0 ? e.desc.slice(i + 1) : e.desc).match(/([A-Z][\w'’.-]*(?: [A-Z][\w'’.-]*)?)\s+kick\b(.*)$/);
      if (km && !counted(e.side, km[1])){ const p = kicker(e.side, km[1]); add(p, 'xpa', 1); if (!/fail|no good|miss|block/i.test(km[2])) add(p, 'xpm', 1); }
      // A good two-point try goes to whoever scored it: "(Ecot pass from Meeker)", "(Ast pass to Green)", "(Carter Green run)".
      if (e.pts === 8){
        const j = e.desc.lastIndexOf('('), t = j >= 0 ? e.desc.slice(j + 1).replace(/\)\s*$/, '').trim() : '';
        const m2 = t.match(/^(.+?)\s+pass\s+from\b/i) || t.match(/\bto\s+(.+)$/i) || t.match(/^(.+?)\s+(?:run|rush)\b/i);
        if (m2) add(player(e.side, m2[1]), 'two', 1);
      }
    }
  });
  ['A', 'H'].forEach(s => {
    const t = out.team[s], ps = Object.values(out.pl[s]), sum = k => ps.reduce((a, p) => a + (p[k] || 0), 0);
    if (t.rushN == null){ t.rushN = sum('ru'); t.rushY = sum('ry'); }
    Object.assign(t, {passC:sum('pc'), passA:sum('pa'), passY:sum('py'), passTD:sum('ptd'), passInt:sum('pint')});
  });
  // Quarters for the scoring plays, when the summary has no quarter headings: each team's running score
  // against its line score, quarter by quarter.
  if (!out.scoring.some(e => e.q)){
    const nq = Math.max(out.lines.A.length, out.lines.H.length), run = {A:0, H:0}, thru = (s, i) => out.lines[s].slice(0, i + 1).reduce((a, b) => a + (b || 0), 0);
    let q = 0;
    out.scoring.forEach(e => { run[e.side] += e.pts; while (q < nq - 1 && thru(e.side, q) < run[e.side]) q++; e.q = q + 1; });
  }
  ['A', 'H'].forEach((s, i) => {
    const pts = out.scoring.filter(e => e.side === s).reduce((a, e) => a + e.pts, 0);
    if (out.scoring.length && pts !== out.total[s]) out.warn.push(`The scoring plays add up to ${pts} for ${out.names[i]}, but the line score says ${out.total[s]}. The line score is what counts.`);
  });
  out.ok = true;
  return out;
}
// The scoreboard entry a pasted box score belongs to when it wasn't opened from one: a scheduled game or quick
// score between the same two schools, in the week of the game date (or the only such game there is).
const samePair = (p, x) => !!x.teams && ((sameSchool(p.names[0], x.teams.A.name) && sameSchool(p.names[1], x.teams.H.name))
  || (sameSchool(p.names[0], x.teams.H.name) && sameSchool(p.names[1], x.teams.A.name)));
const weekOfDate = date => /^\d{4}-\d\d-\d\d$/.test(date || '') ? weekKey(fromYmd(date).getTime()) : null;
function boxMatch(p, date){
  if (!p.ok) return null;
  const all = Object.values(qsLib()).filter(x => !x.deleted && samePair(p, x)), wk = weekOfDate(date);
  return all.find(x => gameWeek(x) === wk) || (all.length === 1 ? all[0] : null);
}
// A box score this device already has for the same two schools that week: pasting again updates it.
function boxPrior(p, date){
  if (!p.ok) return null;
  const wk = weekOfDate(date);
  return Object.values(db.games).find(y => y.box && samePair(p, y) && gameWeek(y) === wk) || null;
}
function swapBox(p){
  const sw = o => { const a = o.A; o.A = o.H; o.H = a; };
  [p.lines, p.total, p.pl, p.team].forEach(sw); p.names.reverse();
  p.scoring.forEach(e => { e.side = e.side === 'A' ? 'H' : 'A'; });
}

// A saved box score is read again from its pasted text each time it's shown, so a fix to the reader reaches games
// already saved, for everyone. The game's own team order wins over the paper's.
const boxCache = new Map();
function boxData(game){
  const b = game.box, T = game.teams;
  if (!b.src || !T) return b;
  const key = `${T.A.name}|${T.H.name}|${b.src}`;
  if (!boxCache.has(key)){
    const p = parseBox(b.src);
    if (p.ok && !sameSchool(p.names[0], T.A.name) && sameSchool(p.names[0], T.H.name) && sameSchool(p.names[1], T.A.name)) swapBox(p);
    boxCache.set(key, p.ok ? {lines:p.lines, total:p.total, scoring:p.scoring, pl:p.pl, team:p.team} : b);
  }
  return boxCache.get(key);
}
// The replay's totals for a box-score game (called from replay).
function boxInto(game, st, S, scoring){
  const b = boxData(game);
  // The paste didn't read as a box score (or hasn't been re-read yet): leave the game empty rather than throw.
  if (!b || !b.lines || !b.lines.A || !b.lines.H) return;
  ['A', 'H'].forEach(s => {
    const q = b.lines[s] || [];
    // A quarter the paste marked X (or left off) stays null, so the line score shows an X rather than a 0.
    // However many columns the paste had, they all come through — four quarters and an overtime apiece.
    const cols = Math.max(5, q.length, (b.lines[s === 'A' ? 'H' : 'A'] || []).length);
    st.lines[s] = Array.from({length:cols}, (_, i) => i < q.length ? (q[i] == null ? null : +q[i] || 0) : null);
    st.score[s] = b.total && b.total[s] != null ? +b.total[s] : st.lines[s].reduce((a, v) => a + (v || 0), 0);
    Object.assign(S.team[s], b.team[s] || {});
    S.pl[s] = {};
    // Longest gains and sacks aren't in a box score: blank, not zero.
    Object.entries(b.pl[s] || {}).forEach(([k, p]) => { S.pl[s][k] = Object.assign(zeros(PL_KEYS), {plg:'', rlg:'', relg:'', psk:''}, p, {n:k}); });
  });
  // A box score only lists the quarters that were played, so a mercy-shortened game shows an X for the rest —
  // whether the paste stopped short or spelled the unplayed quarters out as X.
  // Count only the columns that carry a figure: a trailing X (or a blank OT slot) must not read as overtime.
  const played = ['A', 'H'].reduce((n, s) => st.lines[s].reduce((m, v, i) => v != null && i + 1 > m ? i + 1 : m, n), 0);
  Object.assign(st, {final:true, phase:'final', q:played > 4 ? 5 : 4, qPlayed:Math.min(played, 5), typed:true, drive:null});
  const run = {A:0, H:0};
  (b.scoring || []).forEach(e => {
    run[e.side] += e.pts || 0;
    // The time the paste gave for that score, so a box-score game reads like a tracked one.
    const c = e.time ? parseClock(e.time) : null;
    scoring.push({q:e.q || 4, clk:c == null ? null : c, side:e.side, how:e.how, desc:e.desc, A:run.A, H:run.H, i:-1});
  });
}

/* ---------- the paste-a-box-score window ---------- */
function boxPreview(p){
  if (!p.names.length) return '<p class="hint" style="margin:0">Paste the box score above. It needs at least the line score: each team, its quarter scores and the total.</p>';
  if (!p.ok) return `<p class="hint bx-warn" style="margin:0">${esc(p.error)}</p>`;
  const players = ['A', 'H'].reduce((a, s) => a + Object.keys(p.pl[s]).filter(k => k !== 'team').length, 0);
  // Say where it goes: over an earlier box score for the same game, over its scoreboard card, or in as a new game.
  const dateNow = ($('#bx-date') || {}).value, from = ui.boxGame ? null : ui.boxFrom ? qsLib()[ui.boxFrom] : boxMatch(p, dateNow);
  const prior = ui.boxGame ? null : boxPrior(p, (from && from.date) || dateNow);
  const where = w => `${esc(w.teams.A.name)} at ${esc(w.teams.H.name)}, ${esc(weekLabel(gameWeek(w)))}`;
  const goes = ui.boxGame || (ui.boxFrom && !prior) ? '' : `<div class="muted">${prior ? `Updates your earlier box score for ${where(prior)}.`
    : from ? `Replaces ${where(from)} on the scoreboard.` : 'Goes on the scoreboard as a new game.'}</div>`;
  return `<div class="bx-sum"><b>${esc(p.names[0])} ${p.total.A}, ${esc(p.names[1])} ${p.total.H}</b> · Final
      <div class="muted">${p.scoring.length} scoring plays · ${players} players with stats</div>${goes}</div>
    ${p.warn.map(w => `<p class="hint bx-warn">${esc(w)}</p>`).join('')}`;
}
function dlgBox(){
  const old = ui.boxGame && db.games[ui.boxGame], from = !old && ui.boxFrom ? qsLib()[ui.boxFrom] : null, who = old || from;
  const src = old && old.box ? old.box.src || '' : '', date = who ? ymd(gameDay(who)) : scoreDefaultDate();
  return `${dlgHead(old ? 'Edit box score' : 'Paste a box score')}<div class="dlg-bd">
    ${who && who.teams ? `<p class="hint" style="margin:0"><b>${esc(who.teams.A.name)} at ${esc(who.teams.H.name)}</b>${from ? ' · from the scoreboard' : ''}</p>` : ''}
    <div class="fld"><label class="eyebrow" for="bx-txt">Box score · line score, scoring plays, then RUSHING, PASSING, RECEIVING</label>
      <textarea class="inp bx-txt" id="bx-txt" rows="12" spellcheck="false" placeholder="Andover 7 7 8 10 — 32&#10;Hutchinson 0 7 0 14 — 21&#10;And – Will Quinn 79 run (Pete Vega kick)&#10;…&#10;RUSHING: Andover — Vega 14-94; …&#10;PASSING (cmp-att-yds-td-int): Andover — Quinn 6-8-87-1-0; …&#10;RECEIVING: Andover — Goentzel 2-80, TD; …">${esc(src)}</textarea></div>
    <div class="bx-prev" id="bx-prev">${boxPreview(parseBox(src))}</div>
    <div class="fld"><label class="eyebrow" for="bx-date">Game date</label><input class="inp" type="date" id="bx-date" value="${date}"></div></div>
    <div class="dlg-ft"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" data-box-save>Save box score</button></div>`;
}
function saveBox(){
  const txt = $('#bx-txt').value, p = parseBox(txt);
  if (!p.ok) return toast(p.error || 'Couldn’t read that box score');
  const dv = $('#bx-date').value;
  // Opened from a card, that card; otherwise the scheduled game or quick score it matches, if there is one.
  const from = ui.boxGame ? null : ui.boxFrom ? qsLib()[ui.boxFrom] : boxMatch(p, dv);
  // Pasting again for the same game updates the earlier box score rather than adding a second game.
  const old = ui.boxGame ? db.games[ui.boxGame] : boxPrior(p, (from && from.date) || dv), replaced = !!old && !ui.boxGame;
  const base = (old || from || {}).teams;
  // The scoreboard's (or the game's) school names when the pasted ones are the same schools, either way round.
  let names = {A:p.names[0], H:p.names[1]};
  if (base){
    const straight = sameSchool(p.names[0], base.A.name) && sameSchool(p.names[1], base.H.name);
    const flipped = sameSchool(p.names[0], base.H.name) && sameSchool(p.names[1], base.A.name);
    if (flipped && !straight) swapBox(p);
    if (straight || flipped) names = {A:base.A.name, H:base.H.name};
  }
  const team = s => {
    const t = findTeam(names[s]) || {}, was = base && sameSchool(base[s].name, names[s]) ? base[s] : {};
    return {name:names[s], mascot:t.mascot || was.mascot || '', abbr:t.abbr || was.abbr || shortName(names[s]), color:t.color || was.color || '#4A4B4D',
      roster:(old && old.teams[s].roster) || t.roster || {}, rec:was.rec || '', hrec:was.hrec || ''};
  };
  // Opened from a game or a card, the date in the window; found on its own, that game's date.
  const typed = /^\d{4}-\d\d-\d\d$/.test(dv) ? dv : ymd(new Date());
  const date = ui.boxGame || ui.boxFrom ? typed : (from && from.date) || (old && old.date) || typed;
  const box = {lines:p.lines, total:p.total, scoring:p.scoring.map(({side, how, pts, desc, q}) => ({side, how, pts, desc, q})), pl:p.pl, team:p.team, src:txt};
  // A new one goes on everyone's scoreboard, where its Box Score opens.
  const x = old || {id:'g' + Date.now().toString(36), created:Date.now(), set:{qtr:12, men:11, firstKick:'H'}, plays:[], clk:{s:0, run:false, at:0}, share:true};
  Object.assign(x, {teams:{A:team('A'), H:team('H')}, date, box, updated:Date.now()});
  db.games[x.id] = x; persist(); syncPush(x, 0);
  closeDialog();
  // Show the week it went into, in case that isn't the week on screen.
  const wk = gameWeek(x); if (wk !== shownWeek()) ui.week = wk;
  // And open the game on its Box Score, so the stats are right there, unless a game is being scored right now.
  const busy = g && g.id !== x.id && !g.sample && !g.box && g.plays.length && R && !R.st.final;
  if (!busy){ g = x; resetUi(); ui.tab = 'box'; setCurrent(); refresh(); scrollTo({top:0, behavior:'smooth'}); }
  else renderScores();
  toast(`Box score ${replaced ? 'updated' : 'saved'} in ${weekLabel(wk)}: ${x.teams.A.abbr} ${p.total.A}, ${x.teams.H.abbr} ${p.total.H}${busy ? '. Tap its card to see it.' : ''}`);
}
// On the scorer's page a box-score game has nothing to record; it can be edited.
function boxPad(){
  return `<div class="card-hd"><h2 class="card-title">Box score</h2></div>
    <p class="hint">This game was entered from a pasted box score, so there are no plays to record. Everyone sees its line score, scoring summary and stats.</p>
    <div class="line"><button type="button" class="btn small primary" data-box-edit>Edit box score</button></div>`;
}

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('button'); if (!b || ui.viewer) return;
  const d = b.dataset;
  if ('qsBox' in d){ ui.boxFrom = d.qsBox || null; ui.boxGame = null; return openDialog('box'); }
  if ('boxNew' in d){ ui.boxFrom = ui.boxGame = null; return openDialog('box'); }
  if ('boxEdit' in d){ ui.boxGame = g.id; ui.boxFrom = null; return openDialog('box'); }
  if ('boxSave' in d) return saveBox();
});
document.addEventListener('input', e => { if (e.target.id === 'bx-txt' || e.target.id === 'bx-date') $('#bx-prev').innerHTML = boxPreview(parseBox($('#bx-txt').value)); });
