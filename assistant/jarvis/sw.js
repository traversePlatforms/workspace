/* J.A.R.V.I.S. as its own app (2026-11-19, P-9: "make jarvis a stand alone off the hub"; Matthew: "Jarvis for me needs to be in stand alone
   thing entirely"). Its scope is /a-e018bb82/jarvis/ only, so it is a separate app from the classic Assistant page above it.
   - Install: Chrome and Edge install it as its own window; an iPhone adds it to the Home Screen (Safari, Share, Add to Home Screen).
   - Phone alerts: Web Push from the Assistant's own server (lib/jarvis.php jvPush): desk replies, reminders, builder alerts. Every push
     shows a notification (Safari drops a subscription after silent ones); a tap opens J.A.R.V.I.S. at the thread or panel it is about.
   - It keeps nothing: email, chats and answers are never stored on the device. With no connection, it says so.
   Bump V when this file changes (the page registers it with updateViaCache 'none'). */
const V = 'jarvis-sw-2026-11-19a';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>J.A.R.V.I.S.</title>'
      + '<body style="margin:0;font:16px system-ui,sans-serif;background:#03060c;color:#d8f6ff;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px">'
      + '<div><p style="font-size:20px;font-weight:700;margin:0 0 6px;letter-spacing:.2em">J.A.R.V.I.S.</p><p style="margin:0 0 16px;color:#7fa3b4">No connection. It needs the internet.</p>'
      + '<button onclick="location.reload()" style="font:inherit;font-weight:700;background:#3ee8ff;color:#022231;border:0;border-radius:10px;padding:10px 16px">Try again</button></div>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});
self.addEventListener('push', function (e) {
  var d = { title: 'J.A.R.V.I.S.', body: 'Something new. Tap to open.', url: './', tag: 'jarvis' };
  if (e.data) { try { d = Object.assign(d, e.data.json()); } catch (x) { d.body = e.data.text(); } }
  var shown = self.registration.showNotification(d.title, { body: d.body, tag: String(d.tag || 'jarvis'), renotify: true, icon: 'icon-192.png', badge: 'badge-96.png',
    timestamp: d.at ? d.at * 1000 : Date.now(), data: { url: d.url } });
  if (self.navigator && typeof self.navigator.setAppBadge === 'function') shown = shown.then(function () { return self.navigator.setAppBadge(1); }).catch(function () {});
  e.waitUntil(shown);
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var rel = (e.notification.data && e.notification.data.url) || './';
  var url = new URL(rel, self.location.origin).href;
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
    var post = function (a, b) { return fetch('../api.php?action=' + a, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); };
    return (old ? post('jvpushunsub', { endpoint: old.endpoint }) : Promise.resolve()).then(function () { return post('jvpushsub', { subscription: sub.toJSON(), device: 'renewed', phone: /iPhone|iPad|Android|Mobile/.test(self.navigator.userAgent) }); });
  }).catch(function () {}));
});
