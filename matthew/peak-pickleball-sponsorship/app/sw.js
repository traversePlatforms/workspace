/* The desk as an app on a computer or phone (2026-10-22, Matthew: no way to put it on his laptop's desktop). This worker only lets the
   browser install the page as an app. It keeps nothing: leads and notes always come from the server. With no connection, the window
   says so instead of the browser's error page.
   Alerts (2026-11-20): a push from the desk's own server (api/desk-inbox.php) shows a notification ("Acme Corp replied", "New email in
   the Inbox"; never the email's words). Every push shows one (Safari drops a subscription after silent ones). A tap opens the desk at the
   card or the Inbox email it is about, in the window already open if there is one. An iPhone takes them only from the desk added to the
   Home Screen (iOS 16.4 or later). */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Peak Sponsor Desk</title>'
      + '<body style="margin:0;font:16px system-ui,sans-serif;background:#0f0f0e;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px">'
      + '<div><p style="font-size:20px;font-weight:700;margin:0 0 6px">No connection</p><p style="margin:0 0 16px;color:#b9b9b3">The desk needs the internet.</p>'
      + '<button onclick="location.reload()" style="font:inherit;font-weight:700;background:#17a9cd;color:#0b0b0a;border:0;border-radius:10px;padding:10px 16px">Try again</button></div>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});
self.addEventListener('push', function (e) {
  var d = { title: 'Peak desk', body: 'Something new on the desk. Tap to open.', url: './#inbox', tag: 'peakdesk' };
  if (e.data) { try { d = Object.assign(d, e.data.json()); } catch (x) { d.body = e.data.text(); } }
  var shown = self.registration.showNotification(d.title, { body: d.body, tag: String(d.tag || 'peakdesk'), renotify: true, icon: 'icon-192.png', badge: 'icon-192.png',
    timestamp: d.at ? d.at * 1000 : Date.now(), data: { url: d.url } });
  if (self.navigator && typeof self.navigator.setAppBadge === 'function') shown = shown.then(function () { return self.navigator.setAppBadge(1); }).catch(function () {});
  e.waitUntil(shown);
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var rel = (e.notification.data && e.notification.data.url) || './';
  var url = new URL(rel, self.registration.scope).href;
  if (url.indexOf(self.registration.scope) !== 0) url = self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (wins) {
    for (var i = 0; i < wins.length; i++) {
      var w = wins[i];
      if (w.url.indexOf(self.registration.scope) === 0 && 'focus' in w) { try { w.postMessage({ type: 'push-open', url: url }); } catch (x) {} return w.focus(); }
    }
    return self.clients.openWindow(url);
  }).then(function () { if (self.navigator && typeof self.navigator.clearAppBadge === 'function') return self.navigator.clearAppBadge().catch(function () {}); }));
});
self.addEventListener('pushsubscriptionchange', function (e) {
  var old = e.oldSubscription, key = (e.newSubscription && e.newSubscription.options && e.newSubscription.options.applicationServerKey) || (old && old.options && old.options.applicationServerKey);
  if (!key) return;
  e.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).then(function (sub) {
    var post = function (a, b) { return fetch('api/desk.php?action=' + a, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Desk': '1' }, body: JSON.stringify(b) }); };
    return (old ? post('pushunsub', { endpoint: old.endpoint }) : Promise.resolve()).then(function () { return post('pushsub', { subscription: sub.toJSON(), device: 'renewed', phone: /iPhone|iPad|Android|Mobile/.test(self.navigator.userAgent) }); });
  }).catch(function () {}));
});
