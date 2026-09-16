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
