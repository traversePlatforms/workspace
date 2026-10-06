# Integration plan: NWS warnings as push notifications

Draft, 2026-10-05. Nothing here is built into the app yet. It follows the app's existing shapes: one API file
(`site/api/rounds.php`), private files above `public_html`, cron scripts in `sixfold-tools/` that call the API from the
command line the way `morning-email.php` does.

## What it does, end to end

```
 phone (installed app)            server (SiteGround)                        outside
 ─────────────────────            ──────────────────────────────────         ───────────────────────
 Tools > Alerts: on ──tap──►  pushsubscribe: stores {endpoint, keys}
                               in sixfold-private/push-subscriptions.json
                               under the signed-in person

                               every 5 min: sixfold-tools/push-alerts.php
                                 ├─ api.weather.gov active alerts at the  ◄── NWS
                                 │  11 town centres (freshAlerts(), already in rounds.php)
                                 ├─ new warning id not in push-sent.json?
                                 ├─ who: opted-in people (phase 2: assigned to those towns)
                                 └─ webpushSend() per device ──────────────► Google FCM / Apple / Mozilla
 service worker: push ◄──────────────────────────────────────────────────────┘
   shows "Severe Thunderstorm Warning / Monument until 4:45 PM, hail to 1.5 in"
   tap ─► opens the app at the alerts screen / storm call list
```

## 1. API actions in `rounds.php` (all need a session, like everything past the `me` action)

| Action | Method, body | Who | Does |
|---|---|---|---|
| `pushkey` | GET | any signed-in | `{ok, publicKey}`: the VAPID public key, read from the private key file. Not secret, but there is no reason to serve it unsigned-in. |
| `pushsubscribe` | POST `{subscription: {endpoint, keys:{p256dh, auth}, expirationTime?}, device: "iPad app"}` | any signed-in | `webpushSubscriptionError()` first (400 with the reason if bad). Stores it under the signed-in person's id (`$session['c']`, the same code id `rounds-accounts.json` uses) keyed by `substr(sha256(endpoint), 0, 16)`. If that endpoint was filed under another person (shared iPad, new sign-in) it moves. Max **4 devices per person**: the oldest `seen` is dropped when a fifth arrives. `{ok, devices: n}`. |
| `pushunsubscribe` | POST `{endpoint}` | any signed-in | Removes that endpoint from whoever holds it. Called by the page on "Alerts: off" and on sign-out (server-side forget only: the browser subscription stays and is re-posted on the next sign-in). |
| `pushlatest` | GET | any signed-in | `{ok, alert: {title, body, url, tag, id}}` for the most recent warning pushed in the last 3 hours, or a generic "Open the app" line. Only used by the worker when a push arrives with no payload. |
| `pushtest` | POST | admin | Sends a test push to the caller's own devices. The "Send me a test" button under the switch, and the way to check a phone without waiting for weather. |
| `pushdevices` | GET | admin | Per person: device names, when seen, nothing else. For the Accounts screen. **Never returns endpoints or keys** (the same rule as the live checks never calling `accountpins`). |
| `pushcron` | CLI only (`SIXFOLD_CLI`, like `digest`) | cron | Everything in §3. Added to the CLI-allowed action list at the session check. |

`require_once __DIR__ . '/webpush.php';` beside the `skiptrace.php` require. `webpush.php` goes in `public_html/api/`
with `rounds.php` (it holds no secret; a direct request to it runs nothing and prints nothing).

## 2. Where things live (none of it in git, none of it under `public_html`)

| File | Holds | Notes |
|---|---|---|
| `sixfold-private/push-vapid.json` | `{publicKey, privateKey (PEM), subject: "mailto:<company email>", made}` | **The private key.** Made once by `php sixfold-tools/push-keys.php` (a 15-line script around `vapidKeysGenerate()`), which refuses to overwrite an existing file: a new pair would silently orphan every phone. `chmod 0600`. In the repo only `site/api/push-vapid.example.json` with placeholders, the `rounds-codes.example.php` convention. Back it up with the other private files, by hand (the nightly backup deliberately skips `sixfold-private`). |
| `sixfold-private/push-subscriptions.json` | `{ "<personId>": { "<endpointHash>": { "sub": {endpoint, keys}, "device": "iPad app", "at": <made>, "seen": <last posted>, "towns": null } } }` | Endpoints are capability URLs (with our VAPID key bound, a leaked one cannot be pushed to by anyone else, but it still identifies a phone): private folder, same read/write-with-temp-file-and-rename pattern as `saveAccounts()`. `towns: null` = all towns (phase 1); a list = only those (phase 2). |
| `sixfold-data/rounds/push-sent.json` | `{ "<nws alert id>": { "at", "event", "towns": [...], "to": n, "ok": n, "gone": n } }` | Which alert ids were already pushed. Pruned after 7 days. Not secret: a log, like `storms-recent.json` beside it. |
| `sixfold-data/rounds/push.log` | one JSON line per cron run and per failed send | Debug trail, like `rounds-accounts.log`. |
| `sixfold-tools/push-alerts.php` | the cron script | CLI only, `America/Denver`, `require`s `public_html/api/rounds.php` with `action=pushcron` under `SIXFOLD_CLI`, exactly as `morning-email.php` does for `digest`. |
| `sixfold-tools/push-keys.php` | one-off key maker | Prints the public key, writes the private file, refuses to run twice. |

Cron line (SiteGround's cron takes a plain crontab expression; the server clock is UTC, which does not matter for a
5-minute interval): `*/5 * * * * php /home/<user>/sixfold-tools/push-alerts.php >/dev/null 2>&1`

## 3. The cron run (`pushcron`), every 5 minutes

1. **Lock**: `flock` on `push-sent.json.lock`, non-blocking; a run that finds the lock held exits (the feed is slow some mornings).
2. **Alerts**: `freshAlerts()` already fetches `api.weather.gov/alerts/active?point=lat,lon` for all 11 town centres (`ALERT_TOWNS`) and keeps `alerts-cache.json`. Its 10-minute cache is too slow for a 5-minute cron: `pushcron` passes a flag that lowers it to 4 minutes for its own call, so each run sees at most one feed refresh. The NWS asks for a `User-Agent` with contact details; `agentHeader()` already sends one.
3. **Which events push** (first cut; Matthew decides): `Severe Thunderstorm Warning`, `Tornado Warning`, `Flash Flood Warning` (storms: where `features.hail` is on, admins, mirroring `hailOn()`), `Red Flag Warning`, `Fire Warning`, and `Fire Weather Watch` (fire work, everyone opted in). **Warnings, not watches, for storms**: a watch covers half the state for six hours and would train people to ignore the buzz. The existing `ALERT_EVENTS` list stays what the alerts screen shows; the push list is a subset.
4. **New?** An NWS alert id is pushed once. Updates and continuations get new ids and carry `references` to the old one; phase 1 pushes each new id anyway (a bigger hail size is worth a second buzz), relying on the `Topic` header to collapse unread ones. If that proves noisy: skip an id whose `references` point at one pushed in the last hour unless `maxHailSize` grew.
5. **Who**: every subscription in `push-subscriptions.json` whose person still exists in the merged accounts list (`loadAccounts()` + the codes file: a removed person's phones are dropped here too) and, for storm events, whose role is admin while `features.hail` is on. Phase 2: intersect the alert's `towns` with the device's `towns` list, set from the Territories screen (crew to towns) with "all towns" the default for admins.
6. **Payload** (JSON, ~200 bytes, encrypted by `webpushSend`): `{title: event, body: "<Towns joined> · until <local time> · hail to 1.5 in · gusts 60 mph", url: "./#alerts" (or the Hail screen for storms with hail on), tag: <alert id>, id: <alert id>, at: <sent unix time>}`. The local time comes from the alert's `ends`/`expires` in `America/Denver`.
7. **Send**: `webpushSend($sub, $payload, $vapid, $ttl, ['urgency' => 'high', 'topic' => substr(sha1($id), 0, 32)])` with `$ttl` = seconds until the warning ends, clamped to 60 … 6 h. One JWT per push service per run (the library caches it). `gone` ⇒ delete that subscription and write a log line; `429` ⇒ stop this run, the next one retries (`push-sent.json` is only written for ids that got at least one accepted send); any other error ⇒ log and carry on.
8. **Record** the id in `push-sent.json` with counts; prune entries older than 7 days; release the lock. Total run time with 11 feed calls and 20 phones: a few seconds.

Dry runs: `php push-alerts.php --dry-run` prints who would get what and sends nothing; `--test "<text>"` pushes a line
to the caller's own devices through the real path (the same as the `pushtest` action).

## 4. The page and the worker

- `index.html`: the functions from `client-snippet.js`; `pushPrepare()` at load; on the Tools screen a row **Alerts on this device** with on / off / blocked / "install first" states and the instruction text from `pushInstructions()`; `pushResend()` after every successful sign-in; `pushunsubscribe` on sign-out; the `push-open` message handler so a tapped notification lands on the right screen when the app is already open. The `beforeinstallprompt` and `standalone()` code already there is what `pushSupport()` builds on.
- `sw.js`: the three handlers from `sw-push-snippet.js`; bump `SHELL_V`. The existing fetch handler's `KEEP` list does not match `pushlatest`, so that request is never served from the offline copy.
- Nothing in `company.json`: the VAPID public key is served by `pushkey`, not written into the public settings, so a second install (a roofer) has its own key file and nothing to edit in the page.

## 5. Rollout and checks

1. Upload `webpush.php` and the new `rounds.php` to `public_html/api/`; `push-keys.php` and `push-alerts.php` to `sixfold-tools/`; run `push-keys.php` once over SSH; add the cron line. No page change yet: `pushkey` answering is the check.
2. Upload `sw.js` and `index.html`; flush SiteGround's cache; check `/summit-de59ae83/` plain **and** cache-busted (the folder URL the phones open, the trap from the deploy notes).
3. Matthew's iPad, installed: Alerts on, "Send me a test", notification arrives, tap opens the alerts screen. Then one Android phone. Then a Safari tab on the iPad to see the "install first" text instead of a broken switch.
4. `push-alerts.php --dry-run` on the server during the next Red Flag or thunderstorm day; then let the cron send.
5. The live checks list gets a `pushkey` check (answers, 87-character key) and a `pushdevices` check as admin (no endpoint in the answer). **Never a check that reads `push-subscriptions.json` or `push-vapid.json`.**

## 6. Open decisions (Matthew's)

- Which events push, and whether storm pushes stay admin-only (hail on) or go to everyone assigned to the town.
- Quiet hours: none proposed (a 3 am hail warning is the morning's call list), but a 10 pm–6 am hold is one line if wanted.
- Phase 2 (per-town assignment) waits for the Territories screen to carry a crew-to-town mapping; until then every opted-in phone gets every pushed alert for all 11 towns.
- Whether to push anything that is not weather (a new website lead, a morning digest). Possible with the same pieces; not proposed, each one is another interruption the crew did not ask for.
