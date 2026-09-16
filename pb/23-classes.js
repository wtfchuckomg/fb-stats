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
  'Central Burden': ['8M-I', 'South Central Border League'],
  'Chanute': ['4A', 'Southeast Kansas League'],
  'Cherryvale': ['2A', 'Tri-Valley League'],
  'Circle': ['4A', 'AVCTL-III'],
  'Clearwater': ['3A', 'AVCTL-IV'],
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

