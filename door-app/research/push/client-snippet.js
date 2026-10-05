/* client-snippet.js: the page half of push. Plain script, no build step, same style as index.html.

   What it gives the page:
     pushSupport()                  -> {ok, reason, ios, installed}  why push can or cannot be turned on HERE
     pushStatus()                   -> Promise<'on'|'off'|'blocked'|'unavailable'>  for the switch on the tools screen
     pushEnable()                   -> Promise<'on'|'blocked'|'failed'|...>  CALL FROM A TAP HANDLER, nothing else works
     pushDisable()                  -> Promise<void>
     pushResend()                   -> re-POST the current subscription (call after every sign-in: iPads are shared,
                                       and the server keys subscriptions by the signed-in person)
   The server side it talks to (see INTEGRATION-PLAN.md):
     GET  ../api/rounds.php?action=pushkey          -> {ok, publicKey}            the VAPID public key (not secret)
     POST ../api/rounds.php?action=pushsubscribe    {subscription, device}        store for the signed-in user
     POST ../api/rounds.php?action=pushunsubscribe  {endpoint}                    forget it

   The one rule that bites: on Safari/iOS the permission prompt must come from a user gesture, and the gesture is
   spent by the first await that goes to the network. So the VAPID key is fetched EARLY (pushPrepare() on page load)
   and pushEnable() calls Notification.requestPermission() first thing, before any fetch. */

var PUSH_API = '../api/rounds.php';
var pushKey = null;                       /* VAPID public key, base64url, fetched by pushPrepare() */

/* base64url -> Uint8Array, the shape pushManager.subscribe wants for applicationServerKey */
function pushKeyBytes(b64u) {
  var s = (b64u + '==='.slice((b64u.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  var raw = atob(s), out = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/* Where are we? iPadOS 13+ Safari reports itself as a Mac, hence the maxTouchPoints test. */
function pushSupport() {
  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var installed = !!((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true);
  var hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (hasApi && window.isSecureContext) return { ok: true, ios: ios, installed: installed };
  if (ios && !installed) return { ok: false, reason: 'ios-not-installed', ios: true, installed: false };
  /* iOS Safari (a tab, not the installed app) has no PushManager at all; iOS before 16.4 has none even when installed */
  if (ios && installed) return { ok: false, reason: 'ios-too-old', ios: true, installed: true };
  if (!window.isSecureContext) return { ok: false, reason: 'not-https', ios: ios, installed: installed };
  return { ok: false, reason: 'unsupported', ios: ios, installed: installed };
}

/* What to show the person for each reason. The iOS steps are the ones Apple's post describes: Share -> Add to Home
   Screen -> open from the icon -> then the switch works. */
function pushInstructions(reason) {
  switch (reason) {
    case 'ios-not-installed': return 'On an iPhone or iPad, alerts only work from the installed app. In Safari tap Share, then "Add to Home Screen", open the app from its icon, then turn alerts on here.';
    case 'ios-too-old': return 'Alerts need iOS 16.4 or later. Update the phone in Settings, then try again.';
    case 'blocked': return 'Notifications are blocked for this app. iPhone: Settings > Notifications > the app. Android: hold the app icon > App info > Notifications.';
    case 'not-https': return 'Alerts only work on the https address.';
    default: return 'This browser cannot receive alerts. Chrome on Android, or the installed app on iPhone, can.';
  }
}

/* Fetch the public key once, early (page load or sign-in), so pushEnable() has nothing to wait for. */
function pushPrepare() {
  if (pushKey) return Promise.resolve(pushKey);
  return fetch(PUSH_API + '?action=pushkey', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (j) { if (j && j.ok && j.publicKey) pushKey = j.publicKey; return pushKey; })
    .catch(function () { return null; });
}

function pushStatus() {
  var s = pushSupport();
  if (!s.ok) return Promise.resolve('unavailable');
  if (Notification.permission === 'denied') return Promise.resolve('blocked');
  return navigator.serviceWorker.ready
    .then(function (reg) { return reg.pushManager.getSubscription(); })
    .then(function (sub) { return sub ? 'on' : 'off'; })
    .catch(function () { return 'off'; });
}

function pushPost(action, body) {
  return fetch(PUSH_API + '?action=' + action, {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(function (r) { return r.json(); });
}

/* A short device name for the Accounts screen ("Matthew's iPad"), nothing identifying beyond that */
function pushDeviceName() {
  var ua = navigator.userAgent, s = pushSupport();
  var kind = s.ios ? (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : 'iPhone')
           : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'device';
  return kind + (s.installed ? ' app' : ' browser');
}

/* Turn alerts on. Must run inside the tap handler of a button: do not put anything async in front of it. */
function pushEnable() {
  var s = pushSupport();
  if (!s.ok) return Promise.resolve(s.reason);
  if (!pushKey) return Promise.resolve('no-key');             /* pushPrepare() has not run or the server has no key yet */
  return Notification.requestPermission().then(function (perm) {
    if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'dismissed';
    return navigator.serviceWorker.ready
      .then(function (reg) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKeyBytes(pushKey) }); })
      .then(function (sub) { return pushPost('pushsubscribe', { subscription: sub.toJSON(), device: pushDeviceName() }); })
      .then(function (j) { return j && j.ok ? 'on' : 'failed'; })
      .catch(function (e) {
        /* an old subscription made with a DIFFERENT VAPID key throws InvalidStateError: drop it and try once more */
        if (e && e.name === 'InvalidStateError') return pushDisable().then(function () { return 'retry'; });
        return 'failed';
      });
  });
}

function pushDisable() {
  return navigator.serviceWorker.ready
    .then(function (reg) { return reg.pushManager.getSubscription(); })
    .then(function (sub) {
      if (!sub) return;
      var endpoint = sub.endpoint;
      return sub.unsubscribe().then(function () { return pushPost('pushunsubscribe', { endpoint: endpoint }); }).catch(function () {});
    });
}

/* After every sign-in: the subscription on this device now belongs to whoever just signed in. */
function pushResend() {
  if (!pushSupport().ok) return Promise.resolve();
  return navigator.serviceWorker.ready
    .then(function (reg) { return reg.pushManager.getSubscription(); })
    .then(function (sub) { if (sub) return pushPost('pushsubscribe', { subscription: sub.toJSON(), device: pushDeviceName() }); })
    .catch(function () {});
}

/* The worker sends {type:'push-open', url} when a notification is tapped while the app is already open */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'push-open' && e.data.url) {
      var u = String(e.data.url);
      if (u.indexOf('#') === 0 || u.indexOf('./#') === 0) location.hash = u.slice(u.indexOf('#'));   /* in-app screen */
      else location.href = u;
    }
  });
}

/* How the tools screen would use it:
     pushPrepare();
     pushStatus().then(function (st) { ... draw the switch: on / off / blocked / unavailable ... });
     button.onclick = function () {
       pushEnable().then(function (r) {
         if (r === 'on') say('Alerts on for this device');
         else if (r === 'retry') return pushEnable();
         else say(pushInstructions(r));
       });
     };
   and on sign-in: pushResend(); */
