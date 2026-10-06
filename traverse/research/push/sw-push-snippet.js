/* sw-push-snippet.js: the service-worker half of push. Paste into sw.js (the app's worker at summit-de59ae83/sw.js,
   so self.registration.scope is the app folder and the API is ../api/rounds.php). Bump SHELL_V when you do.

   Three handlers:
     push                    show a notification for EVERY push (Safari revokes the subscription after three pushes
                             that show nothing; Chrome shows its own "This site has been updated in the background")
     notificationclick       focus the app if it is open, else open it, at the URL carried in the notification
     pushsubscriptionchange  the browser swapped the subscription (rare; Chrome seldom fires it): re-subscribe and
                             tell the server, so the phone keeps getting alerts without anyone tapping anything

   Payload shape the server sends (JSON, encrypted on the way): {title, body, url, tag, id}
     url   relative to the app, e.g. "./#alerts" (the alerts screen) or "./?alert=<nws id>"
     tag   e.g. the NWS alert id: a second push with the same tag replaces the first instead of stacking
   With NO payload (a bare push): the worker asks the server for the latest alert (action=pushlatest, which needs
   the session cookie, sent automatically as credentials: 'same-origin') and shows that; if even that fails it shows a
   generic "Open the app" so the userVisibleOnly promise is still kept. */

const PUSH_LATEST = '../api/rounds.php?action=pushlatest';   /* only used for a push without a payload */
const PUSH_ICON = './icon-192.png';                           /* Android/desktop show it; iOS uses the installed app's icon */

self.addEventListener('push', (event) => {
  const fallback = { title: 'Weather alert', body: 'Open the app for the latest warning.', url: './#alerts', tag: 'alert' };
  let data = null;
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data = { title: fallback.title, body: event.data.text() }; }
  }
  const show = (d) => {
    d = Object.assign({}, fallback, d || {});
    const opts = {
      body: d.body, icon: PUSH_ICON, badge: PUSH_ICON, tag: String(d.tag || 'alert'), renotify: true,
      timestamp: d.at ? d.at * 1000 : Date.now(), data: { url: d.url, id: d.id }
    };
    const shown = self.registration.showNotification(d.title, opts);
    /* iOS 16.4+ and Android: a number on the app icon too (Badging API). Ignored where unsupported. */
    if (self.navigator && typeof self.navigator.setAppBadge === 'function') shown.then(() => self.navigator.setAppBadge(d.badge || 1)).catch(() => {});
    return shown;
  };
  if (data) { event.waitUntil(show(data)); return; }
  event.waitUntil(
    fetch(PUSH_LATEST, { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => show(j && j.alert ? j.alert : null))
      .catch(() => show(null))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rel = (event.notification.data && event.notification.data.url) || './';
  const url = new URL(rel, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.indexOf(self.registration.scope) === 0 && 'focus' in w) {
          /* the app is open: bring it forward and tell it where to go (the page listens for this message) */
          if ('navigate' in w && w.url !== url) { try { w.postMessage({ type: 'push-open', url: rel }); } catch (e) {} }
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }).then(() => { if (self.navigator && typeof self.navigator.clearAppBadge === 'function') return self.navigator.clearAppBadge().catch(() => {}); })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  const old = event.oldSubscription;
  const key = (event.newSubscription && event.newSubscription.options && event.newSubscription.options.applicationServerKey)
           || (old && old.options && old.options.applicationServerKey);
  if (!key) return;
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      .then((sub) => fetch('../api/rounds.php?action=pushsubscribe', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), replaces: old ? old.endpoint : null })
      }))
      .catch(() => {})
  );
});
