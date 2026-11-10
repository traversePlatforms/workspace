# Overnight review 9-10 Nov 2026: the field app and what serves it

Area: `traverse/app/` (rounds.php, the page, sw.js, q/sign pages, the other api files), `traverse/editions/`, `traverse/ops/`, the server tools
in `sixfold-tools/` and `traverse-tools/`, JARVIS, and the server's PHP error logs.

## 1. Fixed and live

**The Results screen (Office > Results) took 33 seconds on Sixfold, 4 s on Security.** Two causes, both in `action=results`:
1. It decoded every one of the 409 towns' door files to count the 6 towns that have marks. Now a town with no marks and no lead tied to it
   is skipped before its door file is read (33 s -> 25 s on the server).
2. The 45 leads that have no house tied to them were matched against the 1.1-million-line address index on every call, two passes each
   (17 s of the remaining 25, measured piece by piece on the server). The matches, hits and misses, are now kept in
   `sixfold-data/rounds/results-match.json` per lead and text, and thrown away when the search index is rebuilt (so a miss can become a hit
   once new towns or doors arrive).
The numbers are unchanged: on the harness, with booked / later / miss / no-soliciting marks and leads on and off the list, the answer is
byte-identical on git HEAD, on the new code's first call and on its second call. **Live Sixfold, signed in as Claude Check: 33.1 s
before; after the deploy 23.9 s for the one call that fills the cache, then 2.9 s and 3.1 s.** (What is left is the six towns with marks,
75,606 doors, decoded on each call; a per-town cache like the towns answer's would take that under a second, a later job.) File: `traverse/app/api/rounds.php` (results). Live on Sixfold, the five editions and the practice copy via `deploy-app.sh`
(backups `~/upload-backups/before-review1109-*.tgz` and `before-review1109b-*.tgz`) + `deploy-practice.sh`.

**The editions' "Sync from another system" pull never ran on schedule.** `traverse-tools/push-alerts.sh` (every 5 minutes) has called
`crm-sync.php --api=<edition> --pull` since 30 Oct, but the server's `traverse-tools/crm-sync.php` was still the 8 Oct copy, which does not
know `--pull`: it ran the JobNimbus push a second time instead and the sheet/CRM pull never happened. Cause: `deploy-app.sh` shipped
`push-alerts.sh`, `fb-leads.php` and `clients.php` from the built tools folder but not `crm-sync.php`. The deploy now ships the whole
built tools folder (`crm-sync.php`, `push-alerts.php`, `storm-update.php`) plus `ops/billing-mark-live.php` (the server had the 27 Oct
wording and no trial-move check) and Sixfold's `push-alerts.php` (the server ran the 5 Oct copy; same behaviour). Proof: md5 of every
server tool against the repo (a drift list), the built `crm-sync.php --pull` run against the harness (exit 0, no warnings).
Files: `traverse/ops/deploy-app.sh`. Live with this deploy.

**JARVIS went blind for two hours tonight, and will cope next time.** Since 21:28 MT SiteGround's bot captcha has been answering this
laptop's address (4.21.232.35, the hotel Wi-Fi) with a 202 HTML page for every request to traverseplatforms.com, so the 5-second poll in
`help-watch.sh` got HTML instead of a number and quietly did nothing (nothing was waiting, so no ticket was missed; checked with
`help-next.php --peek`). The watcher now notices three non-numeric answers in a row, logs it once, and reads the count over SSH
(which the captcha does not touch) every 30 seconds until HTTPS answers again. Restarted at 23:22; the log shows it switching to SSH.
File: `traverse/ops/help-watch.sh` (laptop only, no deploy). The curl calls also send a `jarvis-watch/1.0` user agent now.

**The deploy scripts' after-upload checks now run from the server.** `deploy-app.sh` and `deploy-practice.sh` fetched the version
stamps and the 401 checks with curl from this laptop; with the laptop's address behind the captcha tonight every check would have failed
after a sound upload. They now fetch all of it in one SSH call on the server (same checks, same pass rule) and both ended "all checks
passed" twice tonight. Files: `traverse/ops/deploy-app.sh`, `traverse/ops/deploy-practice.sh`.

**Repo copies brought up to date (no deploy needed).** The server's `sixfold-tools/meta-leads.php` was newer than the repo (the
31 Oct post-calendar runner hook): copied into `traverse/app/tools/meta-leads.php`. `sixfold-tools/hand-save.php` (your hand lawn
measurements) was not in git at all: now `traverse/ops/hand-save.php`.

**Stray backup copies moved out of the live web folder** into `~/upload-backups/strays-20261109/` (the .htaccess already refused them, but
the 25 Oct rule is that they never sit beside live files): `api/rounds.pre-applepay-20261101.php`, `api/help-pending.php.pre-practice-20261102`,
`summit-de59ae83/index.pre-jpart-20261101.html`, and two `prospects-47bfe6/api/desk.before-*.php`.

## 2. Fixed but not live

Nothing.

## 3. For Matthew

- **Rotate the JARVIS poll key.** While reading the server's access log for the captcha I printed lines that carry the key
  (`help-pending.php?k=...`) into my own output. It only lets a caller ask "how many chats are waiting", nothing else, but the rule is
  rotate. My attempt was refused by the permission system (it writes under `~/.ssh`). Two commands when you are at the laptop:
  `bash ~/.ssh/sg.sh trav 'php -r "echo bin2hex(random_bytes(20));" > ~/www/traverseplatforms.com/sixfold-private/help-poll.key'`
  then `bash ~/.ssh/sg.sh trav 'cat ~/www/traverseplatforms.com/sixfold-private/help-poll.key' > ~/.ssh/help-poll-key.txt`, then kill the
  running `help-watch.sh` (or wait up to 58 minutes for it to restart itself).
- **The hotel Wi-Fi address is captcha'd by SiteGround.** From this laptop, every page and API of traverseplatforms.com answers 202 with
  a captcha redirect (your phone on cellular is fine; the server's own checks are fine). It is per-address and lifts on its own, or you can open
  the site in a browser once and pass the captcha (that clears it for that browser only). Likely cause: 15,592 requests from this
  address today (the JARVIS poll is ~17,000 a day on its own) plus whatever the other agents fetched. If it keeps happening, the
  fix is to whitelist the laptop's address in Site Tools > Security, or slow the poll to 10 s; the SSH fallback covers the gap either way.
- **Every ops script still names the old laptop's paths** (`/c/Users/Surge Inc/...`, `/c/Users/SURGEI~1/.ssh/...`): deploy-app.sh,
  deploy-practice.sh, help-watch.sh, help-reply.sh. They work only because `C:\Users\Surge Inc` is a junction to `Matthew Sharpe` (made on
  5 Nov). If that junction is ever removed, JARVIS and the deploys stop. Recommendation: leave it, but know it is load-bearing.
- **Sixfold's hail-storms.json is from 5 Oct.** Hail is off for Sixfold (features.hail false), so nothing reads it; just so you know it is
  not refreshed. Roofing's refreshed at 06:19 this morning.

## 4. Checked and fine

- PHP error logs (api, root, sixfold-data), last 14 days: the only burst was 6 Nov 22:05-22:13 MT, a Claude Check live run that hit
  `aroundjobs` (500) on every install, the bug you had fixed live on 7 Nov; `aroundjobs` answers 200 on all six tonight. The 2 Nov
  `moRoot()` redeclare was the practice copy's first upload, fixed the same day. Nothing new.
- `php -l` on every API, ops and tools file: clean.
- Every one of the 551 actions in rounds.php called with GET and POST `{}` as a stranger, crew, office, admin, super and the quote
  role on a local harness: no 500s, no PHP warnings or notices, every answer valid JSON, no action ends another session. (The only
  warning was Windows' OpenSSL inside the harness, which the Linux host never hits.)
- Live, signed in as Claude Check on all six installs from the server, before and after each deploy: sign-in, 63 page-load reads, a
  write refused (403), sign-out; signed-out requests answer 401 on all six APIs. Office screens all answer under 1.3 s except Results
  (fixed above); `board` is 0.2 s (my first 6 s reading was the cold cache after the afternoon deploy; likewise the 6-9 s `regions`
  readings right after each deploy, while regions-warm.php rebuilt the towns answer in the background).
- Local build equals what is live (deploy-app.sh --check: 0 of 72 files differ) before my change.
- Auth and secrets: session cookie is HMAC-signed, HttpOnly, SameSite=Lax, Secure; sign-in rate-limited per address and site-wide;
  the pre-sign-in actions each check their own token/key/signature (Stripe, Square and Twilio webhooks verify signatures; the OAuth
  callbacks check a signed one-use state and only redirect to an allowed app URL; calendar feeds, unsubscribe links, quote and sign
  links carry hashed tokens); every file-serving action validates the name against a strict pattern before `readfile`; proc_open is
  array-form (no shell); no dynamic includes; the chat renders messages as text nodes (no HTML injection).
- Claude Check read-only gate, viewing-as gate, help-desk (JARVIS) actions: who may see a conversation, photo and PDF name checks,
  rate limits all hold.
- The page loads in headless Chrome against the harness with no JavaScript errors (only the harness's missing icons/manifest).
- Nightly backup ran at 00:00 (sixfold-backup-2026-11-09), storm refresh at 06:19, push alerts at 06:25, care sweep and regions warm
  at 06:00, EOD email at 03:01; disk 334 GB free; satcache 206 MB.
- JARVIS scheduled task: Ready, last result 0, running; no tickets waiting on live or practice.
- The watcher's photo copy, ticket-id and reply paths; help-reply.sh's PDF name scrubbing.
