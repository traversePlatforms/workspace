/* Sixfold Rounds — opens with no signal (2026-10-03).

   Until now there was no service worker, on purpose: the page always loaded fresh, so an upload
   was never hidden behind a stale copy. The cost was that closing or reloading the app in a dead
   zone left the crew locked out until they found signal (Fable's review of the save queue).

   This keeps the first promise and fixes the second. It is NETWORK FIRST for everything:
   with signal, the page and the data come from the server exactly as before, and the copy kept
   here is only refreshed. Only when the network fails (or takes longer than TIMEOUT) does the
   saved copy answer, marked with an X-Sixfold-Offline header so the page can say so.

   What is kept: the page itself, its icons, and the answers to four read-only questions —
   who am I (me), the towns (regions), the neighbourhoods you have opened (area, the last
   AREA_MAX of them) and the money sheets. Nothing is kept for any write (the page's own queue
   handles those), for the quote tool's data, or for any answer that wasn't a 200.
   Sign-out deletes the kept answers: they hold names and addresses, and iPads are shared.
   So does any "signed out" (401) answer from the server, and a kept answer older than MAX_AGE
   is not shown (review 2026-10-03): a week-old door list is worse than an honest "no signal".

   ⚑ Bump SHELL_V when this file changes. The browser re-checks this file on every visit
   (registered with updateViaCache: 'none'); flush SiteGround's cache after uploading it. */
const SHELL_V = 'rounds-shell-2026-10-03b';
const API = 'rounds-api';
const TIMEOUT = 6000;
const AREA_MAX = 40;
const MAX_AGE = 7 * 86400 * 1000;
const SHELL = ['./', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const KEEP = /\/api\/rounds\.php\?(?:.*&)?action=(me|regions|area|money)(?:&|$)/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_V).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== SHELL_V && k !== API).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  if (e.data === 'clear-api') e.waitUntil(caches.delete(API));
});

function offline(res) {
  /* a copy of the kept answer, flagged so the page can show "no signal — saved copy" */
  const h = new Headers(res.headers); h.set('X-Sixfold-Offline', '1');
  return res.blob().then((b) => new Response(b, { status: res.status, statusText: res.statusText, headers: h }));
}
/* kept with the time it was kept. Never awaited, and a failure (a full disk, a private window)
   only means nothing is kept: the live answer still reaches the page (review 2026-10-03) */
function keep(cacheName, key, res) {
  return res.blob().then((b) => {
    const h = new Headers(res.headers); h.set('X-Sixfold-Kept', String(Date.now()));
    return caches.open(cacheName).then((c) => c.put(key, new Response(b, { status: 200, statusText: 'OK', headers: h }))
      .then(() => { if (cacheName === API) return trim(c); }));
  }).catch(() => {});
}
function fresh(hit) { const t = +(hit && hit.headers.get('X-Sixfold-Kept')); return !!hit && !!t && Date.now() - t < MAX_AGE; }
async function trim(cache) {
  const keys = (await cache.keys()).filter((r) => /action=area/.test(r.url));
  for (let i = 0; i < keys.length - AREA_MAX; i++) await cache.delete(keys[i]);
}
function networkFirst(req, cacheName, fallbackKey, flag) {
  const net = fetch(req).then((res) => {
    if (res && res.status === 200) keep(cacheName, fallbackKey || req, res.clone());
    else if (res && res.status === 401 && cacheName === API) caches.delete(API).catch(() => {});   /* signed out: nothing kept */
    return res;
  });
  const kept = () => caches.open(cacheName).then((c) => c.match(fallbackKey || req, { ignoreVary: true }))
    .then((hit) => hit || (fallbackKey ? caches.open(cacheName).then((c) => c.match('./')) : null))
    .then((hit) => (cacheName !== API || fresh(hit)) ? hit : null)
    .catch(() => null);
  const timer = new Promise((res) => setTimeout(() => res('timeout'), TIMEOUT));
  return Promise.race([net.catch(() => 'down'), timer]).then(async (r) => {
    if (r instanceof Response) return r;
    const hit = await kept();
    if (hit) { net.catch(() => {}); return flag ? offline(hit) : hit; }
    return net;   /* nothing kept: wait for the network after all (it may still answer, or fail as before) */
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       /* writes go straight through; the page queues them */
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        /* map tiles, fonts, Leaflet: the browser's own cache */
  if (req.mode === 'navigate' && url.pathname.startsWith(new URL('./', self.location).pathname)) {
    if (/quote\.html$/.test(url.pathname)) return;        /* the quote tool stays online-only */
    e.respondWith(networkFirst(req, SHELL_V, './', false));
    return;
  }
  if (KEEP.test(url.pathname + url.search)) { e.respondWith(networkFirst(req, API, null, true)); return; }
  if (SHELL.some((p) => url.pathname.endsWith(p.replace('./', '/')) && p !== './')) e.respondWith(networkFirst(req, SHELL_V, null, false));
});
