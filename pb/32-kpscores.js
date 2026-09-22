/* ================================================================
   Friday night's finals, for the games nobody kept stats on.

   A job reads KPreps after the games end and writes /kpscores.json
   (.github/kp/scores.py). Here that file fills in the score of any
   schedule entry still sitting at 0-0, so a Friday score shows up
   without anyone typing it. A game someone tracked, a quick score
   already entered, or any game with a box score is left alone.
   ================================================================ */
const kps = {rows:null, idx:null, want:false, logos:0};
// KPreps writes some schools another way round — "Towanda-Circle" for the school this site calls Circle.
// The logo list carries those aliases, so both names settle on ours.
const kpAlias = n => {
  const k = logoSlug(n);
  const t = (logoLib.list || []).find(v => logoSlug(v.name) === k || v.slug === k || (v.aliases || []).some(a => logoSlug(a) === k));
  return canonSchool(t ? t.name : n);
};
function loadKpScores(){
  if (kps.want) return;
  kps.want = true;
  fetch('/kpscores.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(d => {
    if (!d || !Array.isArray(d.games)) return;
    kps.rows = d.games; kps.idx = null;
    renderScores(); renderScoreboard(); renderTeamPage(); renderHome();
  }).catch(() => {});
}
// Keyed by the two schools and the week, under both the name KPreps prints and its own slug, since we
// write some schools another way round ("Circle" for towanda-circle).
function kpIndex(){
  const n = (logoLib.list || []).length;
  if (kps.idx && kps.logos === n) return kps.idx;
  kps.logos = n;
  const idx = new Map();
  (kps.rows || []).forEach(r => {
    const wk = r.d ? weekKey(fromYmd(r.d).getTime()) : '';
    [[r.hn, r.an], [r.h.replace(/-/g, ' '), r.a.replace(/-/g, ' ')]].forEach(([h, a]) => {
      const k = `${wk}|${[kpAlias(h), kpAlias(a)].sort().join('|')}`;
      if (!idx.has(k)) idx.set(k, r);
    });
  });
  kps.idx = idx;
  return idx;
}
// The final for this game, if KPreps has one and we don't.
function kpFinal(x){
  if (!kps.rows || !x || !x.teams || !x.teams.A || !x.teams.H) return null;
  // A schedule entry, or a gamecast somebody opened and never kept: either way nothing has been entered, so
  // the final we already have can stand in. A game with plays, a box score or a typed score is left alone.
  if (x.box || x.stats || (x.plays && x.plays.length)) return null;
  // Nothing entered at all: not before kickoff, and not a game marked final with nobody's score in it.
  // A game in progress keeps whatever the scorer has, and any score at all is left alone.
  if (!['pre', 'final', 'fot'].includes(x.per || 'pre') || (+x.A || 0) || (+x.H || 0)) return null;    // a score is already in
  const A = x.teams.A.name, H = x.teams.H.name;
  const r = kpIndex().get(`${gameWeek(x)}|${[kpAlias(A), kpAlias(H)].sort().join('|')}`);
  if (!r) return null;
  // Whoever KPreps has at home may be the other way round from our schedule; go by the school, not the side.
  const home = kpAlias(r.hn) === kpAlias(H) || kpAlias(r.h.replace(/-/g, ' ')) === kpAlias(H);
  return {A:home ? r.ap : r.hp, H:home ? r.hp : r.ap};
}
// The same game with that score in it. Nothing is written to the database: this is how the page reads it.
function kpFill(x){
  // Friday night's file first, then the schedule file, which carries KPreps' finals for every week of the season.
  const f = kpFinal(x) || schedFinal(x);
  if (!f) return x;
  // A snapshot game carries its result in snap, so that has to say final too, or the page reads the old 0-0.
  const snap = x.snap ? {snap:{fin:true, live:false, status:'Final', q:4, score:{A:f.A, H:f.H}}} : null;
  return Object.assign({}, x, {A:f.A, H:f.H, per:'final', kp:true}, snap);
}
