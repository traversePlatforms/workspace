/* The desk as an app on a computer or phone (2026-10-22, Matthew: no way to put it on his laptop's desktop). This worker only lets the
   browser install the page as an app. It keeps nothing: leads and notes always come from the server. With no connection, the window
   says so instead of the browser's error page. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Peak Sponsor Desk</title>'
      + '<body style="margin:0;font:16px system-ui,sans-serif;background:#1f5b46;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px">'
      + '<div><p style="font-size:20px;font-weight:700;margin:0 0 6px">No connection</p><p style="margin:0 0 16px;color:#d6e8df">The desk needs the internet.</p>'
      + '<button onclick="location.reload()" style="font:inherit;font-weight:700;background:#fff;color:#1f5b46;border:0;border-radius:10px;padding:10px 16px">Try again</button></div>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});
