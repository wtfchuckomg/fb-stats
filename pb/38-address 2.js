/* ================================================================
   The address bar follows the page.

   Every view already has an address that works when you type it —
   /g/<id>/?tab=box opens that game's box score, ?scores=<week> opens
   that week. What was missing is the other direction: clicking a tab
   changed the page and left the address behind, so copying the link
   from the browser sent people back to where you started.

   Now each view writes its own address as you reach it, and going back
   returns to the one before it.
   ================================================================ */

// The address for the view on screen, built from the same state that drew it.
function addressNow(){
  const p = location.pathname, q = new URLSearchParams(location.search);
  const set = (k, v) => { if (v == null || v === '') q.delete(k); else q.set(k, v); };
  // A game, whether it's the scorer's own page or a viewer's: which tab, and how the play-by-play is filtered.
  const onGame = p.startsWith('/g/') || q.has('game') || q.has('edit') || q.has('tracker') || q.has('gamecast');
  if (onGame){
    set('tab', ui.tab && ui.tab !== 'gamecast' ? ui.tab : null);
    set('plays', ui.tab === 'pbp' && ui.pbp && ui.pbp !== (ui.viewer ? 'scoring' : 'all') ? ui.pbp : null);
  }
  // "?tracker=&tab=box" is the same page as "?tracker&tab=box" and reads worse, so drop the empty values.
  const s = q.toString().replace(/=(?=&|$)/g, '');
  return `${p}${s ? '?' + s : ''}`;
}

// Arriving on one of these addresses: show what it asks for, before the first draw.
(function(){
  const q = new URLSearchParams(location.search), tab = q.get('tab'), plays = q.get('plays');
  if (['gamecast', 'box', 'pbp', 'team'].includes(tab)) ui.tab = tab;
  if (['all', 'scoring', 'drives'].includes(plays)) ui.pbp = plays;
})();

// Put it in the address bar. A view you'd want to come back from gets its own step in the history;
// a filter on the view you're already looking at just replaces it.
let addrLast = location.href;
function address(step){
  const url = addressNow();
  if (url === location.pathname + location.search) return;
  history[step ? 'pushState' : 'replaceState'](null, '', url);
  addrLast = location.href;
}

// Back and forward: the page is the same document, so nothing reloads — read the address and draw what it says.
addEventListener('popstate', () => {
  addrLast = location.href;
  const q = new URLSearchParams(location.search);
  const tab = q.get('tab'), plays = q.get('plays');
  let drew = false;
  if (['gamecast', 'box', 'pbp', 'team'].includes(tab || 'gamecast')){
    const want = tab || 'gamecast';
    if (ui.tab !== want){ ui.tab = want; drew = true; }
  }
  if (['all', 'scoring', 'drives'].includes(plays) && ui.pbp !== plays){ ui.pbp = plays; drew = true; }
  // A board address with no week on it means this week, so going back to it has to come back here.
  const wkAt = ['scores', 'avctl', 'state'].find(k => q.has(k));
  if (wkAt && typeof ui.week !== 'undefined'){
    const want = q.get(wkAt) || (typeof boardDefaultWeek === 'function' ? boardDefaultWeek() : weekKey(Date.now()));
    if (ui.week !== want){
      ui.week = want;
      if (typeof renderScores === 'function') renderScores();
      if (typeof renderScoreboard === 'function' && ui.board) return void renderScoreboard();
    }
  }
  const view = q.get('stats') || q.get('avstats') || q.get('statestats') || q.get('lgstats');
  if (view && typeof county !== 'undefined' && county.view !== view){
    county.view = view;
    if (typeof renderCounty === 'function') return void renderCounty();
  }
  if (drew && typeof renderView === 'function') renderView();
});
