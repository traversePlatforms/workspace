# Door app — overnight code review, 2026-10-06

Reviewed while Matthew slept. Scope: `door-app/site/api/rounds.php` (the whole API), `api/webpush.php`, the four cron tools in
`site/tools/`, the app page `summit-de59ae83/index.html`, `sw.js`, `manifest.json`; the commercial pipeline scripts and the
door-file builders were read lightly. Nothing was uploaded, committed, emailed or changed on the live site. The live checks were
read-only GETs as the "Claude Check" admin (regions, training, calendar, diag, stormdays, backups, search), then a sign-out.

## Summary

- **Security: no hole found.** Every action past sign-in checks the session; admin-only data (commercial towns, hail, roof,
  skip-trace numbers, leads, customers, accounts, backups, exports) is refused to crew and to signed-out requests, and the
  four admin-only towns are refused on every screen (`area`, `mark`, `note`, `matfix`, `lawnmask`, `walkics`, `photoget`,
  address search), checked by probe. Paths are built only from validated keys or hashes. The page draws everything from the
  server with `textContent`; the only `innerHTML` calls carry fixed SVG strings and numbers. The cookie is `SameSite=Lax`,
  so a cross-site form cannot post as a signed-in phone. Sign-in codes are never returned except by `accountpins`, which
  needs the admin's own code again and is counted against the sign-in limiter.
- **Three clear bugs fixed** (below), each with a test that failed before and passes after.
- **Tests.** Baseline before any change: **81 suites, 1,470 passed, 1 failed** — the one failure was a leftover
  `training.json` in the test copy from an earlier session (teams-test expects none); run alone it passed 54/54, so the
  code was clean. After the fixes, with the new `review3-test.mjs` added: **82 suites, 1,480 passed, 2 failed** — the same
  teams-test check again (it fails only inside a full run; alone, and in a replay of the suites that run just before it,
  it passes 54/54 both before and after my changes, so it is an ordering interaction in the harness I could not pin down,
  not the code) and one headless-Chrome flake in leadimport-test ("Could not find node with given id"; 25/25 alone).
  Every suite that covers the changed code passed in the full run: review3 17/17, backup 20/20, teams (bar that one check),
  train7 10/10, com 11/11, stormlist 20/20, matfix 9/9. The new suite failed 9 of 17 before the fixes and passes 17/17 after.
- The test copy's PHP runs with `memory_limit=128M`, the same as the host, so the suites that open the commercial towns and
  the storm list already exercise the per-town loads at that limit.
- **Not mine:** `door-app/site/data/rounds/training.json` showed as modified in the working tree for part of the night; another
  reviewer committed it (`22f86a6`, the Training fact fixes) and the tree is clean for it now. I did not touch it.
- **Live note:** the live server already holds the 31 lessons under the seven headings (`training` answered 31 lessons, kinds
  door/sales/quote/phone/paper/safety/app), and the live `calendar?from=2026-13-01` answers 500 — the first bug below is live.

## FIXED

### 1. A calendar or walks request with an impossible date ended in a 500 with no JSON

- **Where:** `door-app/site/api/rounds.php` — `calRange()` (line 2038) and the `walks` action (line 3083).
- **The bug:** the `from`/`to` dates were checked only for the shape `YYYY-MM-DD`. A value like `2026-13-01` or `2026-99-99`
  passed the pattern and then went into `new DateTime(...)`, which throws. Nothing catches it, so PHP stopped the request:
  HTTP 500, empty body, nothing in the response for the page to read.
- **How it fails:** anyone signed in (crew included) opens
  `/api/rounds.php?action=calendar&from=2026-13-01` — a typo in a bookmark, a bad value from a future client, or someone
  poking at the API — and gets a blank 500. The page shows "The calendar needs signal." Confirmed on the test copy and,
  read-only, on the live server.
- **The fix:** both places now use the file's own `dateOk()` (pattern **and** `checkdate`), so a bad `from` or `to` falls
  back exactly as a missing one does (today, +30 days for the calendar, +14 for walks). A real but odd date like
  `2026-02-30` now also falls back instead of silently becoming 2 March.
- **Test:** `review3-test.mjs` checks 1–4 (calendar and walks with a 13th month and a 99th day answer 200 with real dates).
  Failed before (500, not JSON), passes after.

### 2. The full backup left out three settings files the app writes

- **Where:** `door-app/site/api/rounds.php` line 2571 (the download button) and `door-app/site/tools/nightly-backup.php`
  line 35 (the nightly copy).
- **The bug:** the backup took every `*.log` plus `goals.json`, but not `goals-people.json` (everyone's personal daily
  goals), `training.json` (the company's lessons — Sixfold's 31) or `roof-settings.json` (the roofing company's own price
  per square and damage thresholds). All three are written only by the app on the server. The restore note says only codes
  and photos are left out, so a restore from this backup would have silently lost the lessons, the goals and the prices.
- **How it fails:** the server is lost; the admin restores from the newest nightly copy; the Training screen is empty, every
  personal goal is gone, the Storm list shows no prices and every door says "Set your price per square".
- **The fix:** both lists now name the four files (`goals.json`, `goals-people.json`, `training.json`,
  `roof-settings.json`); a file that does not exist yet is simply not included, as before. The two lists stay in step, which
  `backup-test` checks (20/20 after).
- **Test:** `review3-test.mjs` checks 5–11 (set a goal, save a lesson, save a roof price, download the backup, find all
  three). Failed before, passes after. The suite puts the three files back as they were when it finishes.

### 3. A manager opening a teammate's Doors tab saw their own doors under the teammate's name

- **Where:** `door-app/site/summit-de59ae83/index.html` line 2862, in `myDoors()`.
- **The bug:** the page sent `who=` (whose doors) only when the signed-in person was an admin. The new manager role
  (2026-10-05) can open Team stats, tap a teammate, and switch to the Doors tab — the request went up without `who`, so the
  server answered with the manager's own doors, drawn on a page titled with the teammate's name. The server side was right
  (`whoFor()` lets a manager ask for their team), only the page never asked.
- **How it fails:** a manager taps a rep on Team stats, then Doors, to fix a mis-marked door. The list shows the manager's
  own knocks (or "No doors in the last 30 days yet"), and the fix is made against the wrong list.
- **The fix:** the page now sends `who=<name>` whenever the page is not the signed-in person's own. The server still answers
  with your own doors unless you may see theirs, so crew and outsiders gain nothing.
- **Test:** `review3-test.mjs` checks 12–17 (a team with a manager and the crew on it; the crew knock a door; a headless Chrome
  signed in as the manager opens Team stats → the teammate → Doors; the `mydoors` request carries `who=<teammate>` and the
  knocked door is on the list; no script errors). Failed before, passes after. The suite removes the accounts and the team it
  made.

## RECOMMENDED (judgement calls, not changed), by severity

1. **Push endpoints are not limited to known push services** — `rounds.php` `pushsubscribe` (line 2322), `webpush.php`
   `webpushSubscriptionError()` (line 230). Any signed-in code can register a subscription whose endpoint is any `https://`
   URL; the cron then POSTs an encrypted blob with our VAPID header to it every time a warning goes out, and `pushtest`
   relays the far end's answer (status, and for a 400 the body text) back to the caller. Risk is low (only outbound HTTPS
   POSTs of opaque bytes, from a signed-in person) but it is a free outbound-request primitive. Consider allowing only the
   hosts the browsers actually use (`fcm.googleapis.com`, `*.push.apple.com`, `*.notify.windows.com`, `updates.push.services.mozilla.com`,
   and the test listener), or at least not returning the far end's body from `pushtest`.
2. **The month grid keeps the old day selected after `‹ ›`** — `index.html` `calendarView()` line 4068 (`shift`). Moving to
   another month keeps `S.calDay` on the day picked in the previous month, so the box under the grid still says, for
   example, "Today · Mon 6 Oct" with "Nothing on this day" while November is showing, and the selected cell is off-screen.
   Setting `S.calDay` to the first of the new month in `shift()` would fix it; not changed because it is behaviour.
3. **`pushlatest` answers everyone** — `rounds.php` line 2357. A push with no payload makes the phone ask for the latest
   alert sent; the answer is the newest alert sent to anyone, including a storm warning that Sixfold sends to admins only.
   It is public NWS text (event name, towns, until), so no private data, but a crew phone could show a warning the company
   chose not to send it. Filtering by what that role would have been sent is a few lines.
4. **Crew on a team see teammates' lead phone numbers through the calendar** — `rounds.php` `calendar` (line 2075–2080):
   a `lead` event carries the customer's name and phone, and crew on the same team may look at each other's calendars
   (Matthew's call on 2026-10-05). Fine if intended; otherwise strip `phone` from events when `!canManage($who)`.
5. **A manager's leaderboard carries every personal goal** — `rounds.php` `board` line 2921 sends `pgoals` (all people's
   personal goals) to managers unfiltered, while the rows are filtered to their team. Numbers only, low value, but it leaks
   the names of people outside the team.
6. **The morning email and the command line see the admin-only towns** — `rounds.php` line 1041 gives the CLI an admin
   session, so `adminRegion()`'s comment ("out of the jobs that run with nobody signed in") is not quite true: a walk booked
   on a commercial test building would appear in the morning email's walks list, and `pushcron` reads their territory
   assignments. Harmless today (nobody books walks there); worth a note in the comment or a CLI exception if the test towns
   stay.
7. **Hand-edited `training.json` is passed through raw** — `rounds.php` `training` (line 2138) sends the file as is; only
   `trainingsave` normalises lessons. A lesson uploaded by hand without `text` (or with a kind outside the seven) would throw
   in `drawTraining()` (`l.text.replace`) and the screen would show "Training needs signal" for everyone, or the lesson would
   sit under no heading. Sixfold's 31 are well-formed (checked). Cheap guard: normalise `title`, `kind`, `text` to strings in
   the `training` action.
8. **`accountpins` ignores the five-address rule** — line 2796 pauses on `SITE_TRIES` alone, where sign-in requires wrong
   codes from `SITE_MIN_ADDRS` addresses first. Only admins can reach it, so this is cosmetic.
9. **DEPLOY-ROUNDS.md needs an entry** for this batch when it goes up: `rounds.php`, `index.html`, and `nightly-backup.php`
   to `sixfold-tools/` (the backup change is in both files; the nightly copy only picks it up once the tool is replaced).
   Not in my scope to edit.
10. **Rate limiting** — sign-in, search and photos are limited; `avatar` (400 KB, one file per account, overwritten) and the
    write actions are not, beyond needing a session. Fine for a crew of a dozen; worth a per-session ceiling on writes if
    codes are ever shared more widely.

## NOT CHECKED

- The Web Push cryptography in `webpush.php` beyond reading it (it has its own test and RFC 8291 vector per its header).
- Skip tracing (`api/skiptrace.php`) and the provider adapter: outside the scope list; read only where `rounds.php` calls it.
- The data pipeline builders under `operations/door-territory/*.mjs` beyond a light read of `commercial/build-app-data.mjs`,
  `commercial/enrich.mjs` and the head of `build-rounds-data.mjs`: no clear bug seen; nothing changed.
- Real phones: push delivery, the install prompts and iOS behaviour (headless Chrome only).
- Anything in `sixfold-private/`, `secrets.php`, the codes file, the assessor raw files, the owner CSVs or `commercial/out/`
  (not opened, as instructed).
- The live site beyond the read-only GETs listed above; no POST or mutating action was sent to it.

## Changed files (working tree, not committed)

- `door-app/site/api/rounds.php` — fixes 1 and 2
- `door-app/site/tools/nightly-backup.php` — fix 2
- `door-app/site/summit-de59ae83/index.html` — fix 3
- Test harness (scratchpad, not in the repo): `ptest/review3-test.mjs` (new suite, 17 checks), `ptest/review-probe.mjs`
  (the read-mostly probes used for this review), `ptest/baseline-2026-10-06.out` and `ptest/final.out` (the two full runs).
