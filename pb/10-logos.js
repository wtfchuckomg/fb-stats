/* ================================================================
   School logos, borrowed from the Pick 'ems library on the same
   domain (picks.kansasmediarankings.com/logos/teams.json). A school
   with no logo there gets a monogram in its own team color.
   ================================================================ */
// This site's own logos folder first (stats.kansasmediarankings.com/logos), then the Pick 'ems library for the rest.
const LOGO_SRC = [{base:DATA ? `${DATA}/logos/` : 'logos/', list:[]}, {base:'https://picks.kansasmediarankings.com/logos/', list:[]}];
const logoLib = {list:null, busy:false};   // list: every school from both, for the school-name suggestions
const logoSlug = s => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function loadLogos(){
  if (logoLib.list || logoLib.busy || typeof fetch !== 'function') return;
  logoLib.busy = true;
  // Check for a newer list every time (a changed school name or logo shows right away, not after the browser's cache).
  Promise.all(LOGO_SRC.map(src => fetch(src.base + 'teams.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : []).catch(() => [])
    .then(list => { src.list = Array.isArray(list) ? list : []; })))
    .then(() => {
      logoLib.list = LOGO_SRC.flatMap(src => src.list);
      // Two names for one school only merge once the library is here, so anything already filed under the
      // other name has to be filed again — or a school's page finds none of its own games.
      schoolIdx = null;          // keyed by canonical name as well, so it is built again
      if (allGames.list) indexGames();
      if (g && R) refresh(); else { renderScoreboard(); renderCounty(); renderTeamPage(); renderStandings(); renderAvHome(); }
    });
}
/* ---------- the school list, for picking a school instead of typing one ----------
   Every school the logo library knows, so a game can't be started against a school that doesn't exist (a typo
   leaves a game with no logo, no roster and its own row in the stats). The list is fetched at runtime, so when
   it hasn't arrived — a cold load on a bad connection — fall back to the schools saved on this device plus
   whatever the game already says, rather than showing an empty list nobody can get past. */
// What this site calls a school, whatever a paste or a paper called it: "Haysville Campus" is Campus.
const schoolName = n => {
  const k = canonSchool(n), t = (logoLib.list || []).find(v => logoSlug(v.name) === k);
  return t ? t.name : n;
};
function schoolList(...keep){
  // This site's own list (logos/teams.json) as the admin keeps it — not the Pick 'Em library, which carries
  // schools that don't belong in these pickers — plus the schools this scorer added or saved as teams.
  const own = typeof schoolsAll === 'function' ? schoolsAll() : (LOGO_SRC[0].list || []).map(t => t.name).filter(Boolean);
  const extra = [...(typeof mySchoolNames === 'function' ? mySchoolNames() : []), ...(typeof savedTeams === 'function' ? savedTeams() : []).map(t => t.name)];
  const byKey = new Map();
  [...own, ...extra, ...keep.filter(Boolean)].forEach(n => { const k = canonSchool(n); if (k && !byKey.has(k)) byKey.set(k, n); });   // one row per school
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
// A school's short name: the admin's own (Schools window), then logos/teams.json ("ArkC" for Arkansas City).
function listAbbr(name){
  const own = typeof schoolAbbr === 'function' ? schoolAbbr(name) : '';
  if (own) return own;
  const k = logoSlug(name);
  const hit = (logoLib.list || []).find(t => t.abbr && (logoSlug(t.name) === k || t.slug === k || (t.aliases || []).some(a => logoSlug(a) === k)));
  return hit ? hit.abbr : '';
}
// A school picker: type to find a school on the list, or add one that isn't (pb/28-schools.js does the rest).
function schoolPicker(id, value, label){
  return `<div class="sch-pick"><input class="inp sch-in" id="${esc(id)}" value="${esc(value || '')}" placeholder="${esc(label)}" aria-label="${esc(label)}"
    role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${esc(id)}-sug" autocomplete="off" autocapitalize="words" spellcheck="false">
    <div class="sch-sug" id="${esc(id)}-sug" role="listbox" hidden></div></div>`;
}

// Every place a school's logo might be, best first: the logo map (checked ahead of time across the three sites),
// then the logo lists, then, for a school neither knows, its own name in this site's logos folder. An address
// that failed to load once is skipped from then on.
const LOGO_MISS = new Set();
const STATS_LOGOS = 'https://stats.kansasmediarankings.com/logos/';
function logoUrls(team){
  if (!team) return [];
  const keys = [logoSlug(team.name), logoSlug(team.abbr)].filter(Boolean), out = [];
  keys.forEach(k => { if (LOGO_MAP[k]) out.push(LOGO_MAP[k]); });
  if (logoLib.list){
    const want = new Set(keys);
    LOGO_SRC.forEach(src => {
      const hit = src.list.find(t => t.file && (want.has(t.slug) || want.has(logoSlug(t.name)) || (t.aliases || []).some(a => want.has(logoSlug(a)))));
      if (hit) out.push(src.base + encodeURIComponent(hit.file));   // some file names have spaces
    });
  }
  if (!out.length && team.name) out.push(STATS_LOGOS + encodeURIComponent(String(team.name).trim()) + '.png', STATS_LOGOS + logoSlug(team.name) + '.png');
  return [...new Set(out)].filter(u => !LOGO_MISS.has(u));
}
// A logo that won't load gives way to the next place it might be, then to the monogram: never a broken image.
function logoMiss(img){
  LOGO_MISS.add(img.getAttribute('src'));
  const rest = (img.dataset.alts || '').split('|').filter(u => u && !LOGO_MISS.has(u));
  if (rest.length){ img.dataset.alts = rest.slice(1).join('|'); img.src = rest[0]; }
  else { img.nextElementSibling.hidden = false; img.remove(); }
}
const logoUrl = team => logoUrls(team)[0] || '';
function teamMark(s, size){ return markFor(g.teams[s], size); }
// Any team's mark, for places that show other games (the scoreboard).
function markFor(t, size){
  const [url, ...alts] = logoUrls(t);
  const txt = String(t.abbr || t.name || '?').slice(0, size >= 40 ? 4 : 3);
  const fs = Math.max(8, Math.round(size * (txt.length > 3 ? .28 : .36)));
  const mono = hide => `<span class="tmono" aria-hidden="true"${hide ? ' hidden' : ''} style="--tc:${esc(t.color)};width:${size}px;height:${size}px;font-size:${fs}px">${esc(txt)}</span>`;
  if (!url) return mono(false);
  return `<img class="tlogo" src="${esc(url)}" data-alts="${esc(alts.join('|'))}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px"`
    + ` onerror="logoMiss(this)">${mono(true)}`;
}
