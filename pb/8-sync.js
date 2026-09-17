/* ================================================================
   Sync. Games follow a Google sign-in through the stats project's own
   Firebase (fb-stats, kept apart from the Pick 'ems pool): collection
   "pressbox", one document per game, private to its owner. The copy in
   this browser stays the working copy, so the page keeps running with
   no signal; when two copies meet, whichever was edited last wins.
   Rules live in firestore.rules in the STATS folder.
   ================================================================ */
const FIREBASE_VERSION = '10.14.1';
const firebaseConfig = {
  apiKey:            'AIzaSyBnIdA4E1hhAOCIR51bjXHJKoAQ4kBIr3Q',
  authDomain:        'fb-stats-dc058.firebaseapp.com',
  projectId:         'fb-stats-dc058',
  storageBucket:     'fb-stats-dc058.firebasestorage.app',
  messagingSenderId: '1096629098263',
  appId:             '1:1096629098263:web:6e0b8989816b0f7c09c952'
};
// Google refuses sign-in inside Facebook, Instagram, X and similar in-app browsers.
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|Twitter|LinkedInApp|Snapchat|Line\/|MicroMessenger|GSA\//i.test(navigator.userAgent)
  || /Android.*;\s*wv\)/i.test(navigator.userAgent);
const sync = {state:'off', user:null, api:null, unsub:null, first:true, timers:{}, pending:0, err:''};

async function startSync(){
  if (location.protocol === 'file:'){ sync.state = 'unavailable'; return renderSync(); }
  try {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-`;
    const load = Promise.all(['app', 'auth', 'firestore'].map(m => import(base + m + '.js')));
    const [appM, authM, fsM] = await Promise.race([load, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 12000))]);
    const app = appM.initializeApp(firebaseConfig);
    sync.api = {authM, fsM, auth:authM.getAuth(app), fsdb:fsM.getFirestore(app)};
  } catch (e) { sync.state = 'unavailable'; return renderSync(); }
  const {authM, auth} = sync.api;
  scoresReady(sync.api);   // shared games for the scoreboard need no sign-in
  watchRosters(sync.api);  // and other scorers' rosters, for Setup
  authM.getRedirectResult(auth).catch(err => { sync.err = friendlySync(err); renderSync(); });
  authM.onAuthStateChanged(auth, user => {
    if (sync.unsub){ sync.unsub(); sync.unsub = null; }
    sync.user = user; sync.first = true; sync.err = '';
    // The admin's devices remember it, so the scoreboard pages there sign in too and show Hide.
    ui.admin = !!user && user.uid === ADMIN_UID;
    try { localStorage.setItem('pressbox.admin', ui.admin ? '1' : ''); localStorage.setItem('pressbox.scorer', user ? '1' : ''); } catch (e) {}
    sync.state = user ? 'saving' : 'signed-out';
    if (user) listen();
    renderSync();
  });
  addEventListener('online', renderSync);
  addEventListener('offline', renderSync);
}

const newestGame = () => Object.values(db.games).filter(x => !x.sample && !x.foreign).sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];

function listen(){
  const {fsM, fsdb} = sync.api;
  const q = fsM.query(fsM.collection(fsdb, 'pressbox'), fsM.where('owner', '==', sync.user.uid));
  sync.unsub = fsM.onSnapshot(q, snap => {
    let changed = false, current = null;
    snap.docChanges().forEach(ch => {
      if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) return;
      const id = ch.doc.id, d = ch.doc.data(), local = db.games[id];
      if (id === teamsDocId()) return mergeTeams(d.json);        // the saved-teams library, not a game
      if (id === mySchoolsDocId() || d.kind === 'my-schools') return mergeMySchools(d.json);   // schools this scorer added, not a game
      if (id === HIDE_DOC || id === RECS_DOC || d.kind === 'roster' || d.kind === 'massey') return;   // hidden games, team records, shared rosters, the old Massey lines: not games
      if (d.kind === 'score') return mergeScore(id, d);           // a quick score, not a game
      const lu = local ? local.updated || 0 : -1, ru = d.updated || 0;
      if (ru > lu){
        if (d.deleted){ if (local){ delete db.games[id]; changed = true; if (g && g.id === id) current = 'gone'; } return; }
        let remote; try { remote = JSON.parse(d.json); } catch (e) { return; }
        const sound = soundGame(remote); if (!sound) return;   // a half-written record from another device
        db.games[id] = sound; changed = true;
        if (g && g.id === id) current = 'updated';
      } else if (local && lu > ru) syncPush(local, 0);
      // A game saved before the scoreboard existed gets its week, so fans' scoreboards can find it.
      else if (local && !d.deleted && !d.week) syncPush(local, 0);
    });
    if (sync.first){
      sync.first = false;
      // Games made on this device before signing in go up to the account.
      const remoteIds = new Set(snap.docs.map(x => x.id));
      Object.values(db.games).forEach(x => { if (!x.sample && !x.foreign && !remoteIds.has(x.id)) syncPush(x, 0); });
      Object.values(qsLib()).forEach(x => { if (!remoteIds.has(x.id)) pushScore(x); });
      if (!remoteIds.has(teamsDocId()) && savedTeams().length) syncTeams(0);
      if (!remoteIds.has(mySchoolsDocId()) && mySchoolNames().length) syncMySchools(0);
      // A device still showing the sample opens the latest real game instead.
      if (g && g.sample && newestGame()){ g = newestGame(); resetUi(); ui.start = idleGame(g); current = 'opened'; changed = true; }
    }
    if (current === 'updated') g = db.games[g.id];
    if (current === 'gone'){ g = newestGame() || sampleGame(); resetUi(); ui.start = idleGame(g); }
    if (changed){ db.games[g.id] = g; db.cur = g.id; persist(); }
    if (current){
      if (ui.editing != null && ui.editing >= g.plays.length) resetUi();
      refresh();
      toast(current === 'opened' ? (ui.start ? 'Your games are synced' : 'Opened your latest game') : current === 'gone' ? 'That game was deleted on another device' : 'Updated from another device');
    }
    if (ui.dlg === 'games') dlg().innerHTML = dlgGames();
    if (!sync.pending && !Object.keys(sync.timers).length && !sync.err) sync.state = 'on';
    renderSync();
  }, err => { sync.state = 'error'; sync.err = friendlySync(err); renderSync(); });
}

// The one-line score a shared link shows on social media ("Independence 14, Augusta 28" · "Final · Fri, Sep 11").
// The preview-page job in the site's repo (.github/previews.py) reads it from each shared game.
function shareCard(game){
  const A = game.teams.A.name, H = game.teams.H.name;
  try {
    const m = summary(game), day = gameDay(game).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
    if (m.pre) return {t:`${A} at ${H}`, s:day};
    // The higher score first ("Augusta 28, Independence 14"); a tie keeps visitors first.
    const [hi, lo] = m.score.H > m.score.A ? [[H, m.score.H], [A, m.score.A]] : [[A, m.score.A], [H, m.score.H]];
    return {t:`${hi[0]} ${hi[1]}, ${lo[0]} ${lo[1]}`, s:`${m.status} · ${day}`};
  } catch (e) { return {t:`${A} at ${H}`, s:''}; }
}
// A game's link to share. On the site itself it's the preview page (/g/<id>/), which shows the game on social media
// and sends people straight to it.
const gameLink = id => location.hostname === 'stats.kansasmediarankings.com'
  ? `https://stats.kansasmediarankings.com/g/${encodeURIComponent(id)}/` : `${location.origin}${location.pathname}?game=${encodeURIComponent(id)}`;

function syncPush(game, delay = 700){
  // Another scorer's game (the admin editing it) is saved back to them by hand, in saveForeign.
  if (!sync.user || !game || game.sample || game.foreign) return;
  clearTimeout(sync.timers[game.id]);
  sync.timers[game.id] = setTimeout(() => pushNow(game.id), delay);
  sync.state = 'saving'; renderSync();
}
async function pushNow(id){
  delete sync.timers[id];
  const game = db.games[id];
  if (!game || !sync.user) return;
  const {fsM, fsdb} = sync.api;
  sync.pending++;
  try {
    await fsM.setDoc(fsM.doc(fsdb, 'pressbox', id), {owner:sync.user.uid, updated:game.updated || Date.now(), public:!!game.share, week:gameWeek(game),
      title:`${game.teams.A.abbr} at ${game.teams.H.abbr}`, card:shareCard(game), json:JSON.stringify(game)});
    sync.err = '';
  } catch (e) { sync.err = friendlySync(e); }
  sync.pending--;
  sync.state = sync.err ? 'error' : sync.pending || Object.keys(sync.timers).length ? 'saving' : 'on';
  renderSync();
}
// Deleting leaves a marker rather than removing the document, so other devices learn about it too.
function syncDelete(id){
  if (!sync.user || id === 'sample') return;
  clearTimeout(sync.timers[id]); delete sync.timers[id];
  const {fsM, fsdb} = sync.api;
  fsM.setDoc(fsM.doc(fsdb, 'pressbox', id), {owner:sync.user.uid, updated:Date.now(), deleted:true, json:''})
    .catch(e => { sync.err = friendlySync(e); sync.state = 'error'; renderSync(); });
}

async function signIn(){
  if (!sync.api) return openDialog('games');
  if (IN_APP_BROWSER) return toast('Open this page in Safari or Chrome to sign in');
  const {authM, auth} = sync.api, provider = new authM.GoogleAuthProvider();
  // Embedded browsers may block IndexedDB; walk down to whatever storage this one allows.
  for (const p of [authM.indexedDBLocalPersistence, authM.browserLocalPersistence, authM.browserSessionPersistence, authM.inMemoryPersistence]){
    try { await authM.setPersistence(auth, p); break; } catch (e) { /* try the next */ }
  }
  try { await authM.signInWithPopup(auth, provider); }
  catch (err){
    let e = err;
    // Phones routinely block the popup; a redirect works where it doesn't.
    if (/popup-blocked|popup-closed-by-user|operation-not-supported/.test(err?.code || '')){
      try { await authM.signInWithRedirect(auth, provider); return; } catch (e2) { e = e2; }
    }
    sync.err = friendlySync(e); if (sync.err) toast(sync.err); renderSync();
  }
}
async function signOutSync(){
  if (!sync.api) return;
  try { await sync.api.authM.signOut(sync.api.auth); toast('Signed out. Games stay on this device.'); } catch (e) { toast(friendlySync(e)); }
}
function friendlySync(e){
  const code = e?.code || '';
  if (code.includes('permission-denied')) return 'Firebase turned the save down. The Press Box rules may not be published yet.';
  if (code.includes('not-found') || /database .*does not exist/i.test(e?.message || '')) return 'The stats project has no Firestore database yet. Create one in the Firebase console.';
  if (code.includes('operation-not-allowed')) return 'Google sign-in isn’t switched on in the stats project yet (Authentication → Sign-in method).';
  if (code.includes('unauthorized-domain')) return 'Google sign-in isn’t allowed at this address yet. Add it in the stats Firebase project under Authentication → Settings → Authorized domains.';
  if (code.includes('disallowed-useragent') || code.includes('operation-not-supported')) return 'This browser can’t complete Google sign-in. Open the page in Safari or Chrome.';
  if (code.includes('web-storage-unsupported')) return 'This browser is blocking site storage, which sign-in needs. Open the page in Safari or Chrome.';
  if (code.includes('unavailable') || code.includes('network')) return 'Can’t reach the server. Your games are still saved on this device.';
  if (code.includes('cancelled') || code.includes('popup-closed')) return '';
  return e?.message || 'Something went wrong with sync.';
}

function renderSync(){
  const el = $('#sync'); if (!el) return;
  let s = sync.state;
  if (s === 'off'){ el.innerHTML = ''; return; }
  if (sync.user && navigator.onLine === false) s = 'offline';
  const label = {unavailable:'This device only', 'signed-out':'Sign in to sync', on:'Synced', saving:'Saving…', offline:'Offline · saved here', error:'Sync problem'}[s];
  const cls = {on:'ok', saving:'busy', offline:'busy', error:'bad'}[s] || '';
  const tip = sync.err || (sync.user ? `Signed in as ${sync.user.email || ''}` : s === 'unavailable' ? 'Syncing works on your own site' : 'Keep your games on every device');
  el.innerHTML = `<button class="abtn syncbtn ${cls}" data-sync title="${esc(tip)}"><i></i>${label}</button>`;
  // All Games (every other scorer's games) is the admin's alone.
  const admin = !!(sync.user && sync.user.uid === ADMIN_UID);
  const ob = $('#othersbtn'); if (ob) ob.hidden = !admin;
  const sb = $('#schoolsbtn'); if (sb) sb.hidden = !admin;
  if (ui.dlg === 'others' && dlg().open) dlg().innerHTML = dlgOthers();
  if (ui.dlg === 'games' && dlg().open){ const a = $('#acct'); if (a) a.outerHTML = syncBlock(); }
  if (ui.dlg === 'share' && dlg().open) dlg().innerHTML = dlgShare();
}

/* ---------- live look-in: ?live=<game id> shows a shared game, read-only ---------- */
// A game's own page: ?game=<id> (the older ?live=<id> links still work).
const LIVE_ID = new URLSearchParams(location.search).get('game') || new URLSearchParams(location.search).get('live');
async function startViewer(id){
  ui.viewer = true; document.body.classList.add('viewer');
  // The scoreboard's Box Score button opens a game straight to that tab.
  const tab0 = new URLSearchParams(location.search).get('tab');
  if (['gamecast', 'box', 'pbp', 'team'].includes(tab0)) ui.tab = tab0;
  $('#sample').hidden = true;
  if (!g) $('#view').innerHTML = '<div class="panel"><div class="empty">Loading the live game…</div></div>';
  let api; try { api = await viewerApi(); } catch (e) { viewerApiP = null; return viewerMessage('Can’t reach the live game. Check your connection and reload.'); }
  const {fsM, fsdb, asAdmin} = api;
  let noted = false;
  const gone = () => viewerMessage('This game isn’t being shared right now.');
  // Once per page: a school's gamecast calls this again each time that school's game changes.
  if (!startViewer.ready){ startViewer.ready = true; scoresReady({fsM, fsdb}); setInterval(renderLive, 5000); }
  if (startViewer.unsub) startViewer.unsub();
  startViewer.unsub = fsM.onSnapshot(fsM.doc(fsdb, 'pressbox', id), snap => {
    const d = snap.exists() ? snap.data() : null;
    if (!d || d.deleted || (!d.public && !asAdmin)) return gone();
    if (!d.public && !noted){ noted = true; toast('Private game: only you, as the admin, can see it'); }
    // On the site itself the address becomes the game's preview link (/g/<id>/), so copying it and posting it shows
    // this game on social media. Only once that page exists: a brand-new game's link stays ?game=, which previews
    // as the site. The base keeps the page's own links pointing at the site.
    if (d.public && !SCHOOL_CAST && location.hostname === 'stats.kansasmediarankings.com' && !location.pathname.startsWith('/g/') && !startViewer.checked){
      startViewer.checked = true;
      fetch(`/g/${encodeURIComponent(id)}/`, {method:'HEAD'}).then(r => {
        if (!r.ok || location.pathname.startsWith('/g/')) return;
        if (!document.querySelector('base')){ const b = document.createElement('base'); b.href = '/'; document.head.prepend(b); }
        const tab = new URLSearchParams(location.search).get('tab');
        history.replaceState(null, '', `/g/${encodeURIComponent(id)}/${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`);
      }).catch(() => {});
    }
    let game; try { game = soundGame(JSON.parse(d.json)); } catch (e) { return; }
    if (!game) return gone();   // a half-written copy: nothing to show, and it must not break the page
    g = game; $('#tabs').hidden = false;
    refresh(); viewerTools(id);
    const [hi, lo] = R.st.score.H > R.st.score.A ? ['H', 'A'] : ['A', 'H'];   // the higher score first, like the link's preview
    document.title = `${g.teams[hi].name} ${R.st.score[hi]}, ${g.teams[lo].name} ${R.st.score[lo]} · Kansas Media Stats`;
  }, gone);
}
// Firebase for a watcher's page, set up once and shared (a school's gamecast moves from game to game).
let viewerApiP = null;
function viewerApi(){
  if (viewerApiP) return viewerApiP;
  return viewerApiP = (async () => {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-`;
    // The admin's devices sign in here too, so an unshared game opened from All Games can be read.
    let admin = false; try { admin = localStorage.getItem('pressbox.admin') === '1'; } catch (e) {}
    const [appM, fs, authM] = await Promise.all(['app', 'firestore', ...(admin ? ['auth'] : [])].map(m => import(base + m + '.js')));
    const app = appM.initializeApp(firebaseConfig), fsdb = fs.getFirestore(app);
    let asAdmin = false;
    if (authM) asAdmin = await new Promise(res => { const off = authM.onAuthStateChanged(authM.getAuth(app), u => { off(); res(!!u && u.uid === ADMIN_UID); }); });
    return {fsM:fs, fsdb, asAdmin};
  })();
}

/* ---------- a school's gamecast: ?gamecast=<school> shows whatever game that school is playing ----------
   For a newspaper that wants Friday's game in an article before anyone has started keeping stats on it (a game only
   gets its own address once a scorer starts it). It watches this week's shared games and last week's: the school's
   game in progress, else this week's tracked game, else a note about the game coming up, else last week's game. */
const SCHOOL_CAST = new URLSearchParams(location.search).get('gamecast');
async function startSchoolCast(school){
  ui.viewer = true; document.body.classList.add('viewer');
  $('#sample').hidden = true;
  $('#view').innerHTML = '<div class="panel"><div class="empty">Finding the game…</div></div>';
  let api; try { api = await viewerApi(); } catch (e) { viewerApiP = null; return viewerMessage('Can’t reach the live game. Check your connection and reload.'); }
  const {fsM, fsdb} = api;
  loadLogos();   // a school's other names ("Haysville Campus") only match once the school list is here
  const now = weekKey(Date.now()), prev = weekKey(fromYmd(now).getTime() - 3 * 864e5);
  const weeks = {[now]:null, [prev]:null};
  let showing = null;
  const pick = () => {
    if (Object.values(weeks).some(v => v === null)) return;
    const want = canonSchool(String(school).replace(/[-_]+/g, ' '));
    const mine = [...Object.values(weeks[now]), ...Object.values(weeks[prev])]
      .filter(x => x.teams && x.teams.A && x.teams.H && ['A', 'H'].some(s => canonSchool(x.teams[s].name) === want));
    const newest = (a, b) => (b.updated || 0) - (a.updated || 0);
    const tracked = mine.filter(x => x.kind !== 'score' && (Array.isArray(x.plays) || x.box));
    const inProgress = x => { if (x.box || !x.plays.length) return false; try { return !replay(x).st.final; } catch (e) { return false; } };
    const live = tracked.filter(inProgress).sort(newest)[0];
    const thisWeek = tracked.filter(x => x._wk === now).sort(newest)[0];
    const coming = mine.filter(x => x.kind === 'score' && x._wk === now && x.per !== 'final').sort((a, b) => gameDay(a) - gameDay(b))[0];
    const game = live || thisWeek || (coming ? null : tracked.filter(x => x._wk === prev).sort(newest)[0]);
    if (game){ if (showing !== game.id){ showing = game.id; startViewer(game.id); } return; }
    if (showing){ if (startViewer.unsub) startViewer.unsub(); startViewer.unsub = null; showing = null; }
    const q = coming || mine.filter(x => x.kind === 'score').sort(newest)[0];
    const name = schoolName(String(school).replace(/[-_]+/g, ' '));
    if (!q) return viewerMessage(`No game this week for ${name} yet. The gamecast shows up here as soon as there is one.`);
    const T = q.teams;
    viewerMessage(q.per === 'final'
      ? `Final: ${T.A.name} ${+q.A || 0}, ${T.H.name} ${+q.H || 0}. Nobody kept stats on this game, so there’s no gamecast.`
      : `${T.A.name} at ${T.H.name}, ${dayShort(gameDay(q))}${q.time ? ' at ' + q.time : ''}. The gamecast starts here once someone keeps stats on the game.`);
  };
  [now, prev].forEach(k => fsM.onSnapshot(fsM.query(fsM.collection(fsdb, 'pressbox'), fsM.where('public', '==', true), fsM.where('week', '==', k)), snap => {
    const docs = {};
    snap.forEach(d => { const v = d.data(); if (v.deleted || !v.json) return; try { const x = JSON.parse(v.json); if (x && x.teams) docs[d.id] = Object.assign(x, {id:d.id, _wk:k}); } catch (e) {} });
    weeks[k] = docs; pick();
  }, () => { weeks[k] = {}; pick(); }));
  setInterval(pick, 60000);   // the school list arriving, or the day turning over
}
// On a game's own page: Edit, only for its scorer, signed in on the device where the game is kept. Everyone else
// just watches (the address bar has the link).
function viewerTools(id){
  const el = $('#vbtns'); if (!el) return;
  let mine = false;
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || 'null');
    mine = localStorage.getItem('pressbox.scorer') === '1' && !!(d && d.games && d.games[id]);
  } catch (e) {}
  el.hidden = !mine;
  // Always the site's own address, never the current one: on a preview link the path is /g/<id>/, and that page
  // only bounces back here, so Edit built from it would send the scorer round in a circle.
  const home = location.hostname === 'stats.kansasmediarankings.com' || location.pathname.startsWith('/g/') ? '/' : location.pathname;
  el.innerHTML = mine ? `<a class="abtn" href="${esc(home)}?edit=${encodeURIComponent(id)}">Edit</a>` : '';
}
function viewerMessage(msg){
  g = null;
  $('#sb').innerHTML = ''; $('#rail').innerHTML = ''; $('#tabs').hidden = true;
  $('#view').innerHTML = `<div class="panel"><div class="empty">${esc(msg)}</div></div>`;
  renderLive();
}
function renderLive(){
  const el = $('#livebadge'); if (!el) return;
  if (!ui.viewer || !g){ el.hidden = true; return; }
  const final = R && R.st.final, ago = Math.max(0, Math.round((Date.now() - (g.updated || Date.now())) / 1000));
  el.hidden = false; el.classList.toggle('final', !!final);
  // Short, so it sits on the menu bar's one row: a final is just Final; a live game says how fresh it is.
  el.innerHTML = `<i></i>${final ? 'Final' : `Live · ${ago < 60 ? `${ago}s` : `${Math.round(ago / 60)} min`} ago`}`;
}
function syncBlock(){
  const s = sync.state, u = sync.user;
  if (s === 'off') return '<div id="acct"></div>';
  if (s === 'unavailable') return `<div class="acct" id="acct"><p class="hint">Games are saved in this browser only. To keep them on every device, open Press Box from your own site and sign in with Google.</p></div>`;
  if (!u) return `<div class="acct" id="acct"><div><b>Keep your games on every device</b>
    <p class="hint">Sign in with your Google account and your games follow you to any phone or computer where you sign in.</p></div>
    <button class="btn small primary" data-signin>Sign in with Google</button></div>`;
  return `<div class="acct" id="acct"><div><b>Syncing to ${esc(u.email || 'your account')}</b>
    <p class="hint">${sync.err ? esc(sync.err) : 'Every change is saved here and to your account. Sign in on another device to pick up where you left off.'}</p></div>
    <button class="btn small" data-signout>Sign out</button></div>`;
}
