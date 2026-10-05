# Phone push notifications for the door app (a Home Screen web app, not a native app)

Research prototype, 2026-10-05. Everything in this folder is a draft: nothing is wired into the app, nothing is on the server.

**Verdict in one paragraph.** Web Push works for this app on every phone the crew uses, with no native app, no app store, no paid service and no library to install: an iPhone or iPad on iOS 16.4 or later once the app is on the Home Screen, any Android phone in Chrome, and desktop browsers. The server side runs on SiteGround's plain PHP: `webpush.php` in this folder does VAPID (RFC 8292) and the encrypted payload (RFC 8291) with only `ext/openssl`, `ext/hash` and curl, and it has been proven three ways: it reproduces the RFC's own test vector byte for byte, Node's WebCrypto (what a browser runs) decrypts its output, and a real push went from PHP through Google's push service into headless Chrome's service worker and back out as a notification (see [TEST-NOTES.md](TEST-NOTES.md)). The one real constraint is Apple's: on an iPhone, push only exists for a web app that was added to the Home Screen and opened from its icon, and the permission prompt only appears in answer to a tap.

## 1. What works where

| Where | Push? | Conditions | Source |
|---|---|---|---|
| iPhone / iPad, iOS and iPadOS **16.4+** | Yes | Only for a web app **added to the Home Screen**, with a manifest whose `display` is `standalone` or `fullscreen` (ours is `standalone`). Permission must be requested from a tap. Not in a Safari tab. | Apple, WebKit blog "Web Push for Web Apps on iOS and iPadOS", Brady Eidson and Jen Simmons, 16 Feb 2023: "A web app that has been added to the Home Screen can request permission to receive push notifications" and permission requests must come "in response to direct user interaction — such as tapping on a 'subscribe' button provided by the web app". MDN's compatibility data for `PushManager.subscribe`: Safari iOS `16.4`, "Notifications are supported in web apps saved to the home screen". |
| iPhone / iPad before 16.4 | No | — | Same. |
| Android, Chrome | Yes | Works from a tab or installed. Permission from a tap (Chrome blocks prompts outside a gesture). | MDN compatibility data: Chrome 42, Chrome Android mirrors Chrome. Baseline "widely available since March 2023" (MDN Push API page). |
| Android, Firefox / Samsung Internet | Yes | — | MDN: Firefox Android 48; Samsung Internet mirrors Chrome. |
| Desktop Chrome, Edge, Firefox | Yes | — | MDN: Chrome 42, Edge 17, Firefox 44. |
| Desktop Safari, macOS Ventura+ | Yes | Safari 16, same standard | WebKit blog "Meet Web Push", 7 Jun 2022; MDN: Safari 16, "Notifications are supported on macOS Ventura and later". |

The standards, so nothing here depends on one vendor:
- **RFC 8030** "Generic Event Delivery Using HTTP Push": the subscription (an endpoint URL the browser gives), the POST to it, the `TTL` header (required: a service returns 400 without it), `Urgency`, `Topic`, and 404/410 for a subscription that no longer exists. §7.2: a push service need only accept bodies of 4096 bytes or less.
- **RFC 8291** "Message Encryption for Web Push": the payload is encrypted to the phone's own key (ECDH on P-256 with the subscription's `p256dh` key and its 16-byte `auth` secret, HKDF-SHA-256, then RFC 8188 `aes128gcm`). The push service (Google, Apple, Mozilla) carries bytes it cannot read.
- **RFC 8292** "Voluntary Application Server Identification (VAPID)": the server proves who it is with an ES256-signed JWT (`Authorization: vapid t=<jwt>, k=<public key>`), `exp` at most 24 hours out. The same public key is given to the browser at subscribe time (`applicationServerKey`), which binds the subscription to our key: nobody who merely learns an endpoint URL can push to that phone.

## 2. What a crew member must do on an iPhone

1. Open the app's address in **Safari** (not Chrome for iOS: on iOS every browser is Safari underneath, but only Safari can add to the Home Screen with a working service worker).
2. Tap **Share**, then **Add to Home Screen**, then **Add**. (The app already shows these steps on the sign-in and tools screens when it is not installed.)
3. **Open the app from its icon.** In a Safari tab the alerts switch will explain this instead of working: the page detects "iPhone, not installed" (`client-snippet.js`, `pushSupport()`).
4. Sign in, go to Tools, tap **Alerts: on**. iOS shows its own "would like to send you notifications" prompt; tap **Allow**.
5. If they tapped Don't Allow: Settings > Notifications > the app > Allow Notifications, then tap the switch again.

Android Chrome: steps 4 and 5 only (installing is optional there; the install banner the app already offers is enough).

A shared iPad: the subscription belongs to the device; the server records it against whoever is signed in and moves it on each sign-in (`pushResend()`), and forgets it on sign-out. The next person who signs in gets the alerts; between sign-out and sign-in the iPad gets none.

## 3. Limits that shape the design

- **Every push must show a notification.** The subscription is made with `userVisibleOnly: true` and Safari holds you to it: "fulfill that promise by always showing a notification in response to a push message. Violations of the `userVisibleOnly` promise will result in a push subscription being revoked" (WebKit, "Meet Web Push"). Apple's WWDC22 session 10098 gives the count for the macOS Ventura beta: "after three push events where you fail to post a notification in a timely manner, your site's push subscription will be revoked". Chrome shows a generic "This site has been updated in the background" when a push shows nothing. So: **no silent pushes, no "sync the data" pushes**; the worker shows something on every push, including the fallback when the payload is missing or unreadable (`sw-push-snippet.js`).
- **No background JavaScript beyond the push event.** "While the standard for the JavaScript Push API optionally accommodates silent JavaScript runtime in response to a push, most browsers do not support that. Safari does not support that" (WWDC22 10098). The worker gets a few seconds inside `event.waitUntil`: enough to fetch the latest alert from the server for a payload-less push, which is the fallback path and was tested.
- **Subscriptions die without telling us.** Removing the icon from the Home Screen, clearing Safari's website data, the person tapping "turn off" in iOS Settings, Chrome evicting a long-unused subscription, or a changed VAPID key all end it. Some of those fire `pushsubscriptionchange` in the worker (handled, but Chrome rarely fires it in practice); none of them tell the server. The push service answers **404 or 410** the next time we send, and `webpushSend()` reports that as `gone` so the cron script deletes the record. Belt and braces: the page re-posts its current subscription on every open and sign-in (`pushResend()`), so a phone that lost its subscription and made a new one is re-registered without anyone noticing.
- **Permission is per browser profile and per origin**, and once denied the site cannot ask again; only the phone's settings can undo it. The switch shows "blocked" with the path to fix it rather than a prompt that will never appear.
- **A new VAPID key pair invalidates every subscription** (they were bound to the old public key). Generate it once, keep it, back it up with the other private files. If it is ever replaced, every phone must re-subscribe: the client code handles the `InvalidStateError` that Chrome throws for a key mismatch by unsubscribing and trying again, but that only happens when someone opens the app.
- **Payload size**: at most 4096 bytes on the wire (RFC 8030 §7.2), of which 86 bytes are the encryption header and 17 the delimiter and tag, so **3,993 bytes of plaintext**; the library refuses more. An alert payload here is about 200 bytes.
- **What the notification can show on iOS**: title, body, and the app's own icon. The `icon` and `badge` options and `requireInteraction` are Android/desktop. iOS 16.4+ does support the **Badging API** (`navigator.setAppBadge` in the worker), so the app icon can carry a count; the snippet sets it on each push and clears it on tap.
- **Delivery is best effort, with a time limit.** `TTL` says how long the push service keeps the message for a phone that is off or out of signal: for a storm warning, until the warning ends (a warning delivered after it expired is noise). `Topic` makes a newer push replace an unread older one with the same topic, so a phone that was off during three updates of one warning sees one notification, not three. `Urgency: high` asks the phone to wake for it.
- **Not a safety system.** The NWS's own Wireless Emergency Alerts reach every phone in the polygon with no app at all; this push is a work tool ("hail just hit Monument, here is the call list"), five minutes behind the NWS feed at worst (the cron interval), and only on phones that opted in. The app should say so once, where the switch is.
- **Notifications and Focus modes.** iOS Focus / Do Not Disturb and Android's equivalents suppress or delay notifications by the phone's own rules; nothing in the design changes that, and a push at 3 am for a night storm will be read in the morning, which for the hail call list is fine.

## 4. Encrypted payloads in pure PHP: yes, proven

`webpush.php` implements RFC 8291 in full, with no fallback needed:
- ECDH on P-256: `openssl_pkey_derive()` (PHP 7.3+). The phone's `p256dh` key, a raw 65-byte point, is wrapped in a fixed 26-byte DER prefix to make a PEM OpenSSL accepts; our ephemeral key comes from `openssl_pkey_new()`.
- HKDF-SHA-256: `hash_hkdf()` (PHP 7.1.2+), three derivations (IKM with the auth secret, then CEK and nonce with the salt).
- AES-128-GCM: `openssl_encrypt()` with the 16-byte tag appended, one record, delimiter `0x02`, optional zero padding to a 32-byte multiple so lengths say less.
- VAPID: `openssl_sign()` with SHA-256 gives a DER ECDSA signature; `wpEcdsaDerToRaw()` converts it to the 64-byte `r||s` form JWS wants.

Proof, in [test-webpush.php](test-webpush.php) and [verify-with-node.mjs](verify-with-node.mjs), results in [TEST-NOTES.md](TEST-NOTES.md): with the RFC's keys, salt and auth secret, our output equals RFC 8291's example body byte for byte, and every intermediate value in its Appendix A matches; OpenSSL and, separately, Node's `crypto.verify` accept the JWT; Node's WebCrypto decrypts a PHP-encrypted body; and in the live test headless Chrome decrypted a real push from PHP via FCM with the payload byte-identical.

The payload-less path is still implemented and tested (the worker fetches the latest alert and shows it), because it is the right fallback if a host ever lacks `openssl_pkey_derive` (PHP < 7.3) and because a push whose payload fails to decrypt must still show something.

One trap found on the way, for anyone running this on Windows: PHP's Windows build has no `openssl.cnf`, and `openssl_pkey_new()` fails with "error:80000003:system library::No such process". The library retries with an empty config file in the temp folder; SiteGround's Linux PHP never hits this.

## 5. The pieces

| File | What |
|---|---|
| [webpush.php](webpush.php) | The library: `vapidKeysGenerate()`, `webpushSend()`, `webpushSubscriptionError()`, plus `webpushEncrypt()` / `webpushDecrypt()` and the key helpers. Prefixed `wp`/`vapid`/`webpush` so it can sit beside `rounds.php`. |
| [sw-push-snippet.js](sw-push-snippet.js) | For `sw.js`: `push` (show it, or fetch the latest alert and show that), `notificationclick` (focus the open app or open it at the alert), `pushsubscriptionchange`. |
| [client-snippet.js](client-snippet.js) | For `index.html`: `pushSupport()` (including "iPhone but not installed"), `pushPrepare()`, `pushStatus()`, `pushEnable()` from a tap, `pushDisable()`, `pushResend()` after sign-in, the instruction texts. |
| [test-webpush.php](test-webpush.php) | 42 checks, no network, keys made at run time. |
| [verify-with-node.mjs](verify-with-node.mjs) | The same JWT and body checked by Node / WebCrypto. |
| [e2e-run.mjs](e2e-run.mjs) + [e2e/](e2e/) | Headless Chrome subscribes on a `php -S` page, PHP pushes through Google's push service, the worker reports receipt. |
| [INTEGRATION-PLAN.md](INTEGRATION-PLAN.md) | How it goes into the app: API actions, where subscriptions and the key live, the 5-minute cron. |
| [TEST-NOTES.md](TEST-NOTES.md) | What was run, what came back, how to run it again. |

## Sources

- Apple / WebKit: [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) (16 Feb 2023); [Meet Web Push](https://webkit.org/blog/12945/meet-web-push/) (7 Jun 2022); WWDC22 session 10098 [Meet Web Push for Safari](https://developer.apple.com/videos/play/wwdc2022/10098/) (transcript: the three-silent-pushes rule, no silent runtime).
- MDN: [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API); version numbers from MDN's browser-compat-data `api/PushManager.json` (read 2026-10-05).
- IETF: [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030) (push protocol, TTL, Urgency, Topic, 404/410, 4096 bytes), [RFC 8291](https://www.rfc-editor.org/rfc/rfc8291) (encryption; §5 and Appendix A are the test vector used), [RFC 8292](https://www.rfc-editor.org/rfc/rfc8292) (VAPID), [RFC 8188](https://www.rfc-editor.org/rfc/rfc8188) (aes128gcm content coding).
- Measured here, 2026-10-05: PHP 8.4.24 / OpenSSL 3.0.21, Node 24.19, Chrome 154.0.8037.97 headless.
