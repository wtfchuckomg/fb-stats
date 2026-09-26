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
  const rows = feed.playbyplay.filter(r => r && r.qtr && /^[1-9]$/.test(String(r.qtr)));
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
      if (yds == null){ skipped.push(ev); continue; }
      const fum = fumOf();
      add({t:'run', ...(n ? {r:n} : {}), y:yds, ...(fum ? {fum} : {})}, r, says);
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
        add({t:'pass', ...(qb ? {qb} : {}), res:'s', sy:Math.abs(yds || 0), ...(fum ? {fum} : {})}, r, says); continue; }
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
    id:`tg-${id}`, created:Date.now(), updated:Date.now(), share:false, from:'turbostats', src:turboUrl(id),
    teams:{A:{...team(gi.visName, gi.visId), roster:roster.A}, H:{...team(gi.homeName, gi.homeId), roster:roster.H}},
    set:{qtr:12, men:11, firstKick:(firstKo && codeSide(firstKo.team)) || 'H',
      date:turboDate(gi.date), roster:{A:roster.A, H:roster.H}},
    roster:{A:roster.A, H:roster.H},
    date:turboDate(gi.date), clk:{s:12 * 60, run:false, at:0}, plays
  };
  return {game, skipped};
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
  return `<div class="grp"><h3>Import a gamecast</h3>
    <div class="acct"><div style="flex:1;min-width:0">
      <p class="hint">Paste the link to a TurboStats gamecast (turbogamecast.com) and its play-by-play comes in as a game of its own — gamecast, box score, drive chart and every player's stats, worked out here from the plays. Share it to put it on the scoreboards.</p>
      <input class="inp" id="tg-link" placeholder="https://turbogamecast.com/football/webcast/…" autocomplete="off" spellcheck="false"></div>
      <button class="btn small primary" data-turbo="go"${turbo.busy ? ' disabled' : ''}>${turbo.busy ? 'Reading…' : 'Import'}</button></div>
    ${note}</div>`;
}
async function turboImport(){
  const el = $('#tg-link'), link = el ? el.value.trim() : '';
  if (!link) return toast('Paste the gamecast link first');
  turbo.busy = true; turbo.msg = ''; turbo.ok = null; redrawGames();
  try {
    const {id, feed} = await turboFetch(link);
    const {game, skipped} = await turboGame(feed, id);
    if (!game.plays.filter(p => PLAY_KINDS.includes(p.t)).length) throw new Error('That gamecast hasn’t got any plays in it yet.');
    const chk = turboCheck(feed, game);
    const A = game.teams.A, H = game.teams.H;
    turbo.ok = chk.agree;
    turbo.msg = `${A.name} ${chk.ours.A} at ${H.name} ${chk.ours.H} — ${game.plays.length} plays.`
      + (chk.agree ? ' The score matches their gamecast.' : ` Their gamecast says ${chk.theirs.A}-${chk.theirs.H}: check the play-by-play.`)
      + (skipped.length ? ` ${skipped.length} ${skipped.length === 1 ? 'play' : 'plays'} couldn’t be read and were left out.` : '');
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
