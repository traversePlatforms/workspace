/* The hub as an app (2026-10-22, Matthew: the three apps "in the same tabs"). This worker only lets the
   browser install the page as an app. It keeps nothing: nothing is stored on the device, every request goes to the
   server as before. With no connection, the window says so instead of the browser's error page. */
/* Alerts (2026-10-26, Matthew: "can i still get notification from the hub app?"): the field app's alerts (new leads, job notes,
   reminders, warnings) also come to the hub when it is turned on with the bell in the hub's top bar; a tap opens the hub. */
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Traverse', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Traverse', { body: d.body || '', tag: d.tag || undefined, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if ('focus' in cs[i]) return cs[i].focus();
    return self.clients.openWindow(self.registration.scope);
  }));
});
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Traverse Hub</title>'
      + '<body style="margin:0;font:16px system-ui,sans-serif;background:#13294b;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px">'
      + '<div><p style="font-size:20px;font-weight:700;margin:0 0 6px">No connection</p><p style="margin:0 0 16px;color:#c9d5e6">The hub needs the internet.</p>'
      + '<button onclick="location.reload()" style="font:inherit;font-weight:700;background:#d6400c;color:#fff;border:0;border-radius:10px;padding:10px 16px">Try again</button></div>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});
