/* ================================================================
   Embed (?embed=1): the scoreboard, the stats pages or one game's
   gamecast running inside another site's page. The chrome comes off
   in CSS (1c-embed.html); here the frame is kept the height of the
   page so nothing scrolls inside a box, links stay in the frame
   instead of dropping the host's page into it, and the bottom is
   signed with a way back to the full site.
   ================================================================ */
const EMBEDDED = document.documentElement.classList.contains('is-embed');
// Pasted into WordPress as a plain link (embed/<page>/), WordPress frames the page with "#?secret=…" on the end
// and sizes the frame when told the height with that secret — the only way in on a site that strips iframes.
const WP_SECRET = (location.hash.match(/[#?&]secret=([A-Za-z0-9]+)/) || [])[1] || '';

// The host page listens for this and sets the iframe's height, so the embed
// grows with the week's games instead of scrolling inside a fixed box.
function embedSize(){
  const h = Math.ceil(document.documentElement.getBoundingClientRect().height);
  if (!h || h === embedSize.last) return;
  embedSize.last = h;
  try { parent.postMessage({kms:'height', height:h}, '*'); } catch (e) {}
  if (WP_SECRET) try { parent.postMessage({message:'height', value:h, secret:WP_SECRET}, '*'); } catch (e) {}
}

// A link inside the embed keeps the reader inside the embed: same page, still
// embedded. Anything off this site opens in a new tab, so the host never
// finds another site loaded inside its article.
function embedLinks(){
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    let url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
    if (url.origin !== location.origin){ a.target = '_blank'; a.rel = 'noopener'; return; }
    if (a.hasAttribute('download') || a.target === '_blank') return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;  // same page
    if (url.searchParams.has('embed') && (!WP_SECRET || url.hash)) return;
    url.searchParams.set('embed', '1');
    if (WP_SECRET) url.hash = '?secret=' + WP_SECRET;   // the next page keeps telling WordPress its height
    a.href = url.toString();   // not preventDefault: the click follows the new address
  });
}

// Whatever is being shown, full size, in a new tab.
function embedFoot(){
  // Drop embed from the address without rewriting the rest of it: ?state stays
  // ?state, not ?state=.
  const url = new URL(location.href);
  url.search = url.search.replace(/([?&])embed(=[^&]*)?(?=&|$)/, '$1').replace(/[?&]$/, '').replace(/&&+/g, '&');
  url.hash = '';
  const what = BOARD ? 'scoreboard' : COUNTY_PAGE ? 'stats page' : AV_STAND ? 'standings' : TEAM_PAGE ? 'page' : 'game';
  const el = document.createElement('div');
  el.className = 'emb-foot';
  el.innerHTML = `<a href="${esc(url.toString())}" target="_blank" rel="noopener">`
    + `Open this ${what} at Kansas Media Stats &#8599;</a>`;
  document.body.appendChild(el);
  // WordPress locks its frames against new tabs; it opens a link on our site in the reader's own tab when asked.
  if (WP_SECRET) el.querySelector('a').addEventListener('click', e => {
    e.preventDefault();
    try { parent.postMessage({message:'link', value:url.toString(), secret:WP_SECRET}, '*'); } catch (err) {}
  });
}

function startEmbed(){
  startEmbedButton();
  if (!EMBEDDED) return;
  embedLinks();
  embedFoot();
  embedSize();
  addEventListener('load', embedSize);
  addEventListener('resize', embedSize);
  if (window.ResizeObserver) new ResizeObserver(embedSize).observe(document.body);
  // Scores arrive after the first paint, and a render can change the height
  // without resizing the body, so check on a slow beat as well.
  setInterval(embedSize, 1000);
}

/* ---------- the admin's Embed button: the WordPress link for the page you're on ----------
   Only on the admin's devices (the same flag that shows Others). Each link is an embed/<page>/ address that
   .github/embeds.py writes; pasted on its own line in a WordPress post, it becomes this page in a box. */
const EMBED_BASE = 'https://stats.kansasmediarankings.com/embed/';
const onAdminDevice = () => { try { return localStorage.getItem('pressbox.admin') === '1'; } catch (e) { return false; } };
function embedChoices(){
  const q = new URLSearchParams(location.search), out = [];
  const page = (label, slug) => out.push({label, slug});
  if (q.has('scores')) page('BUCO Scoreboard', 'buco-scoreboard');
  if (q.has('stats')) q.get('stats') === 'team' ? page('BUCO Team Stats', 'buco-team-stats') : page('BUCO Player Stats', 'buco-stats');
  if (q.has('avctl')) page('AVCTL Scoreboard', 'avctl-scoreboard');
  if (q.has('standings')) page('AVCTL Standings', 'avctl-standings');
  if (q.has('avstats')) q.get('avstats') === 'team' ? page('AVCTL Team Stats', 'avctl-team-stats') : page('AVCTL Player Stats', 'avctl-stats');
  if (q.has('state')) page('State Scoreboard', 'state-scoreboard');
  if (q.has('statestats')) page('State Stats', 'state-stats');
  // A school's gamecast link follows whatever game that school is playing; only schools on the list have one.
  const listed = new Set((LOGO_SRC[0].list || []).map(t => t.slug));
  const school = n => { const k = n && canonSchool(n); if (k && listed.has(k) && !out.some(o => o.slug === 'gamecast/' + k))
    out.push({label:`${schoolName(n)} gamecast`, note:'Whatever game they’re playing: live once someone keeps stats, then the final', slug:'gamecast/' + k}); };
  if (LIVE_ID){ out.push({label:'This game', note:'Always this one game', slug:'game/' + LIVE_ID, check:true}); if (g) ['A', 'H'].forEach(s => school(g.teams[s].name)); }
  if (SCHOOL_CAST) school(String(SCHOOL_CAST).replace(/[-_]+/g, ' '));
  if (TEAM_PAGE && tpage.name) school(tpage.name);
  return out;
}
function dlgEmbed(){
  const rows = embedChoices().map((c, i) => `<div class="grp emb-row"><h3>${esc(c.label)}</h3>${c.note ? `<p class="hint">${esc(c.note)}</p>` : ''}
    <div class="line"><input class="inp emb-url" id="emb-${i}" value="${esc(EMBED_BASE + c.slug + '/')}" readonly>
      <button type="button" class="btn small primary" data-emb-copy="emb-${i}">Copy</button></div>
    ${c.check ? `<p class="hint emb-check" data-emb-check="${esc(c.slug)}" hidden>This game’s own link isn’t made yet; it comes with the nightly rebuild. Use a school’s gamecast link for now.</p>` : ''}</div>`).join('');
  return `<div class="dlg-hd"><h2>Embed</h2><button class="x" type="button" data-emb-close aria-label="Close">×</button></div>
    <div class="dlg-bd"><p class="hint">Paste a link on its own line in a WordPress post and it turns into this page in a box.</p>
      ${rows || '<p class="hint">This page has no embed link.</p>'}</div>
    <div class="dlg-ft"><button type="button" class="btn primary" data-emb-close>Done</button></div>`;
}
function openEmbed(){
  ui.dlg = 'embed'; dlg().innerHTML = dlgEmbed(); if (!dlg().hasAttribute('open')) showDialog();
  // A game's page doesn't load the school list, and the gamecast links need it: fetch it, then show them.
  if (!(LOGO_SRC[0].list || []).length) fetch(LOGO_SRC[0].base + 'teams.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : [])
    .then(list => { if (!Array.isArray(list) || !list.length) return; LOGO_SRC[0].list = list; if (ui.dlg === 'embed' && dlg().open) openEmbed(); }).catch(() => {});
  // A game's own link only exists once the rebuild has made it.
  dlg().querySelectorAll('[data-emb-check]').forEach(el => fetch('/embed/' + el.dataset.embCheck + '/oembed.json', {method:'HEAD', cache:'no-cache'})
    .then(r => { if (!r.ok) el.hidden = false; }).catch(() => {}));
}
function startEmbedButton(){
  if (EMBEDDED || !onAdminDevice()) return;
  const tools = document.querySelector('.navtools'); if (!tools) return;
  const q = new URLSearchParams(location.search);
  if (!['scores', 'stats', 'avctl', 'standings', 'avstats', 'state', 'statestats', 'game', 'live', 'gamecast', 'team'].some(k => q.has(k))) return;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'abtn'; b.id = 'embedbtn'; b.textContent = 'Embed';
  tools.insertBefore(b, tools.querySelector('#sync'));
}
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('button'); if (!t) return;
  if (t.id === 'embedbtn') return openEmbed();
  if (t.dataset.embCopy) return copyFrom(t.dataset.embCopy);
  if ('embClose' in t.dataset) return closeDialog();
});
