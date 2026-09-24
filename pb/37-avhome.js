/* ================================================================
   AVCTLstats.com's front page: this season's leaders and the four
   divisions at a glance (the header card above every page has the
   league's name and the way to each page), each a door into its
   full page. Built on the pages it summarizes — the stats page's
   season numbers and the standings' records — so the three always
   agree. stats/KMR never opens it (its home is the tracker's guide).
   ================================================================ */
const avHome = {err:''};
// The leader boards, and the full table each one opens.
const AV_LEADS = [
  ['Passing Yards', 'passing', p => p.pa > 0, p => p.py],
  ['Rushing Yards', 'rushing', p => p.ru > 0, p => p.ry],
  ['Receiving Yards', 'receiving', p => p.re > 0, p => p.rey],
  ['Points', 'scoring', p => ptsOf(p) > 0, ptsOf]];

async function startAvHome(){
  ui.viewer = true; ui.avhome = true; document.body.classList.add('viewer', 'bpage');
  $('#board').hidden = false;
  document.title = SITE_NAME;
  loadLogos(); loadFiles(); renderAvHome();
  try {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-`;
    const [appM, fsM] = await Promise.all([import(base + 'app.js'), import(base + 'firestore.js')]);
    const fsdb = fsM.getFirestore(appM.initializeApp(firebaseConfig));
    scoresReady({fsM, fsdb});   // the week's scores strip, and every game for the standings
    loadStats({fsM, fsdb});     // the season's numbers, for the leaders
  } catch (e) { avHome.err = 'Can’t reach the games. Check your connection and reload.'; renderAvHome(); }
}

function renderAvHome(){
  if (!ui.avhome) return;
  const note = t => `<p class="bempty">${esc(t)}</p>`;

  // Leaders: the top five in each, from the same numbers as the stats pages.
  let leaders;
  if (avHome.err && !county.games) leaders = note(avHome.err);
  else if (!county.games) leaders = note('Loading the leaders…');
  else {
    const {players} = countyStats(countyGames());
    leaders = `<div class="avh-grid">${AV_LEADS.map(([title, view, keep, val]) => {
      const top = players.filter(keep).sort((a, b) => val(b) - val(a) || a.name.localeCompare(b.name)).slice(0, 5);
      const rows = top.map((p, i) => `<li><span class="avh-rk">${i + 1}</span>${cMark(p.team)}
          <a class="avh-pl" href="${playerHref(p.name, p.team)}"><b>${esc(p.name)}</b><small>${esc(p.team)}</small></a><span class="avh-v">${val(p)}</span></li>`).join('');
      return `<section class="bcard avh-card"><div class="avh-hd"><h2>${title}</h2><a href="?avstats=${view}">All »</a></div>
        ${rows ? `<ol class="avh-list">${rows}</ol>` : note('No stats yet.')}</section>`;
    }).join('')}</div>`;
  }

  // The four divisions: league record first, then overall, the way the standings read.
  let divs;
  if (avHome.err && !allGames.list) divs = note(avHome.err);
  else if (!allGames.list) divs = note('Loading the standings…');
  else divs = `<div class="avh-grid">${AV_NAMES.map(d => `<section class="bcard avh-card"><div class="avh-hd"><h2>Division ${d}</h2><a href="?standings">Standings »</a></div>
      <table class="avh-st"><thead><tr><th></th><th>League</th><th>Overall</th></tr></thead><tbody>${standingsRows(d).map(o => {
        const rec = o.rec || {}, r = o.r;
        return `<tr><td>${cMark(o.name)}<a class="tlink" href="?team=${encodeURIComponent(o.name)}">${esc(o.name)}</a></td>
          <td>${avRec(r.dw, r.dl, r.dt)}</td><td>${esc(rec.rec || avRec(r.w, r.l, r.t))}</td></tr>`; }).join('')}</tbody></table></section>`).join('')}</div>`;

  $('#board').innerHTML = `<h2 class="avh-sec">Leaders</h2>` + leaders + `<h2 class="avh-sec">Standings</h2>` + divs;
}

// The header card on every AVCTL page: this season, and the page you're on filled in.
if (SITE_AV) (function(){
  const q = new URLSearchParams(location.search), yr = $('#av-season');
  if (yr) yr.textContent = `${new Date().getFullYear()} season`;
  const here = q.has('avctl') ? 'avctl' : q.has('standings') ? 'standings' : q.has('avstats') ? (q.get('avstats') === 'team' ? 'avteam' : 'avstats')
    : q.has('teams') || q.has('team') ? 'teams' : '';
  document.querySelectorAll('.av-btns [data-av]').forEach(a => { const on = a.dataset.av === here; a.classList.toggle('primary', on); if (on) a.setAttribute('aria-current', 'page'); });
})();
