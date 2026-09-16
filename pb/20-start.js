/* ================================================================
   Game Tracker start screen. When no game is under way (the last one
   just went final, or there's only the sample or a pasted box score),
   the tracker opens here instead of on the old game: start a new one,
   pick one off the schedule, or reopen a recent game to fix a play.
   ================================================================ */
// A game that isn't under way: the sample, a pasted box score, or one that's over.
const idleGame = x => !x || !!x.sample || !!x.box || replay(x).st.final;

// This week's games still to come that nobody is keeping stats on yet; next week's once this week's are played.
function startSchedule(){
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const pick = k => weekGames(k).filter(x => x.kind === 'score' && x.per !== 'final' && gameDay(x) >= today);
  const wk = weekKey(Date.now()), next = weekKey(fromYmd(wk).getTime() + WEEK_MS + 3 * 864e5);
  const now = pick(wk);
  return now.length ? {k:wk, list:now} : {k:next, list:pick(next)};
}

function renderStart(){
  const on = !!ui.start && !ui.viewer;
  document.body.classList.toggle('starting', on);
  const box = $('#start'); if (!box) return;
  box.hidden = !on;
  if (!on) return;
  const sched = startSchedule();
  // Each school's logo stays with its name, so a long name wraps between the teams, not away from its logo.
  const matchup = T => `<span class="s-t">${markFor(T.A, 24)}${esc(T.A.name)}</span><em>at</em><span class="s-t">${markFor(T.H, 24)}${esc(T.H.name)}</span>`;
  const schedRows = sched.list.map(x => {
    const m = summary(x), when = `${dayShort(gameDay(x))}${x.time ? ' · ' + x.time : ''}`;
    return `<li><div class="s-teams"><b>${matchup(x.teams)}</b><span>${esc(when)}${m.pre ? '' : ' · ' + esc(m.status)}</span></div>
      <button type="button" class="s-go primary" data-qs-stats="${esc(x.id)}">Keep stats</button></li>`;
  }).join('');
  const mine = Object.values(db.games).filter(x => !x.sample).sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 6);
  const mineRows = mine.map(x => {
    const st = replay(x).st, T = x.teams;
    const status = x.box ? 'Box score' : st.final ? (st.q > 4 ? 'Final/OT' : 'Final') : x.plays.length ? `In progress · ${perLabel(st.q)}` : 'Not started';
    const line = x.plays.length || x.box ? `${T.A.name} ${st.score.A}, ${T.H.name} ${st.score.H}` : `${T.A.name} at ${T.H.name}`;
    const date = gameDay(x).toLocaleDateString('en-US', {month:'short', day:'numeric'});
    return `<li><div class="s-teams"><b><span>${esc(line)}</span>${x.id === g.id ? '<i class="s-tag">Last game</i>' : ''}</b><span>${esc(date)} · ${esc(status)}</span></div>
      <button type="button" class="s-go" data-start-open="${esc(x.id)}">Open</button></li>`;
  }).join('');
  box.innerHTML = `<div class="s-main">
      <section class="hcard s-hero"><span class="h-eyebrow">Game Tracker</span>
        <h1>Start a new game</h1>
        <p>Set one up from scratch, pick a game off the schedule below, or enter one that’s already been played.</p>
        <div class="h-btns"><button type="button" class="h-btn primary" data-open="new">New game</button>
          <button type="button" class="h-btn" data-box-new>Paste a box score</button>
          <button type="button" class="h-btn" data-qs-new>Add a score</button></div>
      </section>
      <section class="hcard"><h2 class="h-rail">On the schedule · ${esc(weekLabel(sched.k))}</h2>
        ${schedRows ? `<ul class="s-list">${schedRows}</ul>` : `<p class="h-note">Nothing left on the schedule for ${esc(weekLabel(sched.k))}. Start a new game, or add one with <b>Add a score</b>.</p>`}
      </section>
    </div>
    <aside class="s-side"><section class="hcard"><h2 class="h-rail">Your games</h2>
      ${mineRows ? `<ul class="s-list">${mineRows}</ul><p class="h-note">Open a game to look it over or fix a play. Every game is under <b>Games</b> too.</p>` : '<p class="h-note">Games you track show up here.</p>'}
    </section></aside>`;
}

// Open one of your games from the start screen.
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-start-open]'); if (!b) return;
  const x = db.games[b.dataset.startOpen]; if (!x) return;
  g = x; resetUi(); setCurrent(); refresh(); scrollTo(0, 0);
});

