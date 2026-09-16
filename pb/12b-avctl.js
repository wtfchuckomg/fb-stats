/* ================================================================
   AVCTL — the Ark Valley-Chisholm Trail League and its four
   divisions, with the pages Butler County has: a scoreboard,
   standings, and player and team stats, all of it the league's own
   schools only. The alignment is KPreps' (its league pages, 2026);
   the names are this site's, so logos and rosters match.
   ================================================================ */
const AVCTL_DIV = {
  I:   ['Campus', 'Derby', 'Hutchinson', 'Maize', 'Maize South', 'Salina South', 'Valley Center'],
  II:  ['Andover', 'Andover Central', 'Arkansas City', 'Eisenhower', 'Goddard', 'Newton', 'Salina Central'],
  III: ['Augusta', 'Buhler', 'Circle', 'McPherson', 'Mulvane', 'Winfield'],
  IV:  ['Andale', 'Clearwater', 'El Dorado', 'Rose Hill', 'Wellington', 'Wichita Collegiate']
};
// What KPreps and the schools themselves call some of them.
const AVCTL_ALIASES = {Campus:['Haysville Campus'], Eisenhower:['Goddard-Eisenhower'], Circle:['Towanda-Circle']};
const AVCTL = Object.keys(AVCTL_DIV).reduce((all, d) => all.concat(AVCTL_DIV[d]), []);
const AV_NAMES = ['I', 'II', 'III', 'IV'];
const avctlOf = name => AVCTL.find(c => [c, ...(AVCTL_ALIASES[c] || [])].some(a => logoSlug(a) === logoSlug(name))) || null;
const avctlDiv = name => { const s = avctlOf(name); return s ? AV_NAMES.find(d => AVCTL_DIV[d].indexOf(s) > -1) : null; };
// A game belongs to the league if either team does.
const inAvctl = x => !!x && !!x.teams && (!!avctlOf(x.teams.A.name) || !!avctlOf(x.teams.H.name));

const AV_BOARD = new URLSearchParams(location.search).has('avctl');       // ?avctl: the league's scoreboard
const AV_STAND = new URLSearchParams(location.search).has('standings');   // ?standings: the four divisions
const AV_STATS = new URLSearchParams(location.search).has('avstats');     // ?avstats: the league's stats

/* ---------- standings ---------- */
const stand = {err:''};

async function startStandings(){
  ui.viewer = true; ui.stand = true; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  loadLogos(); renderStandings();
  try {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-`;
    const [appM, fsM] = await Promise.all([import(base + 'app.js'), import(base + 'firestore.js')]);
    const fsdb = fsM.getFirestore(appM.initializeApp(firebaseConfig));
    scoresReady({fsM, fsdb});   // the scores strip, the hidden list, every shared game and the records
  } catch (e) { stand.err = 'Can’t reach the games. Check your connection and reload.'; renderStandings(); }
}

// A team's league season: every final on the site, with division games counted apart from the rest.
function avRecord(name){
  const div = avctlDiv(name);
  const r = {gp:0, w:0, l:0, t:0, dw:0, dl:0, dt:0, pf:0, pa:0};
  schoolRows(name).forEach(row => {
    const f = finalOf(row.x); if (!f.fin) return;
    const us = f.score[row.side], them = f.score[row.opp];
    r.gp++; r.pf += us; r.pa += them;
    const i = us > them ? 'w' : us < them ? 'l' : 't';
    r[i]++;
    if (avctlDiv(row.x.teams[row.opp].name) === div) r['d' + i]++;
  });
  return r;
}
const avPct = r => r.dw + r.dl + r.dt ? (r.dw + r.dt / 2) / (r.dw + r.dl + r.dt) : -1;
const avRec = (w, l, t) => `${w}-${l}${t ? '-' + t : ''}`;

function standingsRows(div){
  return AVCTL_DIV[div].map(name => ({name, r:avRecord(name), rec:shownRecord(name)}))
    .sort((a, b) => avPct(b.r) - avPct(a.r) || (b.r.dw - a.r.dw) || (b.r.w - a.r.w) || a.name.localeCompare(b.name));
}

function standingsHtml(){
  document.title = 'AVCTL Standings · Kansas Media Stats';
  const waiting = !allGames.list;
  const card = div => {
    const rows = standingsRows(div).map((o, i) => {
      const {r} = o, overall = o.rec && o.rec.rec ? o.rec.rec : avRec(r.w, r.l, r.t);
      return `<tr><td class="rk">${i + 1}</td><td class="nm"><div class="cn-in"><a class="tlink" href="?team=${encodeURIComponent(o.name)}">${cMark(o.name)}<b>${esc(o.name)}</b></a></div></td>
        <td class="num on">${avRec(r.dw, r.dl, r.dt)}</td><td class="num">${esc(overall)}</td><td class="num">${r.gp ? r.pf : '—'}</td><td class="num">${r.gp ? r.pa : '—'}</td></tr>`;
    }).join('');
    return `<section class="bcard ccard"><div class="ccard-hd"><h2>Division ${div}</h2></div>
      <div class="tbl-wrap"><table class="ctbl"><thead><tr><th class="rk">RK</th><th class="nm">TEAM</th><th class="num on"><span>DIV</span></th><th class="num"><span>OVERALL</span></th><th class="num"><span>PF</span></th><th class="num"><span>PA</span></th></tr></thead>
      <tbody>${rows}</tbody></table></div></section>`;
  };
  const head = `<section class="bcard bhead"><div class="bhead-top"><h1 class="c-title">AVCTL Standings</h1></div>
    <p class="hint">Division records count the league games kept on this site. Overall is each team’s record as the site has it.</p></section>`;
  if (stand.err) return head + `<section class="bcard"><p class="bempty">${esc(stand.err)}</p></section>`;
  if (waiting) return head + '<section class="bcard"><p class="bempty">Loading the league…</p></section>';
  return head + AV_NAMES.map(card).join('');
}

function renderStandings(){
  if (!ui.stand) return;
  $('#board').innerHTML = standingsHtml();
}
