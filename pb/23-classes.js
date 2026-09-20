/* ================================================================
   Each school's classification and league, from KPreps (its Class and
   League pages, 2026): the Butler County schools and everyone they
   play. The team pages show it under the name, "CLASS 4A | AVCTL-III".
   ================================================================ */
const SCHOOL_INFO = {   // school: [class, league]
  'Abilene': ['4A', 'North Central Kansas League'],
  'Andale': ['3A', 'AVCTL-IV'],
  'Andover': ['5A', 'AVCTL-II'],
  'Andover Central': ['5A', 'AVCTL-II'],
  'Arkansas City': ['4A', 'AVCTL-II'],
  'Augusta': ['4A', 'AVCTL-III'],
  'Belle Plaine': ['1A', 'Central Plains League'],
  'Bluestem': ['1A', 'Tri-Valley League'],
  'Buhler': ['4A', 'AVCTL-III'],
  'Campus': ['6A', 'AVCTL-I'],
  'Central Burden': ['8M-I', 'South Central Border League'],
  'Chanute': ['4A', 'Southeast Kansas League'],
  'Cherryvale': ['2A', 'Tri-Valley League'],
  'Circle': ['4A', 'AVCTL-III'],
  'Clearwater': ['3A', 'AVCTL-IV'],
  'Derby': ['6A', 'AVCTL-I'],
  'Colony-Crest': ['8M-II', 'Three Rivers League'],
  'Conway Springs': ['1A', 'Central Plains League'],
  'Douglass': ['2A', 'Central Plains League'],
  'Eisenhower': ['5A', 'AVCTL-II'],
  'El Dorado': ['4A', 'AVCTL-IV'],
  'Eureka': ['1A', 'Tri-Valley League'],
  'Flinthills': ['8M-II', 'South Central Border League'],
  'Garden Plain': ['2A', 'Central Plains League'],
  'Goddard': ['5A', 'AVCTL-II'],
  'Halstead': ['2A', 'Central Kansas League'],
  'Haven': ['2A', 'Central Kansas League'],
  'Hillsboro': ['1A', 'Central Kansas League'],
  'Humboldt': ['2A', 'Tri-Valley League'],
  'Hutchinson': ['5A', 'AVCTL-I'],
  'Hutchinson Trinity': ['1A', 'Heart of America'],
  'Independence': ['4A', 'Southeast Kansas League'],
  'Inman': ['1A', 'Heart of America'],
  'Lakin': ['2A', 'Hi-Plains League'],
  'Madison': ['8M-II', 'Lyon County League'],
  'Maize': ['6A', 'AVCTL-I'],
  'Maize South': ['5A', 'AVCTL-I'],
  'Marion': ['2A', 'Heart of America'],
  'Marmaton Valley': ['8M-II', 'Three Rivers League'],
  'McPherson': ['4A', 'AVCTL-III'],
  'Medicine Lodge': ['1A', 'Central Plains League'],
  'Mission Valley': ['1A', 'Flint Hills League'],
  'Moundridge': ['1A', 'Heart of America'],
  'Mulvane': ['4A', 'AVCTL-III'],
  'Newton': ['5A', 'AVCTL-II'],
  'Onaga': ['1A', 'Twin Valley League'],
  'Oxford': ['8M-I', 'South Central Border League'],
  'Pratt': ['3A', 'Central Kansas League'],
  'Remington': ['1A', 'Heart of America'],
  'Rose Hill': ['4A', 'AVCTL-IV'],
  'Salina Central': ['5A', 'AVCTL-II'],
  'Salina South': ['5A', 'AVCTL-I'],
  'Sedan': ['8M-II', 'South Central Border League'],
  'Sedgwick': ['1A', 'Heart of America'],
  'St. Paul': ['8M-II', 'Three Rivers League'],
  'Syracuse': ['1A', 'Hi-Plains League'],
  'Udall': ['8M-I', 'South Central Border League'],
  'Uniontown': ['1A', 'Three Rivers League'],
  'Valley Center': ['5A', 'AVCTL-I'],
  'Wellington': ['4A', 'AVCTL-IV'],
  'Wichita Collegiate': ['3A', 'AVCTL-IV'],
  'Winfield': ['4A', 'AVCTL-III'],
};
let schoolIdx = null;
const schoolInfo = name => {
  if (!schoolIdx) schoolIdx = new Map(Object.entries(SCHOOL_INFO).map(([n, v]) => [canonSchool(n), v]));
  return name ? schoolIdx.get(canonSchool(name)) : null;
};
// The schools whose whole schedule is on the site: Butler County's and every team they play. Anyone else shows up
// only in games against them, so their records would be wrong.
const coveredSchool = name => !!schoolInfo(name);
// "CLASS 4A | AVCTL-III", or "8-MAN DIVISION II | SOUTH CENTRAL BORDER LEAGUE"; empty for a school not listed.
function schoolLine(name){
  const v = schoolInfo(name); if (!v) return '';
  const cls = v[0].startsWith('8M-') ? `8-MAN DIVISION ${v[0].slice(3)}` : `CLASS ${v[0]}`;
  return v[1] ? `${cls} | ${v[1].toUpperCase()}` : cls;
}

/* The classes the Media Rankings poll uses, as that site lists them (kansasmediarankings.com). A school not in
   SCHOOL_INFO still needs its class for the rankings and the pregame predictor. */
const RANK_CLASSES = {
  '6A':['Wichita East', 'Derby', 'Wichita Southeast', 'Garden City', 'Wichita North', 'Dodge City', 'Manhattan', 'KC Wyandotte', 'Olathe Northwest', 'Washburn Rural', 'Olathe North', 'Wichita South', 'Wichita Heights', 'Olathe South', 'Gardner-Edgerton', 'Junction City', 'Shawnee Mission East', 'Olathe East', 'Campus', 'Topeka High', 'BV Northwest', 'BV West', 'Shawnee Mission Northwest', 'Lawrence Free State', 'Lawrence', 'Shawnee Mission South', 'Shawnee Mission West', 'Olathe West', 'Maize', 'Wichita Northwest', 'Shawnee Mission North', 'Mill Valley'],
  '5A':['Blue Valley', 'Liberal', 'Blue Valley North', 'Wichita West', 'KC Washington', 'JC Harmon', 'Bishop Carroll', 'Leavenworth', 'Hutchinson', 'Emporia', 'Topeka West', 'Blue Valley Southwest', 'Spring Hill', 'Seaman', 'Maize South', 'KC Turner', 'Hays', 'Shawnee Heights', 'Valley Center', 'Salina South', 'St. James Academy', 'KC Piper', 'Andover', 'De Soto', 'Salina Central', 'Pittsburg', 'Goddard', 'Eisenhower', 'Newton', 'Kapaun Mt. Carmel', 'Basehor-Linwood', 'Andover Central'],
  '4A':['Arkansas City', 'Lansing', 'KC Sumner Academy', 'Great Bend', 'Highland Park', 'St. Thomas Aquinas', 'KC Schlagle', 'Bonner Springs', 'Bishop Miege', 'Ottawa', 'Buhler', 'McPherson', 'Circle', 'Paola', 'Tonganoxie', 'Winfield', 'Eudora', 'Louisburg', 'Mulvane', 'Independence', 'Fort Scott', 'Augusta', 'Field Kindley', 'Rose Hill', 'Chanute', 'Wamego', 'El Dorado', 'Abilene', 'Wellington', 'Labette County', 'Rock Creek', 'Ulysses'],
  '3A':['Baldwin', 'Andale', 'Parsons', 'Atchison', 'Concordia', 'Clearwater', 'Chapman', 'Hayden', 'Perry-Lecompton/Bishop Seabury', 'Pratt', 'Clay Center', 'Santa Fe Trail', 'Hugoton', 'Hesston', 'Holton', 'Frontenac', 'Iola', 'Girard', 'Scott City', 'Osawatomie', 'Colby', 'Jefferson West', 'Anderson County', 'KC Bishop Ward', 'Columbus', 'Holcomb', 'Nemaha Central', 'Prairie View', 'Goodland', 'Wichita Collegiate', 'Hoisington', 'Burlington', 'Hiawatha', 'Larned', 'Wichita Trinity Academy', 'Smoky Valley', 'Wellsville', 'Lyons', 'Nickerson', 'Cheney'],
  '2A':['Marysville', 'Baxter Springs', 'Halstead', 'Council Grove', 'Neodesha', 'Beloit', 'Haven', 'Silver Lake', 'Riley County', 'Royal Valley', 'Caney Valley', 'Galena', 'Sabetha', 'Southeast of Saline', 'Maranatha Academy', 'Russell', 'Chaparral', 'Cherryvale', 'Minneapolis', 'Fredonia', 'Ellsworth', 'Kingman', 'Osage City', 'Riverside', 'Riverton', 'Lakin', 'Pleasant Ridge', 'Norton', 'Garden Plain', 'West Franklin', 'Central Heights', 'Phillipsburg', 'Southwestern Heights', 'Cimarron', 'Oskaloosa', 'Douglass', 'Marion', 'Horton', 'Jayhawk Linn', 'Humboldt'],
  '1A':['Hillsboro', 'Remington', 'Sterling', 'Medicine Lodge', 'Syracuse', 'St. Marys', 'Atchison County', 'Plainville/Natoma', 'Northeast-Arma', 'Bluestem', 'Rossville', 'Thomas More Prep-Marian', 'Eureka', 'Sedgwick', 'Belle Plaine', 'Moundridge', 'McLouth', 'Maur Hill-Mount Academy', 'Ellinwood', 'Mission Valley', 'Jackson Heights', 'Jefferson County North', 'Conway Springs', 'St. Mary\'s Colgan', 'Republic County', 'Doniphan West', 'Smith Center', 'Hutch Trinity', 'Inman', 'Uniontown', 'Sacred Heart', 'Valley Falls', 'Wabaunsee', 'Valley Heights', 'Centralia', 'Olpe', 'Onaga'],
  '8-Man I':['Oswego', 'Oakley', 'Southeast Cherokee', 'Herington', 'Lyndon', 'Ell-Saline', 'South Sumner County', 'Cair Paravel', 'West Elk/Elk Valley', 'Bennington', 'Chase County', 'Solomon', 'Elkhart/Rolla', 'WaKeeney-Trego', 'Washington County', 'Stanton County', 'Yates Center', 'Cedar Vale/Dexter', 'Udall', 'South Central', 'Oxford', 'Hoxie', 'Erie', 'Sublette', 'Canton-Galva', 'Clifton-Clyde', 'Rawlins County', 'Spearville', 'Wichita County', 'Central Plains', 'Northern Heights', 'Hill City', 'Central Burden', 'Lincoln', 'Kiowa County', 'Oberlin-Decatur', 'South Gray', 'Rock Hills', 'Pleasanton', 'St. John-Hudson'],
  '8-Man II':['Goessel', 'Little River', 'Sedan', 'Sylvan-Lucas Unified', 'Flinthills', 'La Crosse', 'Pretty Prairie', 'Kinsley', 'St. Francis', 'Meade', 'Ellis', 'Quinter', 'Norwich', 'Attica/Argonia', 'Rural Vista', 'Lakeside Downs', 'Pratt Skyline', 'Madison/Hamilton', 'Greeley County', 'Troy', 'Frankfort', 'Macksville', 'Osborne', 'St. John\'s/Tipton Catholic', 'Wichita Independent', 'Stockton', 'Burlingame', 'BV Randolph', 'Hodgeman County', 'Marmaton Valley', 'Fairfield', 'Hutch Central Christian', 'Lebo', 'Ness City', 'Colony Crest', 'Cunningham', 'Stafford', 'Minneola', 'Victoria', 'St. Paul', 'Wakefield', 'Linn', 'Pike Valley', 'Hanover', 'Hartford', 'Dighton', 'Waverly', 'Thunder Ridge', 'Wallace County', 'Axtell'],
  '6-Man':['Ingalls', 'South Barber', 'Deerfield', 'Golden Plains', 'Peabody-Burns', 'Satanta', 'Ashland', 'Centre', 'Wheatland-Grinnell', 'Tescott', 'Pawnee Heights', 'Bucklin', 'Altoona-Midway', 'Elyria Christian', 'Cheylin', 'Moscow', 'Southern Coffey County', 'Western Plains', 'Marais des Cygnes Valley', 'Northern Valley', 'Chase', 'Logan', 'Chetopa', 'Palco', 'Otis-Bison', 'Weskan', 'Brewster', 'Winona-Triplains']
};
let rankClassIdx = null;
// 8-man or 11-man from the school itself: 8M-I/8M-II in SCHOOL_INFO, or the poll's 8-Man and 6-Man classes.
// Null when we don't know the school, so the format is left alone.
function menOfSchool(name){
  const info = schoolInfo(name), cls = (info && info[0]) || rankClassOf(name);
  return cls ? (/^(?:8M|8-Man|6-Man)/i.test(cls) ? 8 : 11) : null;
}
function rankClassOf(name){
  if (!rankClassIdx){ rankClassIdx = new Map();
    Object.entries(RANK_CLASSES).forEach(([cls, list]) => list.forEach(n => rankClassIdx.set(canonSchool(n), cls))); }
  return name ? rankClassIdx.get(canonSchool(name)) || null : null;
}
