/* e2e/sw.js: the push handler from sw-push-snippet.js, plus one line that tells e2e.php the push arrived, so the
   headless run can prove delivery without anyone looking at a notification. */
const PUSH_LATEST = 'e2e.php?action=state';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  const fallback = { title: 'Weather alert', body: 'Open the app for the latest warning.', url: './#alerts', tag: 'alert' };
  let data = null, raw = null;
  if (event.data) { raw = event.data.text(); try { data = event.data.json(); } catch (e) { data = { title: fallback.title, body: raw }; } }
  const d = Object.assign({}, fallback, data || {});
  const report = fetch('e2e.php?action=received', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hadPayload: !!event.data, raw: raw, parsed: data, shown: d.title + ' / ' + d.body }) }).catch(() => {});
  const show = self.registration.showNotification(d.title, { body: d.body, tag: String(d.tag || 'alert'), renotify: true, data: { url: d.url, id: d.id } });
  event.waitUntil(Promise.all([report, show]).then(() => self.clients.matchAll({ type: 'window' })).then((ws) => ws.forEach((w) => w.postMessage({ pushShown: d.title }))));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    for (const w of wins) if (w.url.indexOf(self.registration.scope) === 0 && 'focus' in w) return w.focus();
    return self.clients.openWindow(url);
  }));
});
