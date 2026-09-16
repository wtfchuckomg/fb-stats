/* ================================================================
   The 2026 schedules of the Butler County schools' opponents, from the
   KPreps week pages (OPP_SCHEDULE_2026 in 22-oppdata.js), loaded like
   the county schedule: a scheduled game, or the final score once
   played, each with a fixed id so a second device makes no duplicates
   and any later edit wins. The county's own games aren't in it; its
   schedule stands as it is. They fill the team pages, count toward
   records and show on the State Scoreboard; the BUCO Scoreboard, the
   scores strip and the tracker's start screen leave them out.
   ================================================================ */
const OPP_STAMP = Date.UTC(2026, 8, 14, 18);
function seedOppSchedule(){
  const lib = qsLib(); let added = false;
  // An earlier version loaded these from MaxPreps, which had some home teams and scores the wrong way round: those go.
  Object.values(lib).forEach(x => { if (x.id && x.id.startsWith('opp26-') && !x.deleted){ lib[x.id] = {id:x.id, kind:'score', deleted:true, updated:Date.now()}; added = true; } });
  const team = name => { const t = findTeam(name); return {name, abbr:(t && t.abbr) || shortName(name), color:(t && t.color) || '#4A4B4D'}; };
  OPP_SCHEDULE_2026.forEach(([date, A, H, a, h]) => {
    const id = `kp26-${date}-${teamKey(A)}-${teamKey(H)}`;
    if (lib[id]) return;
    const fin = a != null && h != null;
    lib[id] = {id, kind:'score', sched:true, opp:true, created:OPP_STAMP, updated:OPP_STAMP, date,
      teams:{A:team(A), H:team(H)}, A:fin ? a : 0, H:fin ? h : 0, per:fin ? 'final' : 'pre', clk:''};
    added = true;
  });
  if (added) persist();
}

