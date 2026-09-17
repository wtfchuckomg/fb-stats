/* ---------- sample game: made-up teams and plays, typed in shorthand ---------- */
function sampleGame(){
  const A = {name:'North Eagles', mascot:'Eagles', abbr:'NOR', color:'#1F4E9C', roster:{7:'Cole Brandt', 22:'Mason Ortiz', 11:'Tyler Reyes', 84:'Jace Miller', 15:'Luke Dean', 54:'Gavin Hart', 24:'Eli Novak', 90:'Owen Pratt', 72:'Sam Keller'}};
  const H = {name:'South Rams', mascot:'Rams', abbr:'SOU', color:'#8A1C2B', roster:{3:'Brody Kemp', 28:'Isaiah Ford', 1:'Kade Sims', 80:'Nolan Beck', 19:'Ryan Kast', 44:'Drew Lang', 5:'Cam Ward', 97:'Trey Hale'}};
  const s = {id:'sample', sample:2, created:Date.now(), teams:{A, H}, set:{qtr:12, ot:10, firstKick:'H'}, plays:[], clk:{s:156, run:false, at:0}};
  const lines = [
    [720, 'N ball at N32 1-10'], [712, '22-5 @44'], [688, '7-11-14 @5'], [655, '22--2 @97'], [630, '7-inc-84 @5'],
    [624, '7-84-16 @44'], [590, '22-9 @44 @5'], [561, '7-3'], [535, '7-11-23-td'], [535, '15-xp'],
    [535, 'S ball at S20'], [520, '28-4 @54'], [489, '3-sack-7-90'], [470, 'to S'], [470, '3-1-9 @24'],
    [441, 'S punt'], [441, 'N ball at N39'], [418, '22-12 @5 pen N 10 hold 72 np'], [396, '7-int-5-12'],
    [396, 'S ball at N35'], [370, '28-7 @54'], [352, 'pen S 5 fs'], [350, '3-80-12 @24'], [318, '28-21-td'],
    [318, '3-1-no'], [318, 'N ball at N28'], [300, '22-6 @97'], [276, '7-11-31 @5'], [250, '22--1 @44'],
    [226, '7-inc'], [220, '7-84-8 @44'], [185, '15-fg'], [185, 'S ball at S26'], [171, '28-3 @90 @54']];
  const keep = g; g = s;
  try {
    for (const [clk, line] of lines){
      const r = parseQuick(line, replay(s).st);
      if (r && r.play) s.plays.push(JSON.parse(JSON.stringify({...r.play, clk})));
    }
  } finally { g = keep; }
  return s;
}

/* ---------- boot ---------- */
if (PREVIEW_ID) startPreview(PREVIEW_ID);   // ?preview=<id>: a game before kickoff
else if (HOME_PAGE) startHome();             // ?home: the front page, read-only
else if (AV_STAND) startStandings();    // ?standings: the AVCTL's four divisions
else if (BOARD) startScoreboard();      // ?scores: the week's scoreboard, read-only
else if (COUNTY_PAGE) startCounty();    // ?stats: the county's season stats, read-only
else if (TEAM_PAGE) startTeamPage();    // ?teams, ?team=<name>: the schools, and each one's record and schedule
// ?edit=<id> is the scorer coming back to their own game, and wins over ?game= — the preview page forwards both.
else if (SCHOOL_CAST) startSchoolCast(SCHOOL_CAST);   // ?gamecast=<school>: that school's current game, for embedding
else if (LIVE_ID && !new URLSearchParams(location.search).has('edit')) startViewer(LIVE_ID); // a shared link: watch that game, read-only
else {
  load();
  if (db.games.sample && db.games.sample.sample !== 2) db.games.sample = sampleGame();
  seedTeamLibrary();
  seedSchedule();         // the 2026 Butler County schedule, loaded once as scheduled games
  seedOppSchedule();      // and the schedules of the teams they play
  // ?edit=<id>, from the Edit button on a game's own page: open that game here, then tidy the address.
  const EDIT_ID = new URLSearchParams(location.search).get('edit');
  g = (EDIT_ID && db.games[EDIT_ID]) || db.games[db.cur] || Object.values(db.games)[0];
  if (EDIT_ID) history.replaceState(null, '', `${location.pathname}?tracker`);
  if (!g) g = sampleGame();
  // No game under way (the last one is over, or there's only the sample or a box score): the start screen.
  ui.start = !EDIT_ID && idleGame(g);
  setCurrent();
  refresh();
  // ?tracker&open=games (or setup, export, share): from the scorer's buttons on the other pages.
  const OPEN = new URLSearchParams(location.search).get('open');
  if (['games', 'setup', 'export', 'share', 'others'].includes(OPEN)){ history.replaceState(null, '', `${location.pathname}?tracker`); openDialog(OPEN); }
  // ?tracker&box=<game>: Paste box score, from a school's schedule or the scoreboard.
  const BOX_FROM = new URLSearchParams(location.search).get('box');
  if (BOX_FROM != null){ ui.boxFrom = BOX_FROM || null; ui.boxGame = null; history.replaceState(null, '', `${location.pathname}?tracker`); openDialog('box'); }
  startSync();
}

startEmbed();   // ?embed=1: whatever page this is, it is inside someone else's
