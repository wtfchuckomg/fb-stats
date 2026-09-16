/* ================================================================
   Embed (?embed=1): the scoreboard, the stats pages or one game's
   gamecast running inside another site's page. The chrome comes off
   in CSS (1c-embed.html); here the frame is kept the height of the
   page so nothing scrolls inside a box, links stay in the frame
   instead of dropping the host's page into it, and the bottom is
   signed with a way back to the full site.
   ================================================================ */
const EMBEDDED = document.documentElement.classList.contains('is-embed');

// The host page listens for this and sets the iframe's height, so the embed
// grows with the week's games instead of scrolling inside a fixed box.
function embedSize(){
  const h = Math.ceil(document.documentElement.getBoundingClientRect().height);
  if (!h || h === embedSize.last) return;
  embedSize.last = h;
  try { parent.postMessage({kms:'height', height:h}, '*'); } catch (e) {}
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
    if (url.searchParams.has('embed')) return;
    url.searchParams.set('embed', '1');
    a.href = url.toString();   // not preventDefault: the click follows the new address
  });
}

// Whatever is being shown, full size, in a new tab.
function embedFoot(){
  // Drop embed from the address without rewriting the rest of it: ?state stays
  // ?state, not ?state=.
  const url = new URL(location.href);
  url.search = url.search.replace(/([?&])embed(=[^&]*)?(?=&|$)/, '$1').replace(/[?&]$/, '');
  const what = BOARD ? 'scoreboard' : COUNTY_PAGE ? 'stats page' : TEAM_PAGE ? 'page' : 'game';
  const el = document.createElement('div');
  el.className = 'emb-foot';
  el.innerHTML = `<a href="${esc(url.toString())}" target="_blank" rel="noopener">`
    + `Open this ${what} at Kansas Media Stats &#8599;</a>`;
  document.body.appendChild(el);
}

function startEmbed(){
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
