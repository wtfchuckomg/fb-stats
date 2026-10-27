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
    out.push(/over|^ot/i.test(head) ? 'OT' : head);
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
