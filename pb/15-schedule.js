/* ================================================================
   The 2026 Butler County schedule (from "2026 FOOTBALL SCHEDULES.xlsx"),
   loaded once on the scorer's devices as scheduled games: quick scores
   at Pregame, dated that week's Friday, on everyone's scoreboard. Each
   has a fixed id and an old timestamp, so loading on a second device
   makes no duplicates, and any later edit or deletion wins.
   A game between two Butler County schools is listed once.
   ================================================================ */
const SCHEDULE_2026 = [   // [week, away, home]
  [1, 'Andover', 'Hutchinson'],
  [1, 'Andover Central', 'Maize'],
  [1, 'Augusta', 'McPherson'],
  [1, 'Humboldt', 'Bluestem'],
  [1, 'Circle', 'Pratt'],
  [1, 'Douglass', 'Conway Springs'],
  [1, 'Wichita Collegiate', 'El Dorado'],
  [1, 'Udall', 'Flinthills'],
  [1, 'Remington', 'Marion'],
  [1, 'Rose Hill', 'Andale'],
  [2, 'Andover', 'Andover Central'],
  [2, 'Independence', 'Augusta'],
  [2, 'Uniontown', 'Bluestem'],
  [2, 'Winfield', 'Circle'],
  [2, 'Medicine Lodge', 'Douglass'],
  [2, 'El Dorado', 'Andale'],
  [2, 'Oxford', 'Flinthills'],
  [2, 'Onaga', 'Remington'],
  [2, 'Clearwater', 'Rose Hill'],
  [3, 'Valley Center', 'Andover'],
  [3, 'Newton', 'Andover Central'],
  [3, 'Circle', 'Augusta'],
  [3, 'Bluestem', 'Cherryvale'],
  [3, 'Douglass', 'Belle Plaine'],
  [3, 'Clearwater', 'El Dorado'],
  [3, 'Flinthills', 'Central Burden'],
  [3, 'Remington', 'Sedgwick'],
  [3, 'Wichita Collegiate', 'Rose Hill'],
  [4, 'Arkansas City', 'Andover'],
  [4, 'Andover Central', 'Maize South'],
  [4, 'Augusta', 'Winfield'],
  [4, 'Bluestem', 'Eureka'],
  [4, 'Circle', 'McPherson'],
  [4, 'Douglass', 'Haven'],
  [4, 'El Dorado', 'Wellington'],
  [4, 'Flinthills', 'Sedan'],
  [4, 'Remington', 'Hillsboro'],
  [4, 'Rose Hill', 'Chanute'],
  [5, 'Eisenhower', 'Andover'],
  [5, 'Goddard', 'Andover Central'],
  [5, 'Rose Hill', 'Augusta'],
  [5, 'Syracuse', 'Bluestem'],
  [5, 'Buhler', 'Circle'],
  [5, 'Garden Plain', 'Douglass'],
  [5, 'McPherson', 'El Dorado'],
  [5, 'Marmaton Valley', 'Flinthills'],
  [5, 'Remington', 'Mission Valley'],
  [6, 'Andover', 'Goddard'],
  [6, 'Andover Central', 'Arkansas City'],
  [6, 'Augusta', 'Abilene'],
  [6, 'Sedgwick', 'Bluestem'],
  [6, 'Circle', 'El Dorado'],
  [6, 'Douglass', 'Halstead'],
  [6, 'Flinthills', 'St. Paul'],
  [6, 'Inman', 'Remington'],
  [6, 'Winfield', 'Rose Hill'],
  [7, 'Andover', 'Newton'],
  [7, 'Andover Central', 'Salina Central'],
  [7, 'Mulvane', 'Augusta'],
  [7, 'Bluestem', 'Belle Plaine'],
  [7, 'Abilene', 'Circle'],
  [7, 'Lakin', 'Douglass'],
  [7, 'El Dorado', 'Rose Hill'],
  [7, 'Flinthills', 'Colony-Crest'],
  [7, 'Remington', 'Moundridge'],
  [8, 'Salina Central', 'Andover'],
  [8, 'Eisenhower', 'Andover Central'],
  [8, 'Augusta', 'Buhler'],
  [8, 'Bluestem', 'Conway Springs'],
  [8, 'Mulvane', 'Circle'],
  [8, 'Marion', 'Douglass'],
  [8, 'El Dorado', 'Independence'],
  [8, 'Madison', 'Flinthills'],
  [8, 'Hutchinson Trinity', 'Remington'],
  [8, 'Rose Hill', 'Wellington']
];
const SCHED_STAMP = Date.UTC(2026, 8, 14);
function seedSchedule(){
  const lib = qsLib(); let added = false;
  const team = name => { const t = findTeam(name); return {name, abbr:(t && t.abbr) || shortName(name), color:(t && t.color) || '#4A4B4D'}; };
  SCHEDULE_2026.forEach(([w, A, H]) => {
    const id = `sch26-w${w}-${teamKey(A)}-${teamKey(H)}`;
    if (lib[id]) return;
    const fri = week1(2026); fri.setDate(fri.getDate() + 3 + (w - 1) * 7);
    lib[id] = {id, kind:'score', sched:true, created:SCHED_STAMP, updated:SCHED_STAMP, date:ymd(fri),
      teams:{A:team(A), H:team(H)}, A:0, H:0, per:'pre', clk:''};
    added = true;
  });
  if (added) persist();
}
