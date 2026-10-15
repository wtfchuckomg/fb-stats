/* ================================================================
   Leagues — every league with a 2A-6A school in it (3A and 2A added
   2026-10-12), and the leagues of the four Butler County schools that aren't in the AVCTL
   (Bluestem, Douglass, Remington, and Flinthills, whose league is
   8-man), under State › Leagues. Each has three pages: its standings
   (the main one), player stats and team stats, the same pages the
   AVCTL has. Smaller schools come along with their leagues.
   The alignment is KPreps' (its league pages, 2026); the names are
   this site's, so logos and records match. .github/kp/leagues.py
   prints this table again if a league realigns. The AVCTL keeps its
   own four divisions in 12b-avctl.js and is listed here first.

     ?league=<slug>                 standings
     ?league=<slug>&lgstats         player stats (lgstats=rushing …)
     ?league=<slug>&lgstats=team    team stats
   ================================================================ */
const LEAGUES = [
  {slug:'big-east-league', name:"Big East League", teams:["Hiawatha", "Holton", "Jefferson West", "Nemaha Central", "Perry-Lecompton", "Riley County", "Rossville", "Royal Valley", "Sabetha", "Silver Lake", "St Marys"]},
  {slug:'cnc-league', name:"CNC League", teams:["Baxter Springs", "Columbus", "Frontenac", "Galena", "Girard", "Riverton", "St Mary's Colgan"]},
  {slug:'centennial-league', name:"Centennial League", teams:["Emporia", "Hayden", "Junction City", "Manhattan", "Topeka High", "Washburn Rural"]},
  {slug:'central-kansas-league', name:"Central Kansas League", teams:["Halstead", "Haven", "Hesston", "Hillsboro", "Hoisington", "Larned", "Nickerson", "Pratt", "Smoky Valley"]},
  {slug:'central-plains-league', name:"Central Plains League", teams:["Belle Plaine", "Chaparral", "Cheney", "Conway Springs", "Douglass", "Garden Plain", "Kingman", "Medicine Lodge", "Wichita Trinity"]},
  {slug:'eastern-kansas-league', name:"Eastern Kansas League", teams:["Bishop Miege", "Blue Valley", "Blue Valley North", "Blue Valley Northwest", "Blue Valley Southwest", "Blue Valley West", "St James", "St Thomas Aquinas"]},
  {slug:'flint-hills-league', name:"Flint Hills League", teams:["Council Grove", "Mission Valley", "Osage City", "Wabaunsee", "West Franklin"]},
  {slug:'frontier-league', name:"Frontier League", teams:["Baldwin", "Bonner Springs", "Eudora", "Louisburg", "Ottawa", "Paola", "Tonganoxie"]},
  {slug:'great-west-activities-conference', name:"Great West Activities Conference", teams:["Cimarron", "Colby", "Goodland", "Holcomb", "Hugoton", "Scott City", "Ulysses"]},
  {slug:'greater-wichita-athletic-league', name:"Greater Wichita Athletic League", teams:["Bishop Carroll", "Kapaun Mt Carmel", "Wichita East", "Wichita Heights", "Wichita North", "Wichita Northwest", "Wichita South", "Wichita Southeast", "Wichita West"]},
  {slug:'heart-of-america', name:"Heart of America", teams:["Hutch Trinity", "Inman", "Marion", "Moundridge", "Remington", "Sedgwick", "Sterling"]},
  {slug:'hi-plains-league', name:"Hi-Plains League", teams:["Lakin", "Southwestern Heights", "Syracuse"]},
  {slug:'kaw-valley-conference', name:"Kaw Valley Conference", teams:["Bishop Ward", "Maranatha"]},
  {slug:'meadowlark-conference', name:"Meadowlark Conference", teams:["Atchison", "Harmon", "Highland Park", "KC Sumner", "Schlagle", "Washington", "Wyandotte"]},
  {slug:'mid-continent-league', name:"Mid-Continent League", teams:["Norton", "Phillipsburg", "Plainville", "Russell", "Smith Center", "Thomas More Prep"]},
  {slug:'north-central-activities-association', name:"North Central Activities Association", teams:["Beloit", "Ellsworth", "Lyons", "Minneapolis", "Republic County", "Sacred Heart", "Southeast of Saline"]},
  {slug:'north-central-kansas-league', name:"North Central Kansas League", teams:["Abilene", "Chapman", "Clay Center", "Concordia", "Marysville", "Rock Creek", "Wamego"]},
  {slug:'northeast-kansas-league', name:"Northeast Kansas League", teams:["Atchison County", "Horton", "Jackson Heights", "Jefferson County North", "Maur Hill-Mount", "McLouth", "Oskaloosa", "Pleasant Ridge", "Riverside", "Valley Falls"]},
  {slug:'pioneer-league', name:"Pioneer League", teams:["Anderson County", "Burlington", "Iola", "Osawatomie", "Prairie View", "Santa Fe Trail", "Wellsville"]},
  {slug:'south-central-border-league', name:"South Central Border League", teams:["Cedar Vale-Dexter", "Central Burden", "Flinthills", "Oxford", "Sedan", "South Sumner", "Udall", "West Elk"]},
  {slug:'southeast-kansas-league', name:"Southeast Kansas League", teams:["Chanute", "Field Kindley", "Fort Scott", "Independence", "Labette County"]},
  {slug:'sunflower-league', name:"Sunflower League", teams:["Gardner-Edgerton", "Lawrence", "Lawrence Free State", "Mill Valley", "Olathe East", "Olathe North", "Olathe Northwest", "Olathe South", "Olathe West", "Shawnee Mission East", "Shawnee Mission North", "Shawnee Mission Northwest", "Shawnee Mission South", "Shawnee Mission West"]},
  {slug:'three-rivers-league', name:"Three Rivers League", teams:["Central Heights", "Jayhawk-Linn", "Northeast-Arma", "Uniontown"]},
  {slug:'tri-valley-league', name:"Tri-Valley League", teams:["Bluestem", "Caney Valley", "Cherryvale", "Eureka", "Fredonia", "Humboldt", "Neodesha"]},
  {slug:'twin-valley-league', name:"Twin Valley League", teams:["Centralia", "Doniphan West", "Onaga", "Valley Heights"]},
  {slug:'twin-valley-league-8-man', name:"Twin Valley League (8-Man)", teams:["Axtell", "BV Randolph", "Clifton-Clyde", "Frankfort", "Hanover", "Linn", "Washington County"]},
  {slug:'united-kansas-conference', name:"United Kansas Conference", teams:["Basehor-Linwood", "De Soto", "Lansing", "Leavenworth", "Piper", "Seaman", "Shawnee Heights", "Spring Hill", "Topeka West", "Turner"]},
  {slug:'western-athletic-conference', name:"Western Athletic Conference", teams:["Dodge City", "Garden City", "Great Bend", "Hays", "Liberal"]},
];
// The Leagues menu, AVCTL first: its pages are on its own site, AVCTLstats.com.
const LEAGUE_MENU = [{name:'AVCTL', href:`${AV_SITE}?standings`}, ...LEAGUES.map(l => ({name:l.name, href:`?league=${l.slug}`}))];

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
  if (SITE_AV) return '';   // the AVCTL site's header card has these pages as its buttons
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
  const rows = standSort(LG.teams.map(name => ({name, r:avRecord(name, o => !!lgOf(o)), rec:shownRecord(name)})));
  return head + standingsCard('Standings', rows);
}
