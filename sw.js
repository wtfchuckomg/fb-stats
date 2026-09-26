/* Press Box offline cache.
   Built by build.py, which stamps 234b50dd661b with the page's own hash, so every new build is a new cache.

   The page is one big file. Keep the last good copy of it, and of the season files the pages read, so the
   site opens at a field with no signal. The network is still asked first whenever it can answer quickly:
   a cached app that won't update is worse than a slow one. */
const VER = '234b50dd661b';
const SHELL = 'pb-shell-' + VER, DATA = 'pb-data-' + VER;
const NET_MS = 3000;                 // how long to wait for the network before reaching for the cache

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.add(new Request('./index.html', {cache:'reload'}))).catch(() => {}));
  self.skipWaiting();                // a new build takes over straight away; the page is served network-first anyway
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, DATA]);
    for (const k of await caches.keys()) if (k.startsWith('pb-') && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Something the page can't run without: the page itself. Only the site's own front door — the game cards
// under /g/ and /pv/ and the embed pages are their own files and must never be answered with the app.
const isShell = url => url.pathname === '/' || url.pathname === '/index.html';
// Worth having offline, but the page still works without it.
const isData = url => /\.(json|png|jpe?g|svg|webp|ico)$/i.test(url.pathname);

async function fromNet(req, cacheName, ms, fresh){
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
  try {
    // The browser is allowed to hold this site's page for ten minutes without asking. That would serve a build
    // up to ten minutes old on a phone with a perfectly good signal, so the page itself is always revalidated:
    // it costs one small conditional request, and the answer is usually "still the same".
    const res = await fetch(req, {signal:ctrl.signal, ...(fresh ? {cache:'no-cache'} : {})});
    clearTimeout(t);
    // The copy has to be taken now: once the response is handed to the page its body is gone.
    if (res && res.ok){
      const copy = res.clone();
      caches.open(cacheName).then(c => c.put(req, copy)).catch(() => {});
    }
    return res;
  } catch (e) { clearTimeout(t); return null; }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // sign-in and saving are never cached
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Firestore, Google, anything off this site: straight through
  const shell = isShell(url), data = !shell && isData(url);
  if (!shell && !data) return;
  e.respondWith((async () => {
    const cacheName = shell ? SHELL : DATA;
    // The page is asked for with its own address; the cache holds one copy of it under ./index.html.
    const key = shell ? new Request(new URL('./index.html', self.location).href) : req;
    const net = await fromNet(shell ? key : req, cacheName, shell ? NET_MS : 6000, shell);
    if (net) return net;
    const hit = await caches.match(key, {ignoreSearch:shell});
    if (hit) return hit;
    return new Response('', {status:504, statusText:'Offline'});
  })());
});
