/* ================================================================
   Which site this build is. The same parts build two sites:
   stats.kansasmediarankings.com (kmr) and AVCTLstats.com (avctl), the
   AVCTL's own fans-only site. build.py writes the site's name in for
   __SITE__. The AVCTL site keeps no games of its own: it reads the
   same database and the same nightly files as stats/KMR, so anything
   entered there shows up here too.
   ================================================================ */
const SITE = '__SITE__';
const SITE_AV = SITE === 'avctl';
const SITE_NAME = SITE_AV ? 'Ark Valley Chisholm Trail League statistics and leaders' : 'Kansas Media Stats';
const SITE_TITLE = SITE_AV ? 'AVCTL Stats' : 'Kansas Media Stats';   // after the page's own name in a tab's title
// Where the nightly files (season.json, stats.json, schedules, logos, game snapshots) live: stats/KMR builds
// them, so the AVCTL site reads them from there.
const DATA = SITE_AV ? 'https://stats.kansasmediarankings.com' : '';

// The AVCTL site has the league's pages only: any other page's address becomes its league twin before a part reads
// the address, and the Game Tracker's becomes the home page (the site is for fans).
if (SITE_AV) (function(){
  const q = new URLSearchParams(location.search), keep = ['game', 'live', 'preview', 'team', 'teams', 'player', 'avctl', 'avstats', 'standings', 'season', 'tab'];
  const to = new URLSearchParams();
  const val = k => q.get(k) || '';
  if (q.has('scores') || q.has('state')) to.set('avctl', val('scores') || val('state'));
  else if (q.has('stats') || q.has('statestats')) to.set('avstats', val('stats') || val('statestats'));
  else if (q.has('league') || q.has('bracket')) to.set('standings', '');
  q.forEach((v, k) => { if (keep.includes(k) && !to.has(k)) to.set(k, v); });
  const s = to.toString().replace(/=(?=&|$)/g, '');
  if (s !== location.search.slice(1)) history.replaceState(null, '', `${location.pathname}${s ? '?' + s : ''}${location.hash}`);
})();
