# Deep review, 31 October 2026 (the 29-30 October build)

Scope: everything built on 29-30 Oct 2026 in Traverse, read as a paying client would live it: the website (homepage, trades, pricing,
`/start/` checkout, `/start/welcome/`, `/find/`, `/demo/`), Stripe checkout (`api/traverse-start.php`, `billing.php`, the central webhook
`api/traverse-hook.php`), the install being made (`api/traverse-clients-lib.php`, `traverse-tools/clients.php`), the welcome email, the first
sign-in, the Setup checklist, the Billing screen, zero Traverse branding, the Prospect Desk; then every edition change of the two days
(properties wording, plans and customer emails, Stats and end-of-day, Facebook leads, CRM sync, tablet fixes, audit fixes, Sixfold upgrades,
Duo rename, logo and splash fixes, seat block). Not reviewed (other agents' areas tonight): radar / satellite tiles (`api/satcache.php`,
`satMosaicTiles`), `tools/storm-update.php` / `stormRefresh`, `traverse/data-pipeline`.

Method: the ~225 commits since 29 Oct read as diffs; four fresh read-only reviewers (server auth/billing/accounts, the 30 Oct libraries and
cron tools, the page, the website + Prospect Desk) whose findings were each verified here by reading the code and, where it mattered, by
running it; two harness copies (`scratchpad/ptest-deep`, port 8815, edition and Sixfold mode; `scratchpad/ptest-cideep`, port 8816, client
installs on Stripe's TEST account) and `scratchpad/pdtest-deep` (the Prospect Desk, 8817) run before and after. Every fix that can be
exercised in a harness has a test that fails on the code before it (`tests/deep1031-test.mjs`, `tests/deep-ci-test.mjs`, the patched
`tests/desk-test.mjs`). Current `main` (satellite cache, storm-job memory) is merged into this branch and the after-run is on the merge.

Branch: `worktree-agent-ad69e4f291364bf2e`. Fix commits: `928ae0d3` (page), `6a6df4a2` (API + nightly backup), `dec28436` (customer
emails), `572f3a64` (checkout and welcome), `5e4e87b7` (Prospect Desk). Nothing deployed.

## Findings, ranked

### High

**1. An email-and-password sign-in lost the person's permissions, lock state, super flag and session id until the app was reopened.**
`summit-de59ae83/index.html` `signedIn(j)` (~12912), the one function behind `pwsignin` and `pwset` (invite and reset links, 30 Oct), copied
a dozen fields of the sign-in answer and left out `permFrom(j)`, `S.onTeam`, `S.resultsOn`, `S.fqOn`, `S.repSend`, `S.mailFrom`,
`S.a365mail`, `S.super`, `S.sid`, `S.avatar`, `S.lock`, and read `j.comm` where the server sends `communities`. Who it hit: every person a
client company invites by email (the whole team of a self-serve install signs in this way), an edition's invited office/manager people, and
Sixfold 365's optional email sign-in. An office person given Prices, Company, Facebook leads or Team sign-ins saw none of them on their
first open; an admin in setup mode had no lock state, so the Setup-only home was not drawn. Found by the page reviewer, confirmed by
reading the three other sign-in paths (code pad ~3950, `startin`/`hopin` ~23237, boot `me` ~23245), which all had the full copy.
Fix `928ae0d3`: one `signedIn(j)` with the full copy, used by the code pad, the pass/hop path and the password paths (the three near-copies
are gone). Test: `deep1031-test.mjs` 1 (API: `pwset`/`pwsignin` answers carry `permAdded`, `lock`, `sid`; page: an office person with the
Company permission sees the Company tile right after a password sign-in on a phone; `shots/deep-1-pw-signin-home.png`).

### Medium

**2. The read-only "Claude Check" sign-in was handed the Sync link's secret key.** `rounds.php` ~3692 put `sync` on the read-only allow-list
("keys never shown"), but `syncState()` (~11969) returns `hook.urls`, each `...?action=synchook&k=<40 hex>`, and that key is the whole
secret the hook accepts (~11676) to inject leads, customers and jobs as the install's admin. Found by two reviewers independently.
Fix `6a6df4a2`: `syncState(bool $keys)`; the `sync` action passes `$realMe !== 'Claude Check'`, the read-only answer gets `urls: null,
keysHidden: true`. Test: `deep1031-test.mjs` 2 (admin sees the addresses with keys; Claude Check sees none, and no 40-hex string anywhere
in its answer).

**3. Setup rows answered "locked" in setup mode and bounced the admin back to Setup.** `BILL_ADMIN_OK` (rounds.php ~4036) listed the
Setup screens an unpaid / not-yet-released admin may use, but not `zelleqrset` (Payments, Zelle QR), `svcarea`/`svcareaset` (Your service
area, client installs only, exactly the installs that sit in setup mode), `training`, `eodget`/`eodset`/`eodpreview`/`eodtest` (End-of-day
email) or `fbpollnow` (Check now, Facebook leads); `billGate` (~4100) refused them with `why: locked` and the page's `lockHit` (~13167) sent
the admin to the Setup home, so the rows looked tappable and silently went nowhere. Found by three reviewers. Fix `6a6df4a2`: the nine
actions added. Test: `deep1031-test.mjs` 3 (exemption off, nothing paid: admin `training`, `eodget`, `svcarea`, `zelleqrset` are not
`locked`; a crew sign-in still is).

**4. Prospect Desk: the unsubscribe link unsubscribed on a bare GET.** `prospect-desk/app/api/desk.php` ~337 logged `unsub` for any GET
with a valid token. Corporate mail scanners (Safelinks, Proofpoint, Mimecast) open every link in a message as it lands; the same file already
treats such opens of the tracked homepage/demo links as scans (~324). A company behind such a filter was marked "asked not to be
emailed" the moment the email arrived and skipped for good, silently. Found by the website/desk reviewer; the 80 emails queued 30 Oct
10:41 pm carry this link. Fix `5e4e87b7`: the GET shows a page with one Unsubscribe button (a POST to the same address); only the POST
unsubscribes; a company already off sees "You are unsubscribed". Test: `tests/desk-test.mjs`: the GET shows the button and takes nobody
off; the POST unsubscribes without a sign-in; a forged token still does nothing. (71/72 on this branch; on main the new checks fail as
expected, 62/72.)

**5. Prospect Desk: `queue.json` was read-modify-written under two different locks.** `sendQueue` (desk.php ~267) holds `queue.lock`; the
desk's Queue and Clear (~480-508) hold `queue.lock.add`; the pop (~280) and the retry re-adds (~294) took neither. A Queue tap during the
~18-minute hourly run could lose the new batch without a trace, or put a just-popped message back and send it twice. Fix `5e4e87b7`: the
pop and both re-adds take `queue.lock.add`. The desk suite's queue run still passes; a concurrent interleaving is not reproducible in the
harness (the fix is a lock around three lines).

**6. `diag` listed every sibling folder on the host to any client admin.** rounds.php ~4441 answered `parent_list` (every
`traverse-c…-data`/`-private`, `sixfold-data`, `traverse-shared`, `assistant-private`) to `$role === 'admin'`; pre-29-Oct code that
client installs made cross-tenant. Fix `6a6df4a2`: the listings are the super admin's only. Checked by reading.

**7. Backups missed the Zelle QR code.** `payways.json` (backed up) describes `zelle-qr.png|jpg` (rounds.php ~15166, 30 Oct), which neither
`action=backup` nor `tools/nightly-backup.php` carried, so a restore left a dangling QR entry. Fix `6a6df4a2`: both lists carry it as a
binary beside the logo. Test: `deep1031-test.mjs` 4.

**8. Customer emails: one mail-server hiccup spent a follow-up or aftercare email for good.** `care-lib.php` ~345 and ~363 counted a log row
as sent when `ok` or `stage !== 'config'`, so a failed SMTP/Gmail call at the hour of the sweep meant follow-up n for that quote was never
sent (the lead note says "NOT emailed" and nothing else happens) and the aftercare email for that job was lost. Fix `dec28436`: only `ok`
rows count, or the third failed try; `stage config` (mailbox not connected) never counts, so it goes when the mailbox is back. Also
`carecfgset` edited the config read before the lock (two admins saving different parts lost one): `careCfg($d)` inside the lock.
Checked by reading (the sweep runs from cron with a real mailbox; the harness has no path that sends and fails).

**9. Checkout: the welcome page's brand step did not check the payment.** `tcBrand` (traverse-clients-lib.php ~489) only matched the pending
record's session id, while `tcArea` and `tcProvision` require `tcSessionPaid`. The session id is in Stripe's own checkout address, so anyone
who opened a checkout and never paid could park 500 KB logo files in `traverse-shared/clients/pending/` (20 checkouts an hour per address),
`tcRemind` deleted the record after two weeks but not the logo, and a provisioned company's pending logo was kept for good. Fix `572f3a64`:
`tcBrand` requires the payment (answers 402 like the area step), the logo file goes with the record and after provisioning.
Test: `deep-ci-test.mjs` (a real TEST checkout, then `brand` and `area` before paying answer 402, nothing parked; the session is expired).

**10. Checkout: a retry after a part-way failure kept the first attempt's email and password.** traverse-clients-lib.php ~561 wrote
`rounds-accounts.json` only when absent, while the admin's name in the codes file was re-taken every pass, so a buyer who corrected their
email on the retry was told to sign in with it and could not (the code still worked). Fix `572f3a64`: the login row is overwritten on a
retry. Checked by reading (the failure between the two writes is not reproducible in the harness).

### Low

**11. The update bar covered the phone menu bar.** index.html ~2066: `.updbar` lifted itself only for `has-dock` (the door list's sort
bar), but the phone tab bar sets `has-tabs`; for 20 s the bar sat over Home and Pipeline on every install, Sixfold included (an audit item
of 30 Oct). Fix `928ae0d3`: the `has-tabs:not(.has-dock)` rule the toast already had. Test: `deep1031-test.mjs` 6 (computed `bottom`).

**12. A right password still counted against the per-address limit.** rounds.php ~2308 gave back the per-IP try on success but not the
per-email one (10 an hour), so one person signing in on phone, tablet and computer a few times hit "Too many tries". Fix `6a6df4a2`. Test:
`deep1031-test.mjs` 5 (12 right sign-ins in a row).

**13. The welcome-page logo was taken with the white backing on.** `logoAdopt` (rounds.php ~15577) passed `true` while the 30 Oct change
made the backing off by default for uploads (Matthew: it read as a white outline). Fix `6a6df4a2`. Test: `deep1031-test.mjs` 7.

**14. Links in cron-sent customer emails carried traverseplatforms.com for a client on its own domain.** `nlUnsubUrl` and `kitBase` fell
back to that host whenever `HTTP_HOST` was absent, which is every `caresweep` run from the command line; `eodBrand` already used the
company's `appUrl`. Fix `6a6df4a2`: one `webOrigin()` (request host, else the company's `appUrl`, else the default) used by both. Every
install lives on traverseplatforms.com today, so no live effect yet.

**15. The seats-over email to Matthew said "Nothing is blocked"**, stale since the 30 Oct seat block. Fix `6a6df4a2` (the email text; the
comments at rounds.php ~4149, ~12306 and billing.php 8/44 still say it and are harmless).

**16. Welcome page: the "Loading your homes" poll outran its own rate limit.** `start/welcome/index.html` ~183 asked `areastatus` every 3 s;
the server allows 240 an hour; after ~12 minutes of linking (a wide radius) the 429 answers were ignored and the spinner stayed for good.
Fix `572f3a64`: every 3 s for a minute, then every 10 s, and a refused look is tried again. Checked by reading.

**17. Prospect Desk: a trade with no app picture got the roofing picture and its roof caption** (`appPic`, desk.php ~144: pest, security,
solar); a leftover `{Company}`/`{name}` in a template went out as typed. Fix `5e4e87b7`: such a trade goes plain (as a city with no map
does); Queue and the test send refuse a template with a placeholder they cannot fill. Test: `tests/desk-test.mjs` (both).

**18. `tools/nightly-backup.php` ran at PHP's CLI default memory limit** while reading every log whole, so one big install's fatal would
stop the folders after it (the other tools raise it). Fix `6a6df4a2`: 1024M. Also `vis` at index.html ~10819 was an implicit global.

**19. "Your Traverse plan" on three tiles outside the Billing screen** (index.html ~4810, ~13252, ~14596) read as the product's name to a
client company's admin, against the 30 Oct zero-branding rule (Traverse only on the Billing screen itself). Fix `928ae0d3`: "Your plan…",
Spanish keys follow. Left for Matthew: Accounts' support-account row ("Traverse's own sign-in, for support") and Setup › Email's Google
consent wording, which are accurate statements rather than branding.

**20. Spanish.** Six crew/office-facing strings from the 30 Oct builds had no key ("Every neighborhood is assigned already.", "Take it
back", the empty-inbox line, "You are not on a team yet…", the job-gone line, "Plan visits to book"); added in `928ae0d3`. About 40 admin-only
Setup labels from the same builds are still English on a Spanish device (admins' screens; low priority; `sync-es.cjs` appends).

## Found but not fixed, and why

- **The harness's Stripe TEST config was stale, not the code.** `checkout-test` failed "roofing team year" ("The price specified is
  inactive") because `ptest-ci1030`'s shared `billing-config.php` (made 29 Oct) still named the old Company-yearly prices that
  `stripe-plans-1030.mjs` deactivated on 30 Oct. The repo's `stripe-founding-prices.test.json` and the live configs are right (checked); the
  harness copy was repointed (`price-fix.mjs`). Nothing to deploy; worth knowing if that harness is reused.
- **`set.company` permission does not cover the logo** (rounds.php ~15525 checks `$role !== 'admin'` only): a role given the Company screen
  can edit name and colour but not the logo. A product decision (the logo may well be admin-only on purpose).
- **Unlocked read-modify-writes** on `payways.json` (`paywaysset`/`zelleqrset`), `mail-templates.json`, `kit.json` (`prcset`, `costsapply`)
  and `company-local.json` (`logoTake` vs `companyset`): admin-only screens, two admins saving the same second lose one. Left; the pattern
  used elsewhere (`careEdit`, `syncCfgEdit`) is the fix if wanted.
- **EOD `via: own` fails silently once the mailbox is lost** (rounds.php ~10545: the marker is written only when something sent, so four
  failed tries a day go to `eod.log` and nobody is told). Suggest a one-time `feedAdd` to the admins as `flLost` does. Not changed tonight.
- **Prospect Desk: a timed-out DATA reply is retried** (desk.php ~245/~294): if Gmail accepted the message but the 250 did not arrive in
  15 s, the company gets it twice. Rare; a `Message-ID`-keyed "already sent" guard is the fix. Not changed.
- **Buyer "ready" email says the 7-day guarantee started today even when their homes are not in** (traverse-clients-lib.php ~640;
  `billingMarkLive` runs regardless of area status). A wording / policy call for Matthew.
- **Duplicate helpers across the 30 Oct libraries** (`careJson`/`flRead`/`syncCfg` all "decode a file or []"; `careEdit`/`careNewsEdit`/
  `syncCfgEdit`/`syncKeysEdit`; `flWrite` vs `writeJsonAtomic`; `flB64` vs `b64u`; five copies of "tell the admins" loops; `$e = fn
  htmlspecialchars` in six places). Each library is also loaded on its own by a cron tool, so folding them means moving shared helpers into a
  file every tool requires: a cleanup for daylight, not for a 3 am merge. No behaviour at stake. The page's three sign-in copies, the one
  duplication that hid a bug, are folded (finding 1).
- **Trades page CSS** (`a[href="demo/"]` vs the page's `../demo/` links): the demo button loses its styled state on that page. Cosmetic.
- **`/start/` page** goes blank with no message if a plan's interval has no configured price (misconfiguration only).

## Checked and sound (the risky paths, traced)

Stripe webhook signature (`tvhSigOk`, 5-minute tolerance, `hash_equals`), one lock per client shared by the webhook, the welcome form and
relink; the central hook runs a live install's own `billinghook` in place and keeps events for a company not yet made (replayed in order on
provisioning); `tcProvision` idempotent (folder, cookie, codes and key kept in the pending record); the one-use start pass (SHA-256, 30
minutes, unlink under lock, `#start=` in the fragment with `no-referrer`); invite/reset tokens (24 random bytes, SHA-256 at rest, one use,
newer kills older, 7 d / 24 h); `pwsignin` verifies against a dummy hash for unknown addresses; `hop`/`hopin` HMAC with the server key, 60 s,
spent per install, super lines only; `billGate` never promotes, super never locked; `permElevate` lifts only to office/manager/rep for an
action in that permission's own list; `seatFull` on add and restore, never on Sixfold or exempt installs; `svgClean` allow-list and the
sandboxed `logo` answer; `mailState`/`moState` never return the password or tokens; OAuth state HMAC + PKCE + one-use claim; Facebook OAuth
state/cookie binding, `appsecret_proof`, tokens sealed; the Sync hook `hash_equals`, rate limits, nothing deleted, https-only public-IP
fetches; every 30 Oct automation off until the admin turns it on, templates editable, customer emails through the company's own mailbox,
nothing sent when none is connected; idempotency of the hourly jobs (care-mail.log rows, EOD day marker, FB lead ids, sync fingerprints);
`appTz()` throughout; Sixfold: every new entry point exits for `a365` (`careOn`, `flAction`, `eodcron`, `syncOn`, `edWords`, `pw()`,
`edOn()` gates on the page), the Sixfold (b) additions opt-in and read-only until saved, the Sixfold-mode suites unchanged before and after;
prices on the homepage, `/start/`, the Order Form and the cancellation page equal `billing.php` to the dollar (Duo 99/79, Team 249/199
+45/35, Company 549/439 +39/29; founding = round(x 0.75) per part; yearly = 12 x monthly; "save 20%" true on all three); no "Solo",
"Crew", "$50" or "uplift" left in customer copy; no data-source names on public pages; `/start/` and `/find/` noindex; Find my app answers
the same for everyone and only to the typed address; `action=go` destination fixed server-side; the plain part of a desk email is the
template untouched; build markers for the editions' rebuild present at the counts `rep()` expects; no duplicate function names in the
page's main script or across the PHP files; the merged main (satcache, stormRefresh) builds code-only and passes `php -l` and the page
syntax check.

## Regression

Harness: `scratchpad/ptest-deep` (copy of `ptest-1030`; fresh `sixfold-data`, `sixfold-private`, `traverse-shared` from `ptest-1030` before
each full run, the four once-per-data suites first: `tests/fresh-deep.sh`, `tests/run-deep.sh`), `scratchpad/ptest-cideep` (copy of
`ptest-ci1030` without its old installs; Stripe TEST), `scratchpad/pdtest-deep`. Both runs were made while other agents' servers and
browsers were running on this laptop; PHP's built-in server is single-threaded, so a few browser waits time out at random in both runs
(`timeout: tools`, `timeout: code card`, `timeout: plans list`, `timeout: stats phone`): those are load, not code.

| Suite (mode) | Before (main `98f0110b`) | After (this branch + current main) |
|---|---|---|
| care-test (edition, fresh data) | 114 / 3 | 114 / 3 (same three: Gus, Pam, a load timeout) |
| edstats-test (edition, fresh data) | 45 / 2 | 45 / 2 (same: a load timeout and its follow-on) |
| fbleads-test (edition, fresh data) | 94 / 8 | 94 / 8 (same eight: the Facebook stand-in's state in this copy) |
| crmsync-test (edition, fresh data) | 81 / 1 | 81 / 1 (same: Pipedrive) |
| t1030-test (edition) | 63 / 1 | 63 / 1 (same: "Solo" wording) |
| card-test (edition / Sixfold) | 1 / 1 (timeout) | 1 / 1 (timeout) |
| seat-block-test (edition / Sixfold) | 7 / 0 | 7 / 0 |
| **deep1031-test (edition, new)** | fails on the old code (findings 1, 2, 3, 4, 5, 7, 11, 12, 13) | **20 / 0** |
| reps-test (edition / Sixfold) | 37 / 0 | 37 / 0 |
| batch1029-ui-test (edition / Sixfold) | 43 / 0 | 43 / 0 |
| rolepreview-test (edition / Sixfold) | 9 / 0 | 9 / 0 |
| accounts-test (edition / Sixfold) | 29 / 1, 26 / 1 (timeouts) | 29 / 1, 26 / 1 (timeouts) |
| payments-test (edition / Sixfold) | 20 / 0 | 20 / 0 |
| wx-test (edition / Sixfold) | 2 / 5 | 2 / 5 (harness lacks the shared weather copy; out of scope) |
| viewas-test (edition / Sixfold) | 1 fail / blank | same |
| roles-test (edition / Sixfold) | 75 / 0 | 75 / 0 |
| roles-ui-test (edition / Sixfold) | 4 / 1 (timeout) | 4 / 1 (timeout) |
| billlock-test (edition) | 101 / 7 | 101 / 7 (same seven: "Door data" wording and the "more time" timeout; the suite's tile lookup updated for "Your plan", `tests/billlock-test.mjs`) |
| perms-test (matrix) | 119 / 5 | 119 / 5 (same five, against the pre-`onteam` matrix base) |
| checkout-test (client installs, Stripe TEST) | 44 / 2 | 51 / 1 (the harness config repointed at the active prices; the one left is the "pick Crew" wording) |
| e2e-a / e2e-b / e2e-c (client installs) | 62 / 1, 2 / 2, 23 / 1 | 62 / 1, 2 / 2, 23 / 1 (same stale wording checks) |
| **deep-ci-test (client installs, new)** | fails on the old code (finding 9) | **8 / 0** |
| desk-test (Prospect Desk, patched copy) | 62 / 72 on main (the new checks fail) | 71 / 72 (the one left fails the same on main: "ticking 3 companies counts 3") |

Sixfold mode: every suite identical before and after.

Baseline failures that are stale expectations, not bugs (each checked against the code): `t1030` 11 expects "Solo" (renamed Duo 30 Oct
10 pm); `billlock` 7 expect "Door data is paused" (now `pw()` → "Property data"); `perms` matrix compares with a `matrix-base.json` made
before `onteam`, American spelling and the Sixfold permissions editor; `checkout-test` "Solo with more people is refused (pick Crew)" (the
message now names Duo and Team); `e2e-a` checklist wording and `e2e-c` "door data" (properties wording); `e2e-b` expects the invite "via
Traverse" (removed with zero branding 30 Oct, then crashes on it); `wx-test` wants `traverse-shared/weather/` and an `alerts-cache.json`
the harness copy lacks (weather, out of scope); `fbleads-test`'s failures come from the Facebook stand-in's state file living in the
harness it was written for; `viewas` "list has office, quote and manager accounts" depends on accounts the fresh data copy lacks; the desk
suite's "ticking 3 companies counts 3", "outside weekday 8-5" and List-Unsubscribe checks predate the 30 Oct any-hour sending and 29 Oct
header removal (the copy in `tests/` has the last two brought up to date; the first fails the same on main). None of these failed more on
the fixed code than on the baseline.

## Deploy steps for the morning (coordinator)

1. On `main`: `git merge worktree-agent-ad69e4f291364bf2e` (it already contains current main: satcache, stormRefresh).
2. Build: `cd traverse/app && node i18n/sync-es.cjs && node ../editions/build-editions.cjs && node ../editions/minify-page.cjs`.
3. App + API + client templates: `bash traverse/ops/deploy-app.sh deep-review-1031` (ships rounds.php, billing.php, care-lib.php, the
   editions' pages, traverse-clients-lib.php, traverse-start.php, the templates, then `clients.php regen` on the server). It sends
   `tools/nightly-backup.php` to `sixfold-tools/` too (since 30 Oct 09:59).
4. Website: rebuild the site (`build-preview.cjs` → `build-editions-page.cjs` → `build-legal.cjs` → `build-site.cjs`) and upload
   `start/welcome/index.html` (the poll change); nothing else on the site changed. Keep the X-Robots-Tag rule as `open-site.sh` left it.
5. Prospect Desk: `node shared/tools/minify-public.cjs traverse/prospect-desk/app traverse/prospect-desk/dist index.html sw.js`, upload
   `dist/index.html`, `dist/sw.js` and `app/api/desk.php` to `prospects-47bfe6/` (`api/`). The 80 queued emails already carry the
   unsubscribe link: after this deploy it shows the confirm page instead of unsubscribing on open. Then look in
   `traverse-prospects-data/events.log` for `t: unsub` rows within about a minute of that company's `sent` row (scanner opens) and tell
   Matthew how many companies were taken off by scanners before the fix, so he can decide whether to put them back (`unsubmark` has no
   undo; a hand edit of events.log would be needed, with a backup first).
6. Live checks: sign in with email and password on TraverseRoofing as a non-admin with a granted permission and see the tile at once;
   `?action=sync` as Claude Check shows no `k=`; a client install's Setup › Training opens in setup mode; `action=backup` from a Zelle-QR
   install lists `zelle-qr.*` under `binary`.
