/* ================================================================
   Leagues — every 11-man league with a 4A, 5A or 6A school in it,
   under State › Leagues. Each has three pages: its standings (the
   main one), player stats and team stats, the same pages the AVCTL
   has. A few 2A and 3A schools come along with their leagues.
   The alignment is KPreps' (its league pages, 2026); the names are
   this site's, so logos and records match. .github/kp/leagues.py
   prints this table again if a league realigns. The AVCTL keeps its
   own four divisions in 12b-avctl.js and is listed here first.

     ?league=<slug>                 standings
     ?league=<slug>&lgstats         player stats (lgstats=rushing …)
     ?league=<slug>&lgstats=team    team stats
   ================================================================ */
const LEAGUES = [
  {slug:'centennial-league', name:"Centennial League", teams:["Emporia", "Hayden", "Junction City", "Manhattan", "Topeka High", "Washburn Rural"]},
  {slug:'eastern-kansas-league', name:"Eastern Kansas League", teams:["Bishop Miege", "Blue Valley", "Blue Valley North", "Blue Valley Northwest", "Blue Valley Southwest", "Blue Valley West", "St James", "St Thomas Aquinas"]},
  {slug:'frontier-league', name:"Frontier League", teams:["Baldwin", "Bonner Springs", "Eudora", "Louisburg", "Ottawa", "Paola", "Tonganoxie"]},
  {slug:'great-west-activities-conference', name:"Great West Activities Conference", teams:["Cimarron", "Colby", "Goodland", "Holcomb", "Hugoton", "Scott City", "Ulysses"]},
  {slug:'greater-wichita-athletic-league', name:"Greater Wichita Athletic League", teams:["Bishop Carroll", "Kapaun Mt Carmel", "North", "Southeast (Wichita)", "Wichita East", "Wichita Heights", "Wichita Northwest", "Wichita South", "Wichita West"]},
  {slug:'meadowlark-conference', name:"Meadowlark Conference", teams:["Atchison", "Harmon", "Highland Park", "KC Sumner", "Schlagle", "Washington", "Wyandotte"]},
  {slug:'north-central-kansas-league', name:"North Central Kansas League", teams:["Abilene", "Chapman", "Clay Center", "Concordia", "Marysville", "Rock Creek", "Wamego"]},
  {slug:'southeast-kansas-league', name:"Southeast Kansas League", teams:["Chanute", "Field Kindley", "Fort Scott", "Independence", "Labette County"]},
  {slug:'sunflower-league', name:"Sunflower League", teams:["Gardner-Edgerton", "Lawrence", "Lawrence Free State", "Mill Valley", "Olathe East", "Olathe North", "Olathe Northwest", "Olathe South", "Olathe West", "Shawnee Mission East", "Shawnee Mission North", "Shawnee Mission Northwest", "Shawnee Mission South", "Shawnee Mission West"]},
  {slug:'united-kansas-conference', name:"United Kansas Conference", teams:["Basehor-Linwood", "De Soto", "Lansing", "Leavenworth", "Piper", "Seaman", "Shawnee Heights", "Spring Hill", "Topeka West", "Turner"]},
  {slug:'western-athletic-conference', name:"Western Athletic Conference", teams:["Dodge City", "Garden City", "Great Bend", "Hays", "Liberal"]},
];
// The Leagues menu, AVCTL first: its pages are its own addresses.
const LEAGUE_MENU = [{name:'AVCTL', href:'?standings'}, ...LEAGUES.map(l => ({name:l.name, href:`?league=${l.slug}`}))];

const LG_Q = new URLSearchParams(location.search);
const LG = LEAGUES.find(l => l.slug === LG_Q.get('league')) || null;   // the league whose page this is
const LG_STATS = !!LG && LG_Q.has('lgstats');                          // its player or team stats
const LG_STAND = !!LG && !LG_STATS;                                    // its standings

// A school in this league, under the league's spelling of it, however a game writes it ("Wichita North" is North).
const lgOf = name => LG && name ? LG.teams.find(t => canonSchool(t) === canonSchool(name)) || null : null;
// A game belongs to the league if either team does.
const inLeague = x => !!x && !!x.teams && (!!lgOf(x.teams.A.name) || !!lgOf(x.teams.H.name));

// The three pages of a league, as tabs over each of them: Standings, Player Stats, Team Stats.
function leagueNav(on){
  const av = !LG, base = av ? '' : `league=${LG.slug}`;
  const tabs = av
    ? [['standings', 'Standings', '?standings'], ['players', 'Player Stats', '?avstats'], ['team', 'Team Stats', '?avstats=team']]
    : [['standings', 'Standings', `?${base}`], ['players', 'Player Stats', `?${base}&lgstats`], ['team', 'Team Stats', `?${base}&lgstats=team`]];
  return `<section class="bcard lg-head"><div class="bhead-top"><h1 class="c-title">${esc(av ? 'AVCTL' : LG.name)}</h1></div>
    <nav class="c-tabs lg-tabs" aria-label="League pages">${tabs.map(([k, label, href]) =>
      `<a href="${href}"${k === on ? ' class="on" aria-current="page"' : ''}>${label}</a>`).join('')}</nav></section>`;
}

/* ---------- a league's standings: one table, its league games apart from the rest ---------- */
function lgStandingsHtml(){
  document.title = `${LG.name} Standings · ${SITE_TITLE}`;
  const head = leagueNav('standings');
  if (stand.err) return head + `<section class="bcard"><p class="bempty">${esc(stand.err)}</p></section>`;
  if (!allGames.list) return head + '<section class="bcard"><p class="bempty">Loading the league…</p></section>';
  const rows = LG.teams.map(name => ({name, r:avRecord(name, o => !!lgOf(o)), rec:shownRecord(name)})).sort(standOrder);
  return head + standingsCard('Standings', rows)
    + `<section class="bcard"><p class="hint">League records count each team’s games against the rest of the league, as they’re kept here. Overall is each team’s record as the site has it.</p></section>`;
}
