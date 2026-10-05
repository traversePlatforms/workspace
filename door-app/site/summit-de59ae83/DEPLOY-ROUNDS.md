# Door rounds — what to upload, and the one check that matters

**⚑ Moved 2026-10-04: the app now lives in `door-app/` (Matthew's own product, see [../../README.md](../../README.md)).** Every "from `sixfold/site/`" below now means **from `door-app/site/`**: same file names, same places on the server. The sections below are kept as written. Two files stay in Sixfold: `quote.html` (`sixfold/site/summit-de59ae83/`) and the crew codes file.

**Live = the competitor-audit batch (commit `d917514`), uploaded by Matthew and verified 2026-10-03: index.html
and quote.html byte-identical plain and cache-busted, every new action answering, Black Forest outlines 12/12.**
Before that: **the 2026-10-03 batch (commit `808f91b` door files + `e9b2350` code), uploaded by Matthew and
verified 2026-10-03** — signed in with the "Claude Check" admin code: 24 checks, plus a test
enquiry that emailed Contact@ and filed itself in Leads. The dated sections further down explain
each change. Phase 1 of [ROUNDS-WEB-SCOPE.md](../../operations/door-territory/ROUNDS-WEB-SCOPE.md).

## ⏳ TO UPLOAD — county bars on Colorado, tap a Leaderboard name, and the Add info button in dark mode (index.html only)

Matthew 2026-10-05: (1) on the Colorado screen each county is now a fold-out bar with its towns, doors to knock, high-risk doors and quotes booked; tap to show its towns, tap again to fold. Each phone remembers which are open; with one county it is always open. (2) On the Leaderboard an admin can tap a name to open that person's stats (Back returns to the board); Team stats already did this. (3) Seen in the demo: the Add info button's gradient ran into the text colour, which turns cream in dark mode. Now dark pine with cream text in both looks. state-test 14/14, board-test 28/28, all 70 suites pass.

| Step | File | Goes to |
|---|---|---|
| 1 | `door-app/site/summit-de59ae83/index.html` (**477,745** bytes) | `public_html/summit-de59ae83/` (no flush needed for this folder) |

## ✅ LIVE 2026-10-05 (verified 13/13) — fixes from the full code review. Page identical; a bare sign-out link signs nobody out and the page's POST does; the skip export refuses a made-up town; tools, Door rounds and Find an address work on a phone; Sign out in the page really ends the session (me 401); no page errors. The sign-in pause was not exercised live (that would mean sending wrong codes)

A full review of the app found no security hole in sessions, admin gating, paths, exports or the offline queue. Fixed: the site-wide sign-in pause now needs wrong codes from 5+ addresses (two phones could keep new sign-ins paused for everyone); the sign-in screen forgets who was signed in, so the once-a-minute send stops redrawing it while someone types; a bare sign-out link signs nobody out (the page posts); a photo ceiling of 120 per person per hour; viewed photos not kept in a shared iPad's cache; search allows 150 per 10 minutes and waits 400 ms; the skip-trace export refuses a made-up town; a stale signed-out neighbourhood goes to sign-in; the come-back day uses the server's rest days; "Quotes to build" now says Pipeline. Also: the 11 door files, 11 area lists and walk-tool.html (owners' names) are no longer tracked in git (still on disk). review2-test 6/6, all 70 suites pass.

| Step | File (from `door-app/site/`) | Goes to |
|---|---|---|
| 1 | `api/rounds.php` (**195,908** bytes) | `public_html/api/` |
| 2 | `summit-de59ae83/index.html` (**475,294** bytes) | `public_html/summit-de59ae83/` |
| 3 | — | Flush the cache |

## ✅ LIVE 2026-10-05 (verified 20/20) — hail map, live radar, roof photos (admins, Roofing preview). Page identical; data files not reachable on the website; the hail map answer and photo windows match the uploaded files; on a phone, the live radar loads, the 26 Jun 2020 path draws, and a Castle Rock roof photo loads from the state bucket; no page errors

Matthew 2026-10-05. On the Hail screen: **Live radar map** (NOAA NEXRAD through the Iowa Environmental Mesonet tile cache, every 5 minutes) and, on each storm, **Show on the map** (the day's radar hail path, ~1 km squares coloured by size; opens with radar off). On the roof line: **See the roof (aerial photo, 2020)**, a 3-inch photo of the house read in the browser from the State of Colorado's public bucket (DRAPP 2020, public domain), only the blocks over the house (1-2 MB); 8,503 doors in Castle Rock, Franktown and Sedalia. Tested: mapphoto-test 10/10 (the photo really loads from the bucket in Chrome); all 70 suites pass. Includes the hail-and-roof-only-in-preview change below if that has not gone up yet.

| Step | File (from `door-app/site/`) | Goes to |
|---|---|---|
| 1 | `data/rounds/hail-paths.json` (**139,970** bytes) and `data/rounds/photo-castle-rock.json`, `photo-franktown.json`, `photo-sedalia.json` (**424 KB** together), gitignored, on this computer | `sixfold-data/rounds/`, beside monument.json |
| 2 | `api/rounds.php` (**194,212** bytes) | `public_html/api/` |
| 3 | `summit-de59ae83/index.html` (**475,102** bytes) | `public_html/summit-de59ae83/` |
| 4 | — | Flush the cache |

## ✅ LIVE 2026-10-05 (verified with the maps upload) — hail and roof only in Roofing preview (Sixfold): no Hail tile and no hail or roof lines on the normal card; both in the preview. (company.json went up on a second pass.)

Matthew 2026-10-05: hail is irrelevant to the lawn crew. Sixfold's company.json now has `card.hail` and `card.roof` off, so the normal card shows neither, and the Hail tile shows only in Roofing preview, which always shows both (a roofing company's install leaves them on). card-test 18/18, hail-test, roof-test, settings-test pass.

| Step | File (from `door-app/site/`) | Goes to |
|---|---|---|
| 1 | `data/rounds/company.json` (**1,902** bytes) | `sixfold-data/rounds/` (replace) |
| 2 | `summit-de59ae83/index.html` (**466,474** bytes) | `public_html/summit-de59ae83/` |
| 3 | — | Flush the cache |

## ✅ LIVE 2026-10-05 (verified 15/15) — overnight 2026-10-04: roof size and pitch, year built, review fixes. Page identical at three addresses; roof and year files not reachable on the website; public settings carry no appUrl; Castle Rock and Monument doors' roof and year-built answers match the files exactly; a Castle Rock card shows roof, squares, pitch, built year, shape and material; no page errors. (First pass: the year files had not gone up; Matthew uploaded them and the re-check passed.)

Run while Matthew slept, all local; nothing uploaded. **Roof** (laser scan, El Paso 2018 / Douglas 2020): about N sq ft, squares and pitch on 21,530 of 26,674 doors; **year built** (county files) on 98.6%, plus remodeled year, roof shape and material for Douglas. Admins only, behind `features.roof`; a house built after the scan says so. Checks against Douglas County's records in [research/ROOFING-DATA-CHECK-2026-10.md](../../research/ROOFING-DATA-CHECK-2026-10.md). **Review fixes** (second review of everything since 851ede3; nothing severe): the public settings answer no longer carries the app's address; the Roofing preview also hides the trees chip in Find an address; the tools screen redraws on a first visit when the settings arrive late; the visit form's default service; opening a neighbourhood from Hail right after switching the preview; no line breaks into the weather-service header; hail files decoded once per request; hail days more than an hour from 6 am are not filed (3 April 2022 days were; no storms on them, so nothing visible changed). Tested: roof-test 6/6; all 69 suites pass (lookinstall needed a re-run: its known install-prompt timing flake, 3/3 alone).

| Step | File (from `door-app/site/`) | Goes to |
|---|---|---|
| 1 | the 7 `data/rounds/roof-<town>.json` (**2.2 MB**) and 7 `data/rounds/year-<town>.json` (**1.6 MB**), gitignored, on this computer | `sixfold-data/rounds/`, beside monument.json, never inside public_html |
| 2 | `data/rounds/company.json` (**1,864** bytes: roof switched on) | `sixfold-data/rounds/` (replace) |
| 3 | `api/rounds.php` (**193,355** bytes) | `public_html/api/` |
| 4 | `summit-de59ae83/index.html` (**466,127** bytes) | `public_html/summit-de59ae83/` |
| 5 | — | Flush the cache |

Optional: `data/rounds/hail-storms.json` again (only its days-read count changed).

## ✅ LIVE 2026-10-04 (verified 15/15) — door-card sections as settings + Roofing preview (admins), and the tools-screen redraw. Page identical at three addresses; the card block is on the server, all on; a Black Forest door (Shoup Rd) shows fire, lawn, trees, money, water, the Show doors with row and hail as Sixfold; in Roofing preview the same door shows only the basics and hail, and the Fire/Lawn/Trees sorts are gone; switching back restores everything; no page errors

Matthew 2026-10-04: a roofer's card should not carry Sixfold's lawn and fire. company.json now has a `card` block (lawn, trees, fire, money, water; missing = shown; Sixfold: all on, so the crew see no change). Admins get a **Door card: Sixfold | Roofing preview** switch on the tools screen, under Look: on that device only, cards show the basics and hail, and lawn, trees, fire, money, water, the fire check, the Show doors with row and the Fire / Lawn / Trees sorts are hidden. It stays on for that device until switched back. Also: the tools screen draws itself again when fresher company settings arrive (the missing Hail tile, 2026-10-04). Tested: card-test 15/15; all 68 suites pass alone (lookinstall's check now reads the first switch row).

| Step | File (from `door-app/site/`) | Goes to |
|---|---|---|
| 1 | `data/rounds/company.json` (**1,846** bytes) | `sixfold-data/rounds/` (replace) |
| 2 | `api/rounds.php` (**192,106** bytes) | `public_html/api/` |
| 3 | `summit-de59ae83/index.html` (**464,568** bytes) | `public_html/summit-de59ae83/` |
| 4 | — | Flush the cache |

## ✅ LIVE 2026-10-04 (verified 17/17) — Hail (admins only): storms since 2020 and the streets they hit. Page identical at three addresses; hail files not reachable on the website; hail on in company.json; the Hail list needs a sign-in and matches this computer (96 storm days, 1,275 days read); a Castle Rock neighbourhood's 42 doors carry their storms; the screen, the storm, the neighbourhood and the door's hail line all work on a phone; no page errors. Crew refusal is tested locally only (no throwaway crew code on the live site)

Matthew 2026-10-04: the first roofing piece, for him to evaluate. NOAA's radar estimate of the largest hail within about 1 km of each house, per day, April–September 2020 to 30 Sep 2026 (1,275 days read; 6 not in the archive). 96 storm days at ¾ in or more near our doors, 54 at 1 in or more; the largest 2.74 in on 22 June 2023. **Admins only**: a Hail tile (storm days newest first; tap one for the neighbourhoods it hit, tap a neighbourhood to open it) and a hail line on each door card, labelled a radar estimate. Crew get neither (the server leaves it out of their answers). Switched on by `features.hail` in company.json. Tested: hail-test 14/14 (crew refused, admins get it, off in company.json means off for everyone).

| Step | File (from `door-app/site/`) | Goes to |
|---|---|---|
| 1 | `data/rounds/hail-storms.json` and the 11 `data/rounds/hail-<town>.json` (**3.6 MB** together; gitignored, on this computer) | `sixfold-data/rounds/` — beside monument.json, never inside public_html |
| 2 | `data/rounds/company.json` (**1,737** bytes: hail switched on) | `sixfold-data/rounds/` (replace) |
| 3 | `api/rounds.php` (**191,808** bytes) | `public_html/api/` |
| 4 | `summit-de59ae83/index.html` (**460,599** bytes) | `public_html/summit-de59ae83/` |
| 5 | — | Flush the cache |

Not automatic yet: new storms need `node door-app/operations/door-territory/hail/build-hail.mjs fetch` then `build`, and the hail files uploaded again.

## ✅ LIVE 2026-10-04 (verified 17/18) — company settings (company.json): nothing about Sixfold in the code any more. index.html and sw.js identical; action=company answers with Sixfold's file from beside the door files (not reachable on the website); a fresh phone shows Sixfold and the Ridge mark; Quote builder, Communities, Skip trace, Extra work (Sixfold's list) and Fire check all present; no page errors. The 1 fail was the check looking for Book the walk on a door that was not booked (that button only shows after Quote booked): not checkable read-only. ⏳ The next morning email should still end with the app link

Matthew 2026-10-04: the app is his product, so the company it runs for is a settings file, not code. Sixfold's name, phone, email, Ridge mark, services, enquiry list, extra-work list, "yard walk", review link and which tools it uses (Quote builder, Communities, fire check, skip trace) now come from `company.json` beside the door files. **For Sixfold nothing should look different.** See [../../README.md](../../README.md) for every setting. Tested: settings-test 21/21 (runs as Sixfold, then as the made-up roofer in `door-app/company.example.json`, then Sixfold again); all 67 suites pass alone.

**⚑ Step 1 first.** Without company.json the app calls itself "Door App" and hides the Quote builder, Communities and fire check.

| Step | File (from `door-app/site/`) | Goes to |
|---|---|---|
| 1 | `data/rounds/company.json` (**1,963** bytes) | `sixfold-data/rounds/` — beside monument.json, **never inside public_html** (not secret, but it is install data) |
| 2 | `api/rounds.php` (**190,677** bytes) | `public_html/api/` |
| 3 | `summit-de59ae83/index.html` (**454,060** bytes) | `public_html/summit-de59ae83/` |
| 4 | `summit-de59ae83/sw.js` (**6,570** bytes) | `public_html/summit-de59ae83/` |
| 5 | `tools/morning-email.php` (**6,850**) and `tools/nightly-backup.php` (**3,966**) | `sixfold-tools/` |
| 6 | — | Flush the cache |

Check after: the sign-in screen says Sixfold with the Ridge mark; the tools screen still has Quote builder and Communities; a door's Add info still has Extra work and Fire check; tomorrow's morning email still ends with the app link.

## ✅ LIVE 2026-10-04 (verified 13/14) — who is signed in (Accounts screen). Page identical at all four addresses; accounts answer carries the list, no codes or tags; the list file 404s from the web; the screen shows the count, the note and a green Claude Check row. The one fail was the check script not signing its own browser out: a stray Claude Check iPhone line, cleared by Sign out on that row

Matthew 2026-10-04: signing someone out gave no sign it worked, and nothing said who was signed in. Each account row now shows a green dot and **Signed in on iPhone · used 5 min ago** (several devices are listed), or a grey dot and **Signed out · just now** / **Not signed in**; the top line counts who is signed in now. The server keeps one line per sign-in in `sixfold-private/rounds-sessions.json` (made by itself; it holds no code and no cookie, only a hash tag, the device kind and when it was last used, written at most every 5 minutes). Sign out on the phone removes its line; an admin's Sign out, New code or Remove removes all of that person's. **Phones signed in before the upload show up the next time they are used**; the screen says so for the first 45 days. Also fixed: two sign-ins in the same second got the same cookie, and a sign-out in the same second as the sign-in did not take. Tested: whosin-test 17/17, accounts 34/34, all 65 suites pass alone (aerial needed one re-run: a timing flake, 9/9 alone).

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `api/rounds.php` | `public_html/api/` (**187,927** bytes) |
| 2 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` (**450,153** bytes) |
| 3 | — | Flush the cache |

## ✅ LIVE — Fast People Search as the main search (index.html only, **448,590** bytes, to `public_html/summit-de59ae83/`, no flush)

Matthew 2026-10-04: Fast People Search is the main green button, True People Search the backup link; a tip line says to tap View Free Details, not the name or a "full report" link (those went to BeenVerified / TruthFinder). Saved numbers default to Fast People Search as the source. lookup-test 13/13.

## ✅ LIVE 2026-10-04 (verified 15/15 once the mail files were in place) — Look up number + skip-trace code.

**⚑ Incident 2026-10-04:** the 11 mail-*.json (owners' mailing addresses) were first uploaded into **public_html/api/**, where they downloaded publicly (200, 721 KB for Monument). Matthew deleted them there, re-uploaded to sixfold-data/rounds/ and flushed; afterwards the public URL returned SiteGround's 403 block page to Claude (its checks had tripped the bot block), so the removal was confirmed by Matthew opening the URL in a private window. **Mail files and any data file go BESIDE public_html, never inside it.** ⏳ Step 4 (the 11 mail-*.json) NOT yet on the server: doors have no city/ZIP, so the searches use the town name with no ZIP

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` (**448,158** bytes) |
| 2 | `api/rounds.php` | `public_html/api/` (**183,141** bytes) |
| 3 | `api/skiptrace.php` | `public_html/api/` (**33,762** bytes) — **must go up with step 2: rounds.php now loads it, and without it the app stops** |
| 4 | `data/rounds/mail-*.json` (11 files, gitignored, on this computer) | `sixfold-data/rounds/` — the city and ZIP for each door, so the search is filled in exactly. Without them the search uses the town name and no ZIP |
| 5 | — | Flush the cache |

**Look up number** (Matthew 2026-10-04): a door with no number shows **Look up number**; it opens the phone form with the owner of record and the full address (city and ZIP), each with Copy, and **Search True People Search** / or **Fast People Search**, opening in a new tab with the address filled in. Tapping a search sets the source to that site and last seen to this month; the person types the number and saves. It shows on the card for everyone, as looked up, with the Do Not Call warning. **The app never reads the sites**: one door at a time, a person reads and types. The two link formats could not be checked from here (both sites block automated requests); the first live tap confirms them. Tested: lookup-test 12/12; skiptrace, ui2, batch, crew, offline, security, owner suites pass. **Skip tracing (BatchData)** goes up in the same files but does nothing until sixfold-private/skiptrace-config.php has a key; admins see its screen saying so.

## ⏳ TO UPLOAD — skip tracing (owner phone numbers from BatchData), admin only, DNC-gated. NOT COMMITTED YET

Built 2026-10-04 on Matthew's request. Nothing runs until the provider key is on the host, and nothing is bought
without a dry run first. **Every number a provider returns is looked up, not given:** hidden from call lists and
the export until the provider says it is not on the Do Not Call list; one manual Call link per cleared number;
nothing dials or texts. BatchData is a licensed, paid data service; this is not the people-search scraping Claude
declined to build on 2026-10-01 (that stays declined, and the rounds.php comment now says whose call it was).

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `api/skiptrace.php` (**new**: the provider seam, the BatchData adapter, the batch runner, the rule) | `public_html/api/` |
| 2 | `api/rounds.php` | `public_html/api/` (requires skiptrace.php; four new admin actions: `skiptrace`, `skiplist`, `skipexport`, `skippick`) |
| 3 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` (Skip trace tile and screen; the door card's result block; a `trace` phone source) |
| 4 | `tools/skip-trace.php` (**new**, the command-line run) | **`sixfold-tools/`** beside nightly-backup.php, NOT inside public_html |
| 5 | `data/rounds/mail-<town>.json` × 11 (**new**, built by `operations/door-territory/build-mail-sidecar.mjs`: owner mailing address + property city/ZIP per door; gitignored like the CSVs) | **`sixfold-data/rounds/`** beside the door files |
| 6 | `api/skiptrace-config.example.php` → fill in → save as **`sixfold-private/skiptrace-config.php`** | **`sixfold-private/`** (the key never goes in public_html, never in git; the bundle refuses both files) |

Flush after step 3. **A 500-door test:** sign in as admin → Field tools → Skip trace → pick the town → **Dry run**
(nothing sent; counts the people, flags companies / trusts / HOAs / government, says the cost at the price in the
config) → **Look up N doors** (a chunk of 100 per request, the page loops) → the list shows cleared numbers only
by default; **Download CSV (cleared numbers only)**. Or on the server: `php sixfold-tools/skip-trace.php
--town=monument --limit=500` (dry), add `--go` to send, `--export > cleared.csv`. Results: `sixfold-data/rounds/
skiptrace-<town>.log` (append-only, newest line per door wins; a door is never bought twice without `force` / `--force`);
errors in `skiptrace-errors.log`. Tested: skiptrace-test (API, CLI, page) + skiptrace-unit.php (adapter, mocked
responses); see the report of 2026-10-04.

## ✅ LIVE 2026-10-04 (verified 16/16) — Look switch, install button, Your territories, territories ON, Unassign all

Verified read-only: app identical at all four addresses; Unassign all answers; Territories carries the active list; 1 neighbourhood assigned; nightly backups 1 copy; on an iPhone browser the sign-in shows Add Sixfold to your Home Screen with the four steps; Look switch turns the app dark; Territories screen shows Unassign all; no page errors. The crew-side view of an assignment needs a crew sign-in to see.

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` (**424,151** bytes) |

| 2 | `api/rounds.php` | `public_html/api/` (**171,030** bytes): `TERRITORIES_OPEN = true` (Matthew 2026-10-04) |

Flush after step 2. **Unassign all** per person on the Territories screen (new `unassignall` action, admin, every town at once) and **No longer signs in** on anyone removed in Accounts who still holds neighbourhoods (territories now returns `active`); unassign-test 14/14. **Territories on:** the crew now see assignments; with nobody assigned, nothing changes for them. **Look:** Auto / Light / Dark on the tools screen, kept per device (localStorage sixfold.theme); Auto follows the device, as before. **Install:** the sign-in screen (and the tools screen until installed, Not now = 14 days) offers Install the Sixfold app where the browser has an install box (Android, Chrome/Edge on a computer: one tap), and on iPhone/iPad the four taps (Safari, Share, Add to Home Screen, sign in again). **Your territories:** on the tools screen, every neighbourhood assigned to you across towns with progress, tap to open; the Colorado overview counts yours per town. Tested: full run 61 suites / 1,090 checks with the switch off, then territory, board, lookinstall, crew, state, ui2, view, batch and odds suites with it on (the two checks that asserted the crew see nothing now check what they see).

## ✅ LIVE 2026-10-04 (verified 27/27) — leads, morning email, sign-out fix, aeration wording, smaller jobs. ✅ First nightly backup made 2026-10-05 00:04 UTC (sixfold-backup-2026-10-04.json.gz, 2,219 bytes): the server clock is UTC and the cron path is right. Morning-email cron added by Matthew (hourly); ✅ first email ARRIVED at Contact@ 2026-10-04 evening (Matthew confirmed) — file location, cron path and Gmail sending all work. ⏳ Still to confirm: submit.php's Linktree tagging is confirmed only by a real enquiry through the button

Verified read-only: every public file identical plain and cache-busted (app at both addresses, sw.js, contact page, site.js; quote.html unchanged); Meta import and the digest answer; money.json has the review link and the corrected aeration wording; the contact page carries via=linktree; Pipeline shows Import leads from Meta; the Water line reads "Aeration: water before and after"; morning-email.php not reachable from the web; no page errors. The contact form was not submitted.

| Step | File (from `sixfold/site/`) | Goes to | Bytes |
|---|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` | 414,548 |
| 2 | `summit-de59ae83/sw.js` | `public_html/summit-de59ae83/` | 6,526 |
| 3 | `api/rounds.php` | `public_html/api/` | 169,754 |
| 4 | `api/submit.php` | `public_html/api/` | 14,563 |
| 5 | `contact/index.html` | `public_html/contact/` | 11,394 |
| 6 | `assets/site.js` | `public_html/assets/` | 4,140 |
| 7 | `data/rounds/docs/money.json` | `sixfold-data/rounds/docs/` | 24,894 |
| 8 | `tools/morning-email.php` | `sixfold-tools/` | 6,745 |
| 9 | — | Flush the cache | |
| 10 | — | SiteGround → Devs → Cron Jobs → second job, **Once Per Hour**: `php /home/customer/www/sixfoldcolorado.com/sixfold-tools/morning-email.php` | |

The sections below explain each part. **Smaller jobs (in steps 1–3, 7):** *Ask for a review* on a customer's page
(texts their number the Google review link by first name; hidden while `links.googleReview` in money.json is empty; Matthew supplied
https://g.page/r/CdxyzSzq9tvEEBM/review on 2026-10-04, so it ships switched on); *Route for today* in Due this week (today's and overdue visits, plus visits booked today, in
driving order in Google Maps; door customers by their door's spot, rounds.php's customers answer now carries `ll`);
customers ringed on the Map view with a legend key; the customer list kept on the phone for no signal (sw.js KEEP
gains `customers`; wiped at sign-out like the rest). Tested: smalljobs-test 10/10.

## ⏳ (same upload) — the morning email: one new file and a second cron job

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| A | `tools/morning-email.php` | `sixfold-tools/` (beside `nightly-backup.php`) |
| B | — | SiteGround → Devs → Cron Jobs → a second job, interval **Once Per Hour**: `php /home/customer/www/sixfoldcolorado.com/sixfold-tools/morning-email.php` |

It runs every hour and sends once a day, at the first run at or after 6 am Colorado time (so the server's clock
doesn't matter), to Contact@ through the website form's own Gmail login (api/config.php + smtp.php; it never sees
the password). Contents: leads still New, walks today and tomorrow, customers due within 7 days (overdue first),
yesterday per person. The figures come from rounds.php's new `digest` action, asked from the command line only
(a web request is never 'cli'; crew get 403, no sign-in 401). State in `sixfold-data/digest/` (last-sent.txt,
digest.log with the send stage). To test it straight away: `... morning-email.php --now` as a one-off command, or
`--dry-run` to print it without sending. Tested: digest-test 17/17.

## ⏳ TO UPLOAD — every lead into the Pipeline: Linktree tagged, Meta import (plus the money.json below)

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` |
| 2 | `api/rounds.php` | `public_html/api/` |
| 3 | `api/submit.php` | `public_html/api/` |
| 4 | `contact/index.html` | `public_html/contact/` |
| 5 | `assets/site.js` | `public_html/assets/` |
| 6 | `summit-de59ae83/sw.js` | `public_html/summit-de59ae83/` (**6,450** bytes) — a privacy fix, see below |
| 7 | — | Flush the cache (the contact page and site.js are cached like any page) |

Sizes: `index.html` **410,988**, `rounds.php` **165,714**, `submit.php` **14,563**, `contact/index.html` **11,394**,
`site.js` **4,140**.

**Linktree:** the contact form has a hidden `via` field that site.js fills from the link, and submit.php files the
lead under that source (only linktree, nextdoor or meta; anything else stays Website). The email to Contact@ gains a
"Via:" line. Linktree's quote button should point at
`https://sixfoldcolorado.com/contact/?need=lawn&via=linktree` (Matthew changes it in Linktree).

**Meta:** Pipeline → "Import leads from Meta" reads the file downloaded from Leads Center (CSV, comma or tab, UTF-8 or
UTF-16; an Excel file is turned away with a message), previews it, and adds the leads on a tap via the new
`leadimport` action (admin): source Meta ad, dated when they filled the form, campaign as the need, their answers in
the message, organic leads marked. Meta's lead id is kept, so the same file twice adds nothing; someone already in
the Pipeline by phone or email is counted, not added. Up to 500 at once.

Tested: leadimport-test 25/25; leads, pipeline, customers, security, fable2, backup suites pass.

**sw.js (privacy fix, found by the full test run):** on sign-out the phone wipes its saved copies of server answers (names and addresses; shared iPads). The service worker took its "has anyone signed out?" reading when an answer ARRIVED, so a slow answer that finished after a sign-out looked fresh and was saved again. The money sheets grew with the water rules and now often finish after a quick sign-out, which is how the test caught it; the live site has had this window since the water upload. Now the reading is taken when the request STARTS, and checked again after saving. Full run: 58 suites, 1,042 checks, all pass with the fix (sw-test 5/5 alone).

## ⏳ (same upload) — corrected aeration wording (money.json only)

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `data/rounds/docs/money.json` | `sixfold-data/rounds/docs/` |

No flush needed (it is read after sign-in, not cached). The card said "Aeration needs no watering"; CSU Extension says water the day before and soon after, and don't aerate a lawn brown or dormant from restrictions. Now: "Aeration: water before and after", a new opening line on the water sheet, an "Aeration and water" block and a Don't-say line on the Say tab. The well-town "sell aeration, mowing or cleanup" lines are unchanged: Brandon's call.

## ✅ LIVE 2026-10-04 (verified 15/15) — cleanup + water rules + nightly backups. cron job SET UP 2026-10-04 by Matthew (Once Per Day, 0 0 * * *, server clock); ⏳ confirm the first nightly copy appears

Verified: page identical at all four addresses, money.json carries the water rules, backups list answers, the job is not reachable from the web, the Water line and sheet work on a Woodland Park door, Keep a copy shows the nightly section ("none yet"). Whether nightly-backup.php sits in the right folder can only be confirmed by the first nightly copy appearing.

### the backup steps

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| A | `tools/nightly-backup.php` | a NEW folder `sixfold-tools/` beside public_html (the same level as `sixfold-data` and `sixfold-private`), NOT inside public_html |
| B | — | SiteGround Site Tools → Devs → Cron Jobs → add a job (below) |

The cron job, once a night:

    php /home/customer/www/sixfoldcolorado.com/sixfold-tools/nightly-backup.php

That path is SiteGround's usual layout; check it against the folder path File Manager shows for the folder that
holds public_html, and change the middle if it differs. Interval: once a day (any night-time hour). After the first
run, Customers → Keep a copy lists "Nightly copies on the server"; until then it says the job isn't running.

What it does: every night it writes `sixfold-data/backups/sixfold-backup-YYYY-MM-DD.json.gz` (the same contents as
Download a full backup, compressed) and keeps the newest 30; each run adds a line to `backups.log` there. It refuses
to run from a browser. The app lists the copies under Keep a copy (any can be downloaded, as the same JSON as a
fresh backup) and, when nobody has saved a copy to a device for 7 days, shows admins a reminder at the top of the
tools screen ("Last backup saved N days ago", tap to download). make-bundle.mjs leaves `tools/` out of the
website bundle.

## ⏳ (same upload) — water rules on the door card, plus the cleanup below

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` |
| 2 | `api/rounds.php` | `public_html/api/` |
| 3 | `data/rounds/docs/money.json` | `sixfold-data/rounds/docs/` (beside public_html, NOT inside it) |

Sizes: `index.html` **403,073**, `rounds.php` **162,892**, `money.json` **23,956**, `nightly-backup.php` **3,837**. Flush after step 2.
quote.html unchanged.

**Water** (Matthew 2026-10-04): a Water line under the Money line on every door card: "Aeration needs no
watering", the town's provider rule, and in the six mostly-well towns the well rule for that lot size (none of
their 13,061 doors is 35+ acres, so all say a well may not water a lawn). Tap for a sheet: This town · Wells ·
Permits · Say. Content in money.json under `water`, from sixfold/research/water-restrictions-2026.md (checked
2026-09-30); no server change. If money.json isn't uploaded, the Water line simply doesn't show.

## ⏳ (same upload) — tighter code (Fable's cleanup; nothing the app does changes)

`index.html` was **396,493** after the cleanup (from 414,896), `rounds.php` **161,059** (comments only).

Removed from the page: every old-layout branch (the `S.ui2` flag is gone; `html.ui2` is set in the markup and the
`.ui2` CSS prefix stays because the cascade was tuned with it), the retired Leads and Quotes-to-build screens
(`leadsView`, `quotesView`, `drawQuotes`; the Pipeline replaced them), the Leaderboard's old assign card
(`territoryCard`, `assignArea`; Territories replaced it), `moneyRow`, `addLink`, `alsoStreets`, duplicate helpers
(`dollars` → `money`, `MON` → `MONTHS`, `metresTo` → `legM`, `satLink` → `googleSat`), unused CSS and stale
comments. The tools screen is built directly in its final order instead of built twice and regrouped (one leads
count request instead of two). Two Back targets that pointed at the retired Quotes screen now go to the Pipeline.
The server's `assign` action stays (a write action) though nothing in the app calls it now.

Tested: all 55 suites, 985 checks, same as before the cleanup.

## ✅ LIVE 2026-10-04 — fixes from Fable's review of everything since e5c51f8 (verified 19/19: page identical at all four addresses, search asks for a street name, accounts file reads cleanly, the account lock was created in sixfold-private so that folder is writable, Customers and Door rounds open on a phone)

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` |
| 2 | `api/rounds.php` | `public_html/api/` |

Sizes: `index.html` **414,896**, `rounds.php` **161,262**. Flush after step 2. quote.html unchanged.

Server: a monthly plan's next due stays inside the month (31 Jan → 28 Feb, was 3 Mar), and is a month after the
visit unless that is earlier than it already is (a mow a day early still moves it; an old visit typed in late
doesn't pull it back). Search needs a street name and is counted per person (60 per 10 minutes), so a stolen phone
can't page through every address. A broken or unreadable `rounds-accounts.json` stops sign-ins (503) instead of
silently undoing every removal; account changes lock and re-read the file (a `rounds-accounts.json.lock` appears
beside it in `sixfold-private/`). Show PINs also counts against the site-wide wrong-code limit. Make customer skips
ended customers (a house that sold). The backup says app-made sign-ins aren't in it, and never sends an empty file.

Page: a slow Territories answer no longer empties Door rounds; save buttons ignore a second tap (sign-in, customer,
visit, Make customer); a customer that answers after you left doesn't take over the screen; Back after Make customer
returns to the Pipeline; the new code and PINs are forgotten when you leave Accounts; failed visit removals and
status changes say so; search asks for the street name; the lead note box is 16px.

Rebuilding the host from these notes: `summit-de59ae83/.htaccess` (Cache-Control private, keeps the folder out of
SiteGround's Dynamic Cache) goes in `public_html/summit-de59ae83/` with index.html.

## ✅ LIVE 2026-10-04 — Customers (the CRM) and the full backup (verified 25/25: page identical at all four addresses, every action answering, backup downloads with 9 logs and no codes, Customers screen opens on a phone)

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` |
| 2 | `api/rounds.php` | `public_html/api/` |

Sizes: `index.html` **413,028**, `rounds.php` **158,030**. No flush needed for step 1 (the folder skips the Dynamic
Cache); flush after step 2 to be safe. quote.html is unchanged.

Also in this upload: a save made on the Pipeline (a lead's status or note) refreshes the list in place instead of
blanking it while the door bookings reload, and the Undo toast stays up.

**Customers** (admin tile, Office): every customer with contact, service, plan (one-off, monthly, yearly, custom),
price, customer since, next visit due, status (active, paused, ended), an agreement link (https only) and notes.
Due this week at the top, overdue marked. Each customer has a visit history (date, service, price, done or booked,
note, who) with Log a visit; a done visit on a monthly or yearly plan moves next due on by itself. **Make customer**
on a won door booking or a won lead in the Pipeline carries the name, address, town, won price and a door-given
phone or email across; a second tap opens the same customer. A door that belongs to an active customer shows a dark
**Customer** tag, for crew too. Stored in `sixfold-data/customers/` (`customers.log`, `visits.log`), beside
public_html, created by the server on the first save: the same parent folder as `sixfold-data/leads/`, which already
works live.

**Keep a copy** (bottom of Customers): **Download customers** (CSV) and **Download a full backup**: one JSON file with
every log in `sixfold-data/rounds/`, `leads/` and `customers/` plus goals.json, each under the path it came from,
photos listed by name, no sign-in codes. Rebuilding is putting each file back at its path. Each backup is logged in
`rounds-accounts.log` with who took it.

Tested: all 54 suites, 965 checks; customers-test 57/57 (API, refusals, visits, due dates, from a door, from a lead, the door tag, CSV, backup
contents, no codes in the backup, the page). Live check after upload: tile, list loads, backup downloads; adding a
real customer is Matthew's call.

## ✅ LIVE 2026-10-04 — Accounts, Territories, sign a person out, show PINs, Door rounds opens on Colorado (verified 16/16 at the folder address the phones open; summit-de59ae83/.htaccess keeps the folder out of SiteGround's Dynamic Cache, so uploads there need no flush; Quote builder is linked as quote.html?v=<fingerprint>)

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` |
| 2 | `api/rounds.php` | `public_html/api/` |
| 3 | — | Flush the cache. |

Sizes: `index.html` **389,654**, `rounds.php` **142,784**.

**Accounts** (admin tile): add a person (name, crew or admin; the code is shown once, with Text it and Copy), Change
(rename, crew/admin), New code, Sign out (their phone is signed out, the code still works), Remove (signed out at
once, everything they recorded stays), Turn back on. Show PINs asks for your own code, shows every PIN until you leave
the screen, and is logged. The codes file is never edited: app-made sign-ins and changes are kept in
`sixfold-private/rounds-accounts.json` (+ `rounds-accounts.log`), beside it, outside public_html. **PHP must be able to
write to `sixfold-private/`**; if Add a person says "Could not save that", that folder needs write permission.

**Door rounds opens on Colorado**: the three counties with their towns (doors to knock, progress, high-risk doors, quotes), tap a town for its neighbourhoods; the town picker lists "Colorado · all towns" first; Back from a town goes to Colorado; Nearest town finds the closest. Counties come from money.json.

**Territories** (admin tile): assign neighbourhoods to people (person, town, tick several), by person with progress,
x to unassign. Moved off the Leaderboard. The crew see nothing of it until `TERRITORIES_OPEN = true` in rounds.php
(Matthew: crews may not always have territories); then each person sees theirs marked Yours, with Only mine.

## ✅ LIVE 2026-10-04 — the new layout for everyone, search, Pipeline (verified 14/14)

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` |
| 2 | `summit-de59ae83/quote.html` (now "Quote builder") | `public_html/summit-de59ae83/` |
| 3 | `api/rounds.php` (address search) | `public_html/api/` |
| 4 | — | Flush the cache. |

Sizes: `index.html` **361,989**, `quote.html` **110,298**, `rounds.php` **128,891**.

What changes for the crew: the new layout is the only layout (the switch is gone): one door open at a time, Add info,
a yes opens everything, the money line as pills, the three-driver filter, motion, the contour look. Address search on
the tools screen and in the town bar. Default sort Lawn (Odds once it is on), plus a Doors sort. Admins: one Pipeline
tile instead of Quotes to build and Leads. The search index (`search-index.txt`) builds itself in `sixfold-data/rounds/`
on the first search; nothing to upload for it.

## ✅ LIVE 2026-10-04 — the new layout (off by default), phone no-zoom, Fable fixes, every town's lawn outlines (verified 16/16)

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` |
| 1b | `summit-de59ae83/quote.html` (no double-tap zoom on phones) | `public_html/summit-de59ae83/` |
| 2 | `api/rounds.php` | `public_html/api/` |
| 3 | `data/rounds/docs/money.json` (adds the one-line "cards") | `sixfold-data/rounds/docs/` |
| 4 | the 8 new lawn outline packs from `data/rounds/`: `lawnmask-castle-rock.json` (4,081,889), `lawnmask-franktown.json` (1,957,117), `lawnmask-sedalia.json` (613,226), `lawnmask-larkspur.json` (562,790), `lawnmask-woodland-park.json` (174,462), `lawnmask-divide.json` (11,699), `lawnmask-florissant.json` (5,289), `lawnmask-cripple-creek.json` (268). Monument, Palmer Lake and Black Forest are already live and unchanged | `sixfold-data/rounds/` |
| 5 | — | Flush the cache. |

Sizes: `index.html` **313,001**, `quote.html` **110,290**, `rounds.php` **125,302**, `money.json` **10,238**.

**Fable review fixes (2026-10-04):** undoing a booking no longer hides the + buttons; no calendar link with no signal; map pins open the full card in the new layout; calendar lines within 75 octets. **To test on the iPad:** from the home-screen app, Homeowner report → Print or save as PDF — Fable thinks iOS may ignore it there.

**Phones (both layouts):** two quick taps on a key no longer zoom the page, and text boxes are 16px on touch screens so iPhones stop zooming into them.

Nothing changes for anyone until they pick **Layout: New** at the bottom of the tools screen (remembered per phone).
The new layout: one door open at a time (the next to knock), the rest one line each with their chips; "Add info"
opens phone, email, photos, note, extra work and fire check in one panel; Quote booked opens the walk plus all of
those and stays until "Done with this door"; a money line saying what the door qualifies for (tax credit, insurance,
the county's grant; a company owner is sent to an accountant); "Show doors with" High fire / Large or medium lawn /
Trees close, all picked = only doors with every one; the tools screen grouped In the field / Office. In either
layout, neighbourhoods now show how many doors have all three drivers.

## ✅ LIVE 2026-10-03 — the whole competitor-audit list (SX-48..54), verified 19/19 (still to upload: the lawn outlines as they finish)

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` |
| 2 | `summit-de59ae83/quote.html` (regenerated from the quote engine source, SX-52) | `public_html/summit-de59ae83/` |
| 3 | `api/rounds.php` | `public_html/api/` |
| 4 | the `data/rounds/lawnmask-<town>.json` files finished since the last upload (Black Forest's live copy is partial) | `sixfold-data/rounds/` |
| 5 | — | Flush the cache. No one signs in again. |

Sizes to check after upload: `index.html` **296,424** bytes, `quote.html` **110,003** bytes, `rounds.php` **124,799** bytes.

**Around our jobs (SX-48, after GlassHouse).** A strip on each town's list: jobs won there in the last
60 days, each with the 40 nearest doors still to knock within half a mile, a route from the job, and
an opener that names the street, never the house or the customer. Won quotes get "Knock around this job".

**Fire-weather call list (SX-49, after HailTrace, admin).** When an alert covers a town or a wildfire
is within 30 miles, the alert details offer a call list: customers won, quotes sent and booked doors
there, with the number given at the door and a check-in script. A check-in, not a pitch.

**Homeowner fire check (SX-50, after Firemaps / Fire Aside).** "+ Fire check" on any door card: 17 items
from the Colorado State Forest Service Home Ignition Zone guide (2021), each Done / Needs work / Couldn't
check, plus a note. Every check is kept; a second check after the job shows Before and Now side by side.
"Homeowner report" opens a one-page report (what to do first, in the guide's order, the first 5 ft
before the house itself; the full check; the door's photos; how to use it with an insurer under
HB25-1182 and for the DR 0104CR tax credit) with Print or save as PDF. It says plainly it is a visual
check, not an inspection, certification or guarantee. Saves with no signal like everything else; the
export gains a `fire_check` column.

**Book the walk (SX-51, after KnockBase / Knockio).** Tapping Quote booked opens "Book the walk" at the top
of the list: a day and a time (or time to agree), with the walks already booked that day underneath so
two walks don't land on top of each other. Then "Add to calendar" (reminders a day and an hour before)
and "Text a confirmation", sent from the crew member's own phone and only to a number given at the
door. Quotes to build lists the walks coming up; the export gains a `walk` column.

**Measure from the lawn outline (SX-52, after SiteRecon / Beam AI).** "Build quote" on a booked door now
opens Quote build with the door's lawn: counted near the house and all the grass, in square feet and
acres, from the outline on the aerial photo. "Use" fills aeration (or the lawn lines already counted);
nothing is filled in on its own, and the scope draft says where the area came from.

**Leaderboard, daily goals, territories (SX-53, admins only while tested).** A new admin tile: ranked by
quotes booked (today, 7 days, 30 days), progress against one daily goal per person, and neighbourhoods
assigned to people, which show on the neighbourhood list. No location tracking. To show it to the crew
later: `BOARD_OPEN = true` in rounds.php, one upload.

**Odds (SX-54).** A sixth sort on the neighbourhood list: most quotes expected from the doors still to
knock, at the rate our own doors like them have booked. Admins see it now with how many conversations
it still needs (150); the crew get it once it is ready.

---

## ✅ DONE 2026-10-03 (second batch) — Fable's live-review fixes, extra work, results, lawn photos, tips, communities, alerts

Matthew 2026-10-03: batch the updates into one upload rather than one per feature; do it before
Monday's team meeting with whatever is finished.

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` |
| 2 | `api/rounds.php` | `public_html/api/` |
| 3 | `data/rounds/hoa-communities.json`, `data/rounds/cwpp.json` and the 11 `data/rounds/lawnmask-<town>.json` | `sixfold-data/rounds/` (beside the door files; never empty that folder) |
| 4 | — | Flush the cache. No one needs to sign in again. |

**Lawn on the photo (SX-38).** Tapping a lawn size now offers "See the lawn on the photo": the 2023
aerial with the lawn the size counted shaded green and the grass left out shaded blue, with the
square footage and the photo date. Large lawns also show their summer greenness (2025 vs 2026) and
the clear satellite dates used. Built by `lawn-trial/build-lawn-outlines.mjs` for every Medium and
Large lawn; the packs are gitignored (regenerable, about an hour).

**Tips on the stats page (SX-39).** Up to three tips from the person's last 30 days, each with the
number it came from (no-answer share, booking rate, contact details, photos). Thresholds are
rules of thumb chosen 2026-10-03, not measured targets; shown after 20 doors.

**Communities (SX-40, admin).** Subdivisions, metro districts and Firewise sites ranked by
high-risk doors still to knock, with lawns, trees, typical county value, knocked/booked, and the
HOAs matched by name from the state roster (name, units, management company — no agents or
addresses). Each opens its neighbourhoods.

**Alerts (SX-41).** A strip on the tools screen and on each town's neighbourhood list: red flag
warnings, fire weather watches, heat, air quality, smoke and high wind from the National Weather
Service, and wildfires (not prescribed burns) within 60 miles that are not fully contained, from
the national interagency incident feed; a fire shows on a town's list within 30 miles of it. The
server checks at most every 10 minutes (`sixfold-data/rounds/alerts-cache.json`, made by itself).
Tap for details and the standing line: never knock inside an evacuation area; after a scare, lead
with help. No fire-season countdown: on the Front Range the season is effectively year-round, and
the warnings are the real trigger. Email alerts would need a SiteGround cron job — not set up.

**County plan ratings (SX-47).** 62 Teller neighbourhoods (28 communities) carry their rating from
the Teller County CWPP 2025 (Colorado State Forest Service, Tables 7-11): a "County plan: Extreme /
Severe / High" chip on the neighbourhood card, and in Communities the plan's own community name and
fire district, so the match can be checked. Matched by name; a partial match needs two words.
El Paso and Douglas are not in: Douglas's county plan is from 2011 and El Paso's current plan was
not found yet.

**Route (SX-44).** A Route button in each neighbourhood orders the doors still to knock into a short walking loop from where you stand (nearest-next, then uncrossed), with the distance and an "Open the first 10 stops in Google Maps" walking link (Google takes about ten stops per link). Straight-line distances: a guide to the order.

**Jobber export (SX-45, admin).** "Download for Jobber (CSV)" in Quotes to build: the booked doors in Jobber's client-import layout (Full name, phone, email, street, town, CO, note, tags, Lead Source Other). No ZIP codes yet (the door data has none). Only matters if Jobber is adopted.

**Also in this upload:**

**Extra work at the door (SX-36).** "+ Extra work" on every card: tap what you saw (branches over the
roof, gutters, brush against the house, dead trees, irrigation, bare lawn, overgrown beds). One door,
several jobs. Saves with no signal; shows in Quotes to build and the export.

**Results (SX-37).** In Quotes to build, each booked door gets **Won** (with the job value) or **Lost**
(with a reason); they move to a "Won or lost" section. A new admin **Results** tile shows knocked →
booked → won by fire hazard, lawn, trees, county value, town and extra work. It fills up as quotes are
closed; rows with under 10 doors are greyed.

New logs `work-<town>.log` and `result-<town>.log` appear in `sixfold-data/rounds/` by themselves.

**Also in this upload, from Fable's live review:**

From Fable's read-only review of the LIVE site, 2026-10-03 (nothing broken; these are clarity):
- **Neighbourhoods name their other streets.** 62% of doors are on a street other than the one in
  the neighbourhood's name. Each neighbourhood now says "Also Astrion Ct, Comet Ct and 7 more
  streets", and inside it the doors sit under a heading per street, the named street first.
  The names themselves are unchanged.
- "Map order" is now **"Big lots"** — it always listed biggest lots first, never a route.
- Back from a neighbourhood shows the list at once (was ~3 s with old cards still tappable).
- Trees count reads "22 doors with trees against the house"; "A few trees within 30 ft" where
  the cover is under 10% but not zero (was "No trees" beside a 26 ft tree).
- "Owner: Unavailable" (about 100 Douglas doors) reads "Owner: not on the public record".
- A lead's status change offers Undo; Quote build says "Needs signal" when offline; the empty
  stats chart counts in whole numbers.

| Step | File (from `sixfold/site/`) | Goes to |
|---|---|---|
| 1 | `summit-de59ae83/index.html` | `public_html/summit-de59ae83/` |
| 2 | `api/rounds.php` | `public_html/api/` |
| 3 | — | Flush the cache. No one needs to sign in again. |

Either order works (the page ignores the new street list until the server sends it).
Sizes to check after upload: `index.html` **222,992** bytes, `rounds.php` **81,839** bytes.

---

## ✅ DONE — the 2026-10-03 batch (kept for the record)

Built from a review of the whole batch (Fable, 2026-10-03). **Do it in the evening, when no crew
are out. Tell the crew beforehand: everyone types their code once after this.**

**0. Keep copies first.** In File Manager, download the live `public_html/api/rounds.php`,
`quote.php`, `submit.php`, `public_html/summit-de59ae83/index.html` and `quote.html`, and
the 12 `.json` files in `sixfold-data/rounds/`. These are the undo.

| Step | File (from `sixfold/site/`) | Goes to | Why this order |
|---|---|---|---|
| 1 | `summit-de59ae83/index.html` **and the NEW `summit-de59ae83/sw.js`** | `public_html/summit-de59ae83/` | Works with the old server too, so it goes first. `sw.js` is what lets the app open with no signal; it must sit beside index.html. Flush the cache; anyone with the app open closes and reopens it |
| 2 | `api/rounds.php` | `public_html/api/` | Everyone is signed out from this moment, and asked for their code |
| 3 | `api/quote.php` | `public_html/api/` | Needs the new rounds.php's sign-in, so after step 2 |
| 4 | `summit-de59ae83/quote.html` | `public_html/summit-de59ae83/` | Goes with quote.php (rates version) |
| 5 | all 12 `data/rounds/*.json` (11 towns + `index.json`) | **`sixfold-data/rounds/`** (beside public_html, never inside) | Needs the new rounds.php. **Overwrite only these 12 files. Never delete or replace the folder: the `*.log` files in it are every mark, note and number ever recorded** |
| 6 | `api/submit.php` | `public_html/api/` | Independent; `smtp.php` and `config.php` are unchanged |
| 7 | — | — | Check each uploaded file's size against the list below, then flush the cache again |

**Sizes to check after upload** (bytes; the File Manager may round to KB):

| File | Bytes |
|---|---:|
| `summit-de59ae83/index.html` | 204562 |
| `summit-de59ae83/sw.js` | 5960 |
| `api/rounds.php` | 72896 |
| `api/quote.php` | 10504 |
| `summit-de59ae83/quote.html` | 104099 |
| `api/submit.php` | 14088 |
| `sixfold-data/rounds/black-forest.json` | 2413222 |
| `sixfold-data/rounds/castle-rock.json` | 1904274 |
| `sixfold-data/rounds/cripple-creek.json` | 16347 |
| `sixfold-data/rounds/divide.json` | 153343 |
| `sixfold-data/rounds/florissant.json` | 108482 |
| `sixfold-data/rounds/franktown.json` | 419068 |
| `sixfold-data/rounds/index.json` | 909 |
| `sixfold-data/rounds/larkspur.json` | 184206 |
| `sixfold-data/rounds/monument.json` | 1921437 |
| `sixfold-data/rounds/palmer-lake.json` | 117976 |
| `sixfold-data/rounds/sedalia.json` | 162333 |
| `sixfold-data/rounds/woodland-park.json` | 740193 |

**Never upload:** `DEPLOY-ROUNDS.md` (it sits in the summit folder and would be public),
`build-quote-page.mjs`, `make-bundle.mjs`, anything in `dist/` (an old 2026-09-28 zip), and
`api/rounds-codes.php` / `api/secrets.php` (they live in `sixfold-private/`, never from the repo).
`make-bundle.mjs` builds the WHOLE site and cannot carry the door data, so this batch goes up
file by file.

**After uploading, check (all from outside, no sign-in needed except the last group):**
- the page: `/summit-de59ae83/` and `/summit-de59ae83/quote.html` give the same byte count plain and
  with `?cb=<random>` (a cached old copy is a false pass);
- must be **404**: `/data/rounds/monument.json`, `/api/rounds-codes.php`, `/api/secrets.php`;
- must be **401**: `/api/rounds.php?action=regions`, `/api/quote.php?action=me`;
- `/summit-de59ae83/sw.js` returns 200 and starts with `/* Sixfold Rounds — opens with no signal`;
- in the app: a phone that was signed in is asked for its code; mark a door, then sign in again
  when asked, and it is still marked; Palmer Lake shows 444 doors and Monument about 7,071; a door
  marked before the upload still shows its mark; note and photo dates read as dates;
- quote tool: an admin code opens Quote build, a crew code is refused;
- website form: send a test enquiry named "Smith, John"; check the email's Reply-To and that it
  appears under Leads, then mark it Lost;
- `sixfold-data/ratelimit/` now exists beside public_html.

**If something breaks:** put back the step-0 copy of that file (or `git show 406236b:<path>`).
The `.log` files are never touched by this upload.

**What would take the app down:** door files without the new rounds.php (958 doors lose sight of
their old-town marks until it goes up); rounds.php while crews still run the old page (their next
save is lost when signed out: reload first); quote.php before rounds.php (admins locked out of
Quote build until step 2); deleting the `sixfold-data/rounds/` folder (permanent loss); door JSON
inside public_html (31,000 names and addresses public); a truncated upload (check the sizes).

## ⚑ Opens with no signal (SX-34), when a house sells (SX-35), and the third round of reviews — 2026-10-03: `index.html` + NEW `sw.js` + `rounds.php` + door files

**Opens with no signal (SX-34).** A small service worker (`sw.js`) keeps the last copy of the
page, the sign-in, the towns and recently opened neighbourhoods. With signal nothing changes:
everything still comes fresh from the server, so an upload is never hidden behind an old copy
(the reason there was no service worker before). With no signal the app opens anyway, a strip
says it is a saved copy, and marks queue as before. **Signing out deletes the saved data**
(shared iPads), **with or without signal**: with none, the app also stays on the sign-in screen
and tells the server the moment signal is back. A saved copy older than 7 days is not shown, and
a "signed out" answer from the server wipes it too. After each save the open neighbourhood is
fetched again, so the saved copy shows the latest marks. The quote tool and all saves stay
online-only. Tested with the server really switched off: 15 checks.

⚑ **iPads: add the app to the Home Screen** (Share → Add to Home Screen). Safari deletes a
website's saved data after about 7 days without a visit; an app on the Home Screen is exempt.

**When a house sells (SX-35).** The door builder keeps `owner-history.json`. At the next
quarterly re-pull, a door whose owner shares no name with the last one gets "new owner since"
(a spouse added or a move into a family trust is not a sale). County records carry no sale date,
so the sale fell somewhere between the last pull that showed the old owner and this one:
- recorded more than 45 days before that last pull: **surely the previous owner's.** The door is
  back on the list, out of Quotes to build, and its old phone, email and note are labelled as the
  previous owner's, with no Call/Email buttons;
- recorded in the window around the sale: **could be either owner's.** It stays live (a Quote
  booked stays in Quotes to build), marked "check it's the new owner's".
The export keeps everything, with `owner_since` and `previous_owner_before` columns. **The first
build after this only records owners; changes show from the following re-pull.** 17 checks.
(Fable's review caught that the first version set aside everything before the re-pull — which
would have hidden a new owner's own Quote booked — and that its name check was broken by a lost
backslash, so every rewording read as a sale. Both fixed; the test now runs the builder's own rule.)
Also from that review: Quotes to build no longer shows "quote sent" for a sent date older than the
latest booking.

**Also in this batch (2026-10-03, later):**
- **Quote build shows what a fire customer can claim (SX-3).** On a Fire job, a panel under the
  price gives the tax-credit ceiling for that price, the county's grant position and the insurance
  rules, each with the lines the team may and may not say. The words come from the door app's money
  sheets, so the door and the quote never disagree. The scope draft carries them, with sources.
  Every card in Quotes to build has a **Build quote** link that opens the tool with the address as
  the job name and the county picked. `quote.html` is regenerated — it is step 4 of the upload.
- **County value on the door cards** ("County value $698k" beside the acres), Douglas and Teller
  only — El Paso's records carry none. The assessor's total for the parcel, from the state parcel
  composite (received from the counties Mar–Apr 2026). 13,884 doors, every Douglas and Teller one.
  In the export as `county_value`.
- **Fable's recheck of the fixes:** no HIGH findings. Fixed what it found: a sign-out now names
  the session it is for, so one sent late can never sign the next person out; a Wi-Fi sign-in page
  can no longer clear the signed-out flag; a sign-out gives up after 8 seconds; signal coming back
  no longer redraws over someone typing; a week-old saved copy is deleted, not just hidden; more
  record words ("REVOC", "TTEE", ...) no longer hide a sale; the merge of two towns' rows is one
  consistent order. `owner-history.json` is kept out of git (named owners) — it cannot be rebuilt,
  so the OneDrive mirror is its backup.

**Third round of reviews (Fable: phone screenshots, stats and dates, iPad screenshots):**
- **Dates read "NaN undefined …"** on notes, emails, photos, Booked by and Quote sent since
  2026-10-02 (a function defined twice). Fixed.
- Stats: undo across the town split, "talked to" no longer counts no-soliciting doors, undo
  restores the previous mark (a mistaken tap no longer wipes someone's Not now), no-signal saves
  count on the day they were tapped, My doors files a door under its mark's day.
- Clearer on a phone: 44 px tool buttons, roomier Money row, outlined No answer, bigger map dots
  and zoom, bigger Leads buttons, plainer labels (Owner:, No trees within 30 ft, 2023 photo).
- On an iPad: a **Back button in the bottom bar** (pinned to the left edge on a wide screen), the
  sign-in holds together, come-back dates in one row, tidier cards and stats chart.
- **Lawn levels count compact lawn only** (see LAWN-SIZE.md): specks between trees on big lots
  no longer read as a Large lawn. The door files carry the new levels.

## ⚑ One town per door (SX-32) — 2026-10-03: all 12 door files (incl. `index.json`) + `rounds.php` + `index.html`

**Upload these WITH `rounds.php`, never without it.** The new door files only work with the server
that knows to read the partner towns' logs.

The town search circles overlapped, so 958 doors were in two town lists at once: **every Palmer
Lake door was also in Monument**, and Castle Rock shared 136 doors with Franktown and 85 with
Sedalia. Each copy kept its own marks, so a door marked "Not now" under Monument still showed
as open under Palmer Lake, and its notes and phone numbers were split between the two.

**Now each door is in one town**, the town whose centre it is nearest to. Palmer Lake keeps 444
doors and 293 on the Monument side count as Monument; Castle Rock keeps its overlap with
Franktown and Sedalia where it is nearer. **No door id or address changed.**

**Nothing recorded is lost.** Everything already saved under the other town (marks, come-back
dates, notes, phone numbers, emails, lawn answers, photos, quote sent) follows the door: the server
reads each town's logs together with its partner towns' (named in `index.json` "shared"). A phone
still holding the old list can keep saving under the old town; the server files it under the
door's new town. A door that is on no town's list is refused, rather than saved onto nothing.

**What the crew will notice:** Palmer Lake is smaller (444 doors), Monument a little smaller
(7,071), and town totals change. Two Palmer Lake neighbourhoods are down to one door each,
scraps of the old overlap.

The rebuild check passed: 958 doors moved to a partner town, none lost, moved or renamed. Tested:
16 new checks (records made under the old towns, then the new files swapped in).

## ⚑ Security and save fixes from the reviews (SX-28) — 2026-10-03: `rounds.php` + `quote.php` + `api/submit.php` + `index.html`

From a read-only security review by a second model (Fable), every finding checked against
the code before fixing. Nothing critical. Fable then checked the fixes and found three more
things, also fixed below. The files and their order are in the NEXT UPLOAD checklist at the top.

**⚑ Everyone signs in once after this upload.** Sessions are now tied to the code itself, so
phones signed in before it are asked for their code again. Tell the crew before uploading.

**What changes for the crew:**
- **Removing someone's line in the code list now signs them out at once.** It used to leave
  their phone signed in for up to 45 days. A demoted admin loses admin straight away too.
  The session is tied to the person's CODE, not their name: two people with the same name
  stay separate, and renaming someone changes nothing. **Changing someone's code signs them
  out**, and they sign in with the new one.
- **A correct code no longer wipes earlier wrong ones.** It used to, which let one valid code
  buy unlimited guesses at the others. Wrong codes now just expire after 15 minutes. The
  29 September lockout stays fixed, because a correct code is still never counted.
- **If more than 60 wrong codes arrive in an hour from anywhere, new sign-ins pause** for up
  to an hour. The message says so and tells them to tell an admin. Each refused sign-in is
  written to `sixfold-data/ratelimit/paused.log`. **To lift a pause early, delete the
  `sixfold-data/ratelimit/` folder** in File Manager. Phones already signed in keep working. Someone could trigger this on
  purpose to stop new sign-ins for an hour; that is the trade for stopping guessing from many
  addresses at once.

**Also fixed:** the sign-in limit could be beaten by sending guesses all at once; IPv6
addresses are now grouped so one connection can't rotate through them, while IPv4 visitors
written in IPv6 form keep their own counters (otherwise every visitor could share one and
lock everyone out); the counters now live in `sixfold-data/ratelimit/`, outside public_html; door ids with a
trailing newline are refused; crew notes starting with = can't run as formulas in the admin
export; a website enquiry with broken characters no longer vanishes from both logs; Reply-To
works for names like "Smith, John" and shows accented names cleanly; very long names are
capped in email headers; and if the data folder outside public_html ever goes
missing, the app stops instead of quietly writing inside public_html.

**The quote tool** (`quote.php`) now uses the same code check, so a removed or demoted admin
loses it at once too. It was still trusting the cookie.

**Saving with no signal (`index.html`), from Fable's review of the save queue:**
- A save that reaches the server now beats an older one still waiting on the phone for that
  door. Before, the older one could be sent later and land on top (an Undo, or a "Quote booked",
  could be overwritten by a queued "No answer").
- A save refused because the phone was signed out is now kept and sent after the code is typed.
  It used to be thrown away, which would have lost every crew member's first save after this
  upload, since everyone has to sign in again.
- Each waiting change remembers who made it, and only sends while that person is signed in.
  Before, it went out under whoever signed in next on that phone.
- Only a real answer from our server can make the phone let go of a waiting change. A hotel
  Wi-Fi sign-in page or a firewall page used to empty the whole queue in one go.
- Signing out with changes still waiting asks first. Signing in sends anything waiting at once.

**Checked and already fine:** the site forces HTTPS (every plain-HTTP address redirects).

Tested: 33 new checks; all 22 suites pass (441 checks).

## ⚑ Leads (SX-27) — 2026-10-03: `rounds.php` + `index.html` + `api/submit.php`  *(live 2026-10-03)*

**⚑ This one touches `api/submit.php`, the live website form.** The note at the top saying
submit.php is never modified is out of date as of this upload.

A **Leads** tile for admins, above Quotes to build: one list for every enquiry, each with a
status (New → Contacted → Walk booked → Quoted → Won / Lost), notes with who wrote them, and
Call / Text / Email buttons. The tile shows how many are still New. Crew don't see it.

- **Website form leads arrive by themselves.** submit.php files each one into
  `sixfold-data/leads/leads.log`, beside the email it already sends. The email is unchanged.
  It only does this when `sixfold-data/` exists, so it does nothing on a local checkout, and
  a failure there can't lose the lead (the backup log and the email still run).
- **Meta, Nextdoor, phone calls, Linktree and referrals are added by hand** with "+ Add a lead".
  Meta Instant Form leads still only land in Leads Center; copy them across.
- **Door bookings stay in Quotes to build.** The Leads screen links there.
- Nothing to create on the host: `sixfold-data/leads/` makes itself on the first lead.

**Bug fixed in submit.php on the way:** the contact page's default choice is "Lawn & turf care"
(value `lawn`, since the aeration-led site went up 2026-09-25), but submit.php had no label for
it. So most enquiries have been arriving in the inbox labelled just **"Enquiry"**. They now say
"Lawn & turf care".

**After uploading:** send one test enquiry from the contact page. It should arrive by email as
before, now labelled "Lawn & turf care", and appear under Leads as New. Then mark it Lost so it
doesn't sit in the count.

Tested: 26 checks, run through the real submit.php. All 20 suites pass (408 checks).

## ⚑ Everything saves with no signal (SX-26) — 2026-10-03: `index.html` only  *(live 2026-10-03)*

Before, only door marks waited on the phone for signal. Now **notes, phone numbers, emails,
lawn answers and photos** do too:
- the card shows the change at once, with "Saved on this phone";
- it sends by itself when signal comes back: on reconnect, when the app is reopened, and every
  minute while anything is waiting;
- a newer edit to the same door replaces an unsent older one;
- photos are held in the phone's browser database, since they're too big for the queue;
- the town page says how many changes are waiting.

**Also fixed in the existing queue:**
- it used to drop an item when the server reported an error, which is exactly when it should be
  kept;
- it used to get stuck forever on an item the server refused as invalid.

Now it keeps items on no signal, a server error or a signed-out phone, and moves past refused
items. Tested with the network cut: 18 checks, and all 20 suites (414 checks) pass.

## ⚑ Codes and the email password move out of public_html (SX-9e) — 2026-10-03: `rounds.php` + `quote.php` + `config.php`, then two moves on the host  *(live 2026-10-03)*

**Why:** `api/rounds-codes.php` (every crew code) and `api/secrets.php` (the Gmail app password)
sit inside `public_html`. Today they're safe only because the server runs them as programs. If
that ever stops, they're served as plain text. The door data was moved out for the same reason.

**On the host, in this order:**
1. Upload the three new files over the old ones: `api/rounds.php`, `api/quote.php`, and the
   website's `api/config.php`. They read the new location first and fall back to the old one,
   so nothing breaks in between.
2. In File Manager, create a folder **`sixfold-private`** beside `public_html`, at the same
   level as `sixfold-data`.
3. **Move** `public_html/api/rounds-codes.php` into `sixfold-private/`. Move it; don't leave
   a copy behind.
4. **Move** `public_html/api/secrets.php` into `sixfold-private/`.
5. Check: sign in on the door app, and send one test enquiry through the website form.
6. Flush the cache. Both old addresses should now return **404**:
   `/api/rounds-codes.php` and `/api/secrets.php`.

The site bundle (`make-bundle.mjs`) now refuses to include either file, so a future website
upload can't put them back in `public_html`.

## ⚑ Trees near the house + neighbourhood tags (SX-24, SX-25) — 2026-10-02: `rounds.php` + `index.html` + all 12 door files  *(live 2026-10-03)*

**Trees near the house:** a chip on each door, using the state's defensible-space zones:
- **Trees against house**: 25% or more tree cover in the first 5 ft and in 5–30 ft;
- **Heavy trees, 30 ft**: 35% or more in the 5–30 ft zone;
- **Some trees, 30 ft**: 10% or more;
- **Clear, 30 ft**: less than that.

Tapping the chip shows cover at 0–5, 5–30 and 30–100 ft, the tallest tree within 30 ft, and the
source. **USGS LiDAR** covers El Paso (2018) and Douglas (2020). **Teller has no LiDAR**, so it
uses the satellite canopy map, marked "map" on the chip; the detail line warns that it misses
trees. Doors with no building outline (new builds) get no chip. The export gains five tree
columns. **Trees sort:** a fifth dock button ranks neighbourhoods by doors still to knock that read
"against" or "heavy" ("against" breaks ties). While it is on, each card shows a tree count chip. Method and checks: `operations/door-territory/tree-zones/TREES.md`.

**Neighbourhood tags:** each neighbourhood card leads with its subdivision name (Teller,
Douglas) or metro district (El Paso). A green **Firewise nearby: …** chip appears when an NFPA
Firewise site in good standing is within 600 m of its doors. The door list opens with the same
line plus "Ask before saying they are in it", because NFPA publishes a dot per site, not a
boundary.
- El Paso has no public subdivision names, so only about 30% of its doors get a name.
- The HOA registry can only be searched by name. A draft open-records request is in
  `operations/door-territory/HOA-RECORDS-REQUEST.md`, **not sent**.

## ⚑ Money sheets on every door card (SX-23) — 2026-10-02: `rounds.php` + `index.html` + one NEW file  *(live 2026-10-02)*

| File | Where |
|---|---|
| `api/rounds.php` | over the existing one |
| `summit-de59ae83/index.html` | over the existing one |
| `data/rounds/docs/money.json` | **new folder**: `sixfold-data/rounds/docs/money.json`, next to the door files and **outside `public_html`** |

Every door card gets a **Money** row: **Tax credit · Insurance · Grants**. Each opens a short internal sheet:
what it is, who qualifies, what to **say** and what **not to say**, and the sources. Tabs switch between the
three, and Back closes. **Grants follows the town's county:**
- Castle Rock, Larkspur, Sedalia and Franktown get the Douglas County cost-share.
- El Paso towns and Teller towns get "no county grant, talk tax credit and insurance".

The sheets are fetched after sign-in from the private data folder. To correct a fact, upload `money.json`
alone. Sources and the fact-check log: `data/rounds/docs/MONEY-SHEETS.md` (repo only, not uploaded).

**Check after upload:** signed out, `/api/rounds.php?action=money` must answer 401. Signed in, if a sheet
says "not on this server yet", the JSON is in the wrong folder.

Tested: 12 new checks, and all 16 suites (376 checks) pass.

## ⚑ Doors come back on their own; Put back is for mistakes — 2026-10-02: `rounds.php` + `index.html`  *(live 2026-10-02)*

Matthew's rules:
- **Put back on the list means "that was a mistake".** It cancels the mark it undid. That mark
  leaves the knocker's My doors list and every stats count, whatever day it was made. Undo in the
  toast brings it back.
- **Not now** with a date goes back into the to-knock list, in street order, on that date. It no
  longer sits in a separate "Due to revisit" section.
- **No answer** waits **2 days** and then comes back into the to-knock list by itself. Its card
  says "No answer last time · try again". While it waits, it sits in a collapsed "No answer — back
  on the list soon" section showing the day it returns. Put back on a waiting no-answer is the
  mistake fix.
  To change the wait, edit `MISS_REST_DAYS` at the top of the marks section in `rounds.php`.
  It is the only place the number lives.
- The neighbourhood count "to knock" includes doors back on the list. The cards show "N to try
  again" for rested no-answers and "N no answer · waiting" for the rest. **Doors to come back to**
  lists only doors back on the list now, and opens a neighbourhood with those doors first.

Tested: a no-answer dated 3 days ago comes back, and today's waits. 364 checks across 15 suites pass.

## ⚑ My doors on My stats — 2026-10-02: `rounds.php` + `index.html`  *(live 2026-10-02)*

My stats now has two tabs: **Numbers** (what it showed before) and **Doors**, which lists every door
that person acted on in the last 30 days, newest first. That covers marked, put back, or a phone,
email, note or photo added.
- **Filters:** Today / Yesterday / 7 days / 30 days, any single day from the date box, and a "what
  was done" dropdown (Quote booked, Not now, No answer, No soliciting, Put back, info only).
- **Fix it in place:** **Change** opens the outcome buttons. Not now asks for a come-back date.
  **Put back on the list** returns a door to the to-knock list. Every change has Undo in the toast.
- **Open door** opens the door's neighbourhood with that card highlighted, for notes, phone, email
  and photos. **Back** returns to the list with its filter kept.
- **A door someone else marked after you** shows "changed since by <name>", without change
  buttons, for crew. Admins can still change it. An admin opening someone's stats from Team
  stats sees that person's doors.
- Also fixed: the **Not now** tag in a neighbourhood's Done list was drawn oversized. A style for
  the come-back chooser was leaking onto it.

New server action `mydoors`. Signed out it returns 401, and crew can only ever get their own list.
Tested: 29 new checks, and all 15 suites (359 checks) pass.

## ⚑ Neighbourhoods open on Street order — 2026-10-02, `index.html` only  *(live 2026-10-02)*

Looking at one neighbourhood on the map used to leave every other neighbourhood opening on the
map too. Now the map is something you glance at, not a mode you stay in: every neighbourhood
opens on **Street order**, including after the app is closed and reopened. **Nearest** is still
remembered, because it is a way of sorting the list you would want to keep across an area.

Tested: Map, then the next neighbourhood → Street order. Map, then reopen the app → Street
order. Nearest, then the next neighbourhood → Nearest. The batch, crew and nearhood suites still pass.

## ⚑ Doors-team requests — 2026-10-02: `rounds.php` + `index.html`  *(live 2026-10-02)*

From a crew member's walkthrough of the app with Matthew:
- **Stats.** A **My stats** tile for everyone: today's doors knocked, people talked to, quotes
  booked and quote rate (quotes ÷ people talked to; no-answers left out), compared with their
  last 7 working days, a 14-day chart and a day-by-day list. A **Team stats** tile for admins:
  everyone's today / 7 days / 30 days; tap a person for their day-by-day.
  - Built from the logs, so it covers every day since the app went live.
  - A door counts once per person per day, at its last outcome; an undo removes it. Days are
    Colorado days.
  - Crew can only see their own: the API ignores a crew request for anyone else.
- **The card on the map.** Tapping a dot now opens the door's **full card** in a sheet over the
  map, with the mark buttons, phone, email, note and photos. Marking from it recolours the dot in
  place (the map doesn't reload). **▼** minimises the card to a bar so you can see the dots; tap
  another dot to switch; **×** closes it.
- **Email** beside the phone number: given at the door only, validated, in the export
  (`email`, `email_by`, `email_added`). New log `emails-<town>.log`.
- **Photos** for walk-throughs. **+ Photo** opens the camera or library.
  - The phone shrinks each photo to 1600 px and re-encodes it as JPEG before sending (a 172 KB
    test image arrived as 111 KB). That also **strips the phone's GPS tag**.
  - Stored in `sixfold-data/rounds/photos/<town>/<door>/`, **outside public_html**, and served
    only to a signed-in session. Up to 20 per door.
  - The person who took a photo, or an admin, can remove it.
  - The card reminds the crew: *only with the owner's OK · the property, not people.*
  - Quotes to build shows email and photos.
  - New log `photos-<town>.log`; the folders are created on first upload.
  - **Watch the SiteGround disk quota** if photo use grows (each photo is ~100–300 KB).

Tested: 45/45 new checks (email, photos with a real upload from the page, stats rules and
permissions, map card), plus all twelve earlier suites (326 total).

## ⚑ Location help for the phone in hand — 2026-10-02, `index.html` only  *(live 2026-10-02)*

A crew member's home-screen app kept saying location was blocked after he'd allowed it in the
browser. **The home-screen app has its own permission, separate from the browser tab.** On iPhone
it follows the **Safari Websites** switch under Location Services, which nobody finds unprompted.
When location is refused, the app now shows the steps **for that phone**: iPhone steps on
iPhones (including "delete and re-add the icon" when they're using the home-screen app), Android
steps on Android, a short general line otherwise. A **Try again** button sits in the same card.
Tested 10/10 as an iPhone and as an Android phone; the GPS suites still pass.

## ⚑ Aerial view with the property line — 2026-10-02, `index.html` only  *(live 2026-10-02)*

Matthew's report: the Satellite button "doesn't hone in accurately enough and doesn't highlight
the property." The cause: it sent Google Maps the **centre of the parcel** with satellite on. On a
big lot that's well away from the house, and **Google's links can't show satellite and drop a pin
at the same time, or draw a property line at all.** (Address points weren't the fix either: in El
Paso they mark the street frontage. Brandon's sits 29 m from the lot centre, on the side away from
his house.)

**Now Satellite opens an aerial view inside the app:**
- the 2023 USDA photo **fitted to that exact lot**, with **the property line in yellow**, read live
  from the Colorado statewide parcel service;
- a **Google Maps** button for a newer picture, now aimed at the lot's real centre and zoom.

Fallbacks: if the photo service is down, it shows the street map and says so; if the line can't
load, it shows a dot at the lot centre and says so. The phone's Back button closes it.

The photo tiles come from Microsoft's Planetary Computer. The imagery is public domain, but the
service is a free **preview**, and its terms say not to rely on it for anything mission-critical.
That's why Google stays one tap away. Tested 9/9 on Brandon's lot (outline drawn, photo loaded,
view fitted, Back closes), plus all ten other suites (272 checks).

## ⚑ Lawn level per door (SX-19) — 2026-10-02: `rounds.php` + `index.html` + all 12 door files  *(live 2026-10-02)*

**The measuring run finished 2026-10-02.** Upload the 12 files from `sixfold/site/data/rounds/` (11 towns + `index.json`) into `sixfold-data/rounds/`, over the old ones. Do NOT upload `docs/MONEY-SHEETS.md`. Rebuilt and verified as a PURE SUPERSET: all 31,422 doors kept their id and address. 31,060 doors have a lawn level. Six Black Forest lots use the 2021 photo, because the 2023 photo is unreadable at Prima Ln / Old River Dr, and their cards show `· 2021`.

| From | To |
|---|---|
| `api/rounds.php` | `public_html/api/rounds.php` |
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` |
| all 12 `data/rounds/*.json` | **`sixfold-data/rounds/`**, beside `public_html`, NOT inside it (overwrite) |

Then flush the cache. `lawn-cache.json` is **not** uploaded; it's a build input.

What it does:
- **Every door carries a lawn level:** *Large lawn · 2023*, *Medium*, *Small*, *Little or no lawn*,
  or *Mostly trees*. It comes from the 2023 USDA aerial photo plus a tree-height map
  (`operations/door-territory/lawn-trial/sample-lawn.mjs`; method and checks in `LAWN-SIZE.md`).
  **A level, never square feet:** the method reads open lots ~8% high and lawn under mature trees
  20–45% low.
- **Crew correct it at the door.** Tap the badge, then None / Small / Medium / Large. The answer
  replaces the photo's for everyone, shows as *"· crew"*, and goes in the export
  (`lawn_crew_level`, `lawn_crew_by`, beside the photo level and its approximate square feet).
  **Those answers are the calibration data:** after a season, the export is the dataset that
  re-tunes the cut-offs. New log: `lawnfix-<town>.log`, created on first use.
- **A Lawn sort** on the town screen (the bottom bar is now Map order · Nearest · Fire · Lawn).
  It puts the neighbourhoods with the most large and medium lawns still to knock first, and each
  card shows *"6 large · 22 medium lawns"*. Crew answers count.
- **Quotes to build** shows the lawn on each booked door.

Tested: 24/24 new checks, plus all nine earlier suites (263 total). Rebuilt door files verified as a
pure superset (31,422 doors, same ids).

## ⚑ Nearest neighbourhood — 2026-10-02, `rounds.php` + `index.html`

| From | To |
|---|---|
| `api/rounds.php` | `public_html/api/rounds.php` |
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` |

Matthew's point: inside a neighbourhood the doors are all close together; the useful question is
**which neighbourhood to drive to**. The town screen's bottom bar is now **Map order · Nearest ·
Fire hazard**.
- **Nearest** takes one location fix and sorts neighbourhoods by distance to each one's centre,
  showing *"0.2 mi"* on every card.
- On a fresh fix it **moves to the closest town** and says *"Showing Monument, the closest town to
  you."* Picking a different town by hand afterwards sticks.
- The API's `regions` action now returns `la`/`lo` per neighbourhood: the average of its doors'
  parcel centroids, computed when the list is served. **No data rebuild.**
- Nearest inside a neighbourhood is kept, because rural neighbourhoods can spread over miles.

11/11 new checks, including the first card matching an independent distance recount. All eight
earlier suites pass.

## ⚑ Doors to come back to — 2026-10-02, `index.html` only  *(live 2026-10-02)*

With about 30,000 doors, a no-answer showed only as one chip on one neighbourhood card among
thousands. The town screen now shows **"N doors to come back to"**, counting every no-answer
and every door whose come-back date has arrived, **across every town**. Tapping it lists just
those neighbourhoods, grouped by town. Tapping one switches to its town and opens it at the
right section (No answer, or Due to revisit). Built from counts the page already loads, so it
makes no extra request. Also fixed: opening a neighbourhood reset the scroll after drawing,
which undid any jump to a section. 8/8 new checks plus the earlier suites.

## ⚑ Fixes from the first live look — 2026-10-02, `index.html` only  *(live 2026-10-02)*

Matthew's notes after signing in on phone and desktop:
- **An empty black bar on the report page (and any page without a view switch).** The page
  never declared `[hidden]{display:none}`, so the dock's `display:flex` overrode the `hidden`
  attribute. Fixed globally.
- **The bottom bar covered text.** It floated over the list. Now it's a solid bar flush with
  the bottom edge (safe-area aware), and the page is padded so the last item clears it.
- **Quote booked was green, which read as "already booked".** It's ember now. Green only
  ever means done.
- **No-answer doors were hard to find and couldn't be put back.** A row at the top now says
  *"1 no answer to try again"*; tapping it opens the section and scrolls to it. Each no-answer
  door has **Put back on the list**, with Undo in the toast.

220/220 checks across seven suites.

## ⚑ The new look — 2026-10-02, page + five new files (SX-18)  *(live 2026-10-02)*

| From | To |
|---|---|
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` (over the existing one) |
| `manifest.json`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | `public_html/summit-de59ae83/` (**new**, next to `index.html`) |

**`rounds.php` and the door files are unchanged.** Don't re-upload them. Then flush the cache.

What changed, from the approved preview (https://claude.ai/artifact/Q32vDrTndXxnazGLuxooWJ):
- **Sign in:** a dark screen with the Ridge mark, six code boxes and a big number pad. Six digits
  sends the code. A wrong code shakes and clears. A keyboard works too.
- **App bar:** a dark Timber bar on every screen, with the mark, the town picker and your initials.
  Tap your initials to get back to field tools and sign out.
- **Neighbourhoods:** a town summary card with a progress ring, a ring on each neighbourhood, and
  coloured chips. The sort switch is a dock at the bottom of the screen.
- **Doors:** a coloured edge for fire hazard, small Satellite / + Phone / + Note chips, and solid
  buttons with icons.
  - Marking a door stamps it, slides it away, ticks the count down and shows a toast with
    **Undo**. The toast names what was marked and **never says "saved"**: offline marks still
    show *not sent yet*.
  - An ember burst on Quote booked, and a finished screen when the last door is marked. A
    no-answer doesn't count as finished.
- **Map:** tapping a dot opens a card from the bottom. "You" is a pulsing dot.
  - **The map's credit links now open in a new tab.** Testing found that tapping the
    OpenStreetMap link navigated the whole app away mid-round.
- **Home screen:** a manifest and icons. Add it from the browser's share menu and it opens full
  screen with the Sixfold icon. A splash with the mark shows while it loads.
  - **No service worker, on purpose.** The page always loads fresh, so an upload is never hidden
    behind a stale offline copy. Offline marking works exactly as before.
- Phones set to reduce motion get every change without the animation.

**Tested:** **211 checks, all passing**, on a scratch copy with throwaway codes:
- a new 30-check suite for the look: keypad, wrong code, keyboard entry, motion on, toast, Undo
  on the server, the finished screen, the icons, no script errors;
- all six earlier suites, updated for the new sign-in and map card.

Rendered at iPhone width in light and dark.

## ⚑⚑ THE ONE UPLOAD — everything built 2026-10-01, in a single pass  *(live 2026-10-02)*

**Every section below dated 2026-10-01 goes up in this one upload.** Nothing from today has
been uploaded yet; the files on disk carry all of it.

| From | To |
|---|---|
| `api/rounds.php` | `public_html/api/rounds.php` (over the existing one) |
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` (over the existing one) |
| all 12 `data/rounds/*.json` | **`sixfold-data/rounds/`**, beside `public_html` and **NOT inside it** (overwrite) |

Then **flush the cache** (Site Tools → Speed → Caching → Flush) and run the checks under
*The check that matters*. **Nothing to create by hand:** the new `quoted-<town>.log` appears the
first time an admin ticks a quote sent, and `areaflags-<town>.log` the first time a
neighbourhood is flagged. **No data rebuild was needed for this batch.** The door
files are the ones verified as a pure superset at commit `b6efb24`.

## ⚑ Slimmer cards, town progress, no soliciting, nearest door, map, quotes to build — 2026-10-01

### Slimmer cards
The fire badge now sits at the start of the acres/owner line. The satellite link moved into
one tools row: **Satellite ↗ · + Add phone · + Add note**. That's about two lines shorter per
door, so you get more doors per screen.

### Town progress
Under *"pick a neighbourhood"* there's now a line like *"212 of 737 doors visited · 9 quotes
booked · 3 due back"* with a bar under it. **Visited** means every door with any mark,
including no-answers, because the door was walked to.

### No soliciting (SX-13)
Inside the **Not now** chooser: **"No-soliciting sign — skip this door for good."** It counts
as done and leaves the fire-hazard count. It also has its own column in *Who marked what* and
appears in the export as `nosolicit`. **Undoing it asks first.** An accidental undo would put
the door back in front of the next crew member. Every other Undo still goes straight through.
**The neighbourhood flag too.** At the bottom of every door list: *"No-soliciting sign at the
entrance? Flag this neighbourhood."* Any crew member can raise it, after a confirm. After
that:
- the neighbourhood card shows **No soliciting posted** with its name struck through, and it
  sinks to the bottom of the fire-hazard sort;
- opening it shows a warning naming who flagged it and when, above the list and the map.

**It warns, it doesn't lock.** A sign at one entrance may not cover every street, so the
doors stay markable. **Only an admin can clear it**, with a confirm. Otherwise one wrong tap
quietly drops a neighbourhood from the programme. Crew get 403 from the API, not just a
missing button.

**⚑ The flag is stored against the door ids it covered, not the neighbourhood name.** Names
change when the lists are rebuilt, and today's split renamed dozens of them. A flag keyed on
a name would silently fall off and those doors would get knocked again. **Tested:** a flagged
neighbourhood renamed and split in two by a simulated rebuild came out with **both** halves
still flagged, and nothing else picked it up. Clearing either half clears the posting.

Checking for HOA bans before heading out is still the doors team's research job. The flag is
where they record what they find.

### Street order · Nearest · Map
A switch at the top of every neighbourhood, and each phone remembers its own choice.
- **Nearest** asks the phone for its location **once**, then sorts the doors nearest first,
  showing *"20 ft"* or *"0.3 mi"* on each card. It never tracks continuously, because that
  drains a phone over an afternoon. **↻ Update my location** takes a new fix. If location is
  blocked, the page says so and the list still works.
- **Map** shows every door as a dot: blue = to knock, green = due back, amber = no answer,
  grey = done. A **red ring** marks high fire hazard and a **black dot** is you. Tapping a dot
  shows the address and status. **Show card** jumps back to the list and highlights that door.
  - Street tiles come from **OpenStreetMap**, with the credit their policy requires.
  - The map library is **Leaflet 1.9.4 from cdnjs, pinned by checksum** (subresource integrity).
    This page is signed in to names and addresses, so a tampered copy of the library is
    refused rather than run.
  - The library loads only when Map is tapped, so the list stays fast. With no signal the map
    says it couldn't load and Street order carries on.

### Quotes to build (admins)
A new tile on the tools chooser. It lists every door marked **Quote booked**, across every
town, newest first. Each one has the address, the town and neighbourhood, the owner, acres,
the fire badge, the number with its source (tap to call), the note, who booked it, and a
satellite link. **Mark quote sent** moves it into a collapsed *Sent* list, and it can be
undone. Crew get 403 from both new API actions, not just a missing tile.
It's kept inside the door app on purpose. The Quote Build tool already exists in three copies
that must be kept in step (SX-2b), and this doesn't add a fourth.

### Tested
**62/62** on the new batch plus **25/25** on the neighbourhood flag, against a scratch copy on real PHP with throwaway codes, then
deleted. That includes a faked GPS position (the nearest door came out first and distances
ran in order), location refused, the map with the network cut, the real Leaflet file passing
its checksum, real taps on map markers, and both new admin actions refused to crew. **All four
earlier suites rerun against the final files:** phone 32/32, satellite 8/8, fire 17/17,
notes and come-back 36/36. That's **180 checks** in total. Rendered at iPhone width in light
and dark.

## ⚑ Notes, "come back when", and walkable neighbourhoods — 2026-10-01, same three uploads

**Same three uploads again, newer versions:** `api/rounds.php`, `summit-de59ae83/index.html`, and
all 12 `data/rounds/*.json` into **`sixfold-data/rounds/`** (beside `public_html`). One upload
carries everything built today. **Flush the cache afterwards.**

### Notes on every door
**"+ Add a note"** on each card: *"dog in the yard"*, *"back after 5"*, *"wants aeration in spring"*.
Up to 500 characters, line breaks kept. Shows who wrote it and when. Stored in
`notes-<town>.log` beside the marks — keyed on the door, so it survives rebuilds. In the export.

### "Not now" now asks "when should we come back?"
**In a month · In 3 months · Spring · Fall** (each showing its actual month), **pick a date**, or
**Not now — no date**. When the date arrives the door comes back in its own **"Due to revisit"**
section, buttons live, saying *"asked us back 1 Apr 2027 — due"*. Neighbourhood cards show
*"2 due back"*. Done rows read *"Not now · back Apr 2027"*.

**⚑ The date rides on the Not-now mark itself**, so it uses the same offline queue: **tested
with the network cut** — held on the phone as "not sent yet", sent with its date intact when
signal returned. A due high-hazard door counts towards the fire sort again.

### Neighbourhoods are walkable now
**Biggest 404 → 55 doors. None over 60** (was 183). Median unchanged at 29. 727 → 1,167
neighbourhoods. **Two stacked bugs:** the splitter split once and dumped leftovers into the
biggest piece; and pieces that shared a street name were glued back together, because the
neighbourhood file groups by name. Clashing names now carry their house-number range —
*"Wolf Village Dr 5738–5842"* — so a crew knows which stretch. **Non-clashing names did not
change.** Door ids are untouched: marks, numbers and notes all stay on their doors.

### Tested
**36/36** on a scratch copy with throwaway codes, including the offline case. Rebuild verified a
pure superset (31,422 doors, same ids). Rendered at iPhone width, light and dark.

## ⚑ Fire hazard badges + sort, 2026-10-01 — upload the same three again (SX-9b)

**Same three uploads as below, newer versions** — `api/rounds.php`, `summit-de59ae83/index.html`,
and every `data/rounds/*.json` into **`sixfold-data/rounds/`** (beside `public_html`, not in it).
This one upload carries the phone field, the satellite link AND the fire hazard together.
**Then flush the cache** — Site Tools → Speed → Caching → Flush.

**`wildfire-cache.json` is NOT uploaded.** It is a build input; the hazard class is already baked
into each door in the `.json` files.

### What the crew sees

- **A badge on every door:** *Very high fire hazard* (solid red) · *High* (solid orange) ·
  *Moderate* (amber outline) · *Low* / *Very low* (grey outline) · **Fire map: not rated**
  (dashed). Booked quotes in Done carry a small one, for the estimate visit.
- **A sort switch on the neighbourhood list:** *Map order* (walking routes, the default) or
  *Most fire hazard*, which puts the neighbourhoods with the most high-hazard doors **still to
  knock** first. Each neighbourhood shows a pill — *"46 high fire hazard · 18 very high"*.
  The choice is remembered on that phone.

### ⚑ Rules built into it — do not "simplify" these away

- **"Not rated" is never "low".** Class 6 means the 270 m cell is mapped as town or farmland; a
  wooded lot can sit inside one. It gets a dashed badge and is never hidden or sorted out.
- **The count is high-hazard doors STILL TO KNOCK.** Booking one drops it; a *no answer* does
  not, because that door still needs a visit. A worked-out neighbourhood sinks down the sort.
- **It rates neighbourhoods, not houses** (270 m cells). The satellite link is the per-house check.

### Tested

17/17 on a scratch copy with throwaway codes: the per-neighbourhood count matched an
independent recount of its doors (46 = 46, very-high 18 = 18); booking dropped it, a no-answer
did not, undo restored it; the sort was strictly descending; map order came back exactly; the
choice survived a reload; every card showed a badge; class 6 read "not rated". Rendered at
iPhone width in light and dark. Every badge colour checked at ≥ 4.5:1 contrast.

### Rebuilding the hazard data

`node sample-wildfire.mjs` then `node build-rounds-data.mjs`. Sampling is incremental — it
only asks the Forest Service about coordinates it has not seen — so after a door rebuild it
fetches the new doors only. Run `verify-superset.mjs` before uploading, as always.

## ⚑ Phone numbers + satellite view, 2026-10-01 — ONE upload, three parts (SX-14)

| From | To | Note |
|---|---|---|
| `api/rounds.php` | `public_html/api/rounds.php` | over the existing one — the `phone` action, and coordinates on each door |
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` | over the existing one — the phone field and the satellite link |
| `data/rounds/*.json` | **`sixfold-data/rounds/`** — beside `public_html`, NOT inside it | the door files, now carrying each parcel’s coordinates |

**⚑ The satellite link needs the new door files.** Upload the page without them and the link
simply does not appear (it hides itself when a door has no coordinates) — nothing breaks, but
nothing shows either. All three together.

### Satellite view

Each door shows **"Satellite view ↗"**, which opens Google Maps in satellite mode on that
parcel — in the Maps app on a phone, if installed. It is the Google Earth step in Via’s
funnel: **see the trees and brush crowding the house before knocking or quoting.** Booked
quotes in Done get a smaller one, for a look before the estimate visit.

- **Uses the parcel centroid, not the address.** Rural addresses here can geocode to the
  nearest road; the coordinates come from the parcel boundary itself.
- **Zoom follows lot size** — 20 under an acre, 19 for 1–3, 18 from 3 up — because the
  centroid is the middle of the *lot*, not the house, and a 10-acre lot needs the room.
- **Format is Google’s documented Maps URL** (`map_action=map`, `basemap=satellite`), checked
  against Google’s own docs rather than remembered.
- **Coordinates were carried through the pipeline**, not bolted on: they were already parsed
  by `build-walklist-pdf.mjs` for the neighbourhood clustering and thrown away on the line
  that writes the sidecar. All 31,422 doors carry them, all inside Colorado; the rebuild was
  verified a pure superset (same doors, same ids) before shipping.
- **Tested:** 8 checks on a scratch copy, then the link followed in a real browser — it opened
  Google Maps in satellite on 480 High Rd, Divide: a 10-acre lot that is nearly solid conifer,
  which is the whole point.

**Nothing to create by hand.** The first number saved creates `phones-<town>.log` in
`sixfold-data/rounds/`, beside the marks logs and outside `public_html` for the same reason.

**Why a separate log and not the door files:** the door files are rebuilt from county data
(as they were on 2026-10-01). Numbers stored inside them would be wiped by the next rebuild.
Keyed on door id in their own append-only file, they survive exactly the way marks do.

**What a crew member sees:** each door shows its number, a line saying where it came from
— *"Given at the door · 1 Oct 2026"* or *"Found on True People Search · last seen Aug
2026"* — and **"+ Add a phone number"** or **"Edit number"**. Booked quotes in the Done list
take a number too, since that is the moment one is usually handed over.

**⚑ Numbers are typed in by a person.** Nothing in the app fetches from a people-search site.
Automated pulling was declined on 2026-10-01 — blocked by the permission system as personal-
data harvesting, and against those sites' terms besides.

**⚑ The source field decides what you may do with a number.** *Given at the door* is consent.
*Looked up* is a cold call, and those doors carry an amber note: check the national and Colorado
Do Not Call lists before calling.

**Tested before shipping:** 32 checks against a scratch copy on real HTTP with throwaway codes
— save, read back, normalisation, eight refusals (bad number, bad source, bad month, unknown
town, path traversal, GET on a write), removal, marks unaffected, crew blocked from export,
admin export carrying five phone columns, log unreachable over HTTP. Then rendered at iPhone
width and looked at: no sideways scroll, inputs at 16 px so iOS does not zoom on tap.

**One known limit:** a phone save is not in the offline queue (that queue is mark-only and
would misread it). With no signal, the form stays open with the number still typed and asks
for a retry — nothing is lost unless the crew member navigates away.

**After uploading: flush the cache, then check plain against busted** — see below.

## ⚑ Quote build added 2026-09-30 — upload this too

Signing in now lands on a **tools chooser** rather than straight on doors. Two tiles: **Door
rounds** for everyone, **Quote build** for admins only.

| From | To | Note |
|---|---|---|
| `api/quote.php` | `public_html/api/quote.php` | **New.** Admin-only storage for rates and saved jobs |
| `summit-de59ae83/index.html` | over the existing one | The chooser |
| `summit-de59ae83/quote.html` | `public_html/summit-de59ae83/quote.html` | **New.** Generated — do not hand-edit |

**Nothing to create by hand.** `quote.php` makes `sixfold-data/quote/` itself on first write,
beside `sixfold-data/rounds/` and outside `public_html` for the same reason: this is the cost
model, the margins and saved customer quotes, and an `.htaccess` deny already failed once on
this host.

### The gate is a ROLE, not a code

Matthew asked for it locked to him while he tests it. **His six-digit code is not written
anywhere in the site** — putting a code into a file the web server serves is one
misconfiguration away from publishing it, and `rounds-codes.php` says of itself *"never commit,
never paste it anywhere".*

Instead the check is `role === 'admin'`, in **two** places: the tile is not rendered for crew,
and `quote.php` refuses them 403. The second one is what matters — a crew sign-in produces a
valid session, so hiding the button alone would protect nothing.

**To let Brad in later:** change his line in `api/rounds-codes.php` from `crew` to `admin` and
re-upload that one file. Nothing else changes. ⚑ Note that also gives him the doors admin view —
who marked what, the totals and the CSV export. If those need to be separate, the roles need a
third level rather than a second.

### ⚑ FLUSH THE CACHE FIRST, then check PLAIN urls

**Site Tools → Speed → Caching → Flush**, then hard-refresh. This is step one, not an
afterthought, and it bit on 2026-10-01: both files were uploaded correctly and the chooser still
did not appear, because SiteGround kept serving the previous day’s `index.html` on the plain URL.

**A cache-busted check cannot see this.** `?v=123` is a different URL, so it misses the proxy and
fetches the new file every time — the verification passes while every real browser gets the old
page. Check **plain AND busted** and compare:

```
curl -s https://sixfoldcolorado.com/summit-de59ae83/ | wc -c
curl -s "https://sixfoldcolorado.com/summit-de59ae83/?v=$(date +%s)" | wc -c
```

**Different byte counts mean the cache is stale.** `curl -D-` shows `X-Proxy-Cache: HIT` and a
`Last-Modified` from before the upload, which is the tell. API responses are not cached, so a
passing `quote.php` check proves nothing about the pages.

### Check it, in this order

```
curl -s -o /dev/null -w "%{http_code}\n" https://sixfoldcolorado.com/api/quote.php?action=me
```

**Expect 401** signed out. Then sign in as **crew** in a browser and load
`/summit-de59ae83/quote.html` — expect the page to replace itself with *"Your code opens door
rounds but not the quote build."* Then sign in as **admin**: the Quote build tile appears and the
page loads.

### ⚑ What the gate does NOT protect

**`quote.html` is an ordinary page and its source carries the default rate table** — $100 a
man-hour, 65 man-minutes a tree, the dump presets, the haul floors, the whole cost model as plain
JavaScript. Anyone who knows the `summit-de59ae83` URL can read it **without signing in at all.**

What the gate protects is the *saved* side: rates anyone has edited, and every saved job with its
customer name and price. Those live behind `quote.php` and outside the web root.

So the defaults rest on the same thing the doors page rests on: **the path being unguessable.**
That was accepted for a door list. Whether it is accepted for the margins is a separate decision,
and if not, the fix is to serve `LINES` and `COSTS` from `quote.php` too rather than baking them
into the page. **Not done, and worth deciding before anyone else is given the URL.**

### Keeping the two copies in step

`quote.html` is **generated** from `quotes/quote-engine.artifact.html` by
`sixfold/site/build-quote-page.mjs`. The artifact stays the single source of the pricing logic;
the generator changes only the two storage calls and the file download.

**Re-run it after any reprice, and re-upload**, or the site keeps quoting the old numbers:

```
node sixfold/site/build-quote-page.mjs
```

That is the v2/v3 trap in a new place. The artifact sat two days behind the file once and every
quote built in between was 43% low on labour. There are now **three** things that can drift —
the file, the artifact and the site — so a reprice means publish *and* regenerate *and* upload.

---

## Upload

| From | To | Notes |
|---|---|---|
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` | the crew page |
| `api/rounds.php` | `public_html/api/rounds.php` | the only thing that serves door data |
| `rounds-codes.php` | **`sixfold-private/`** (beside public_html) — **never `public_html/api/`**, never from the repo | ⚑ the live codes. Moved out of the web root 2026-10-03 (SX-9e); this row used to say `public_html/api/`, which would undo that |
| `data/rounds/*.json` | **`sixfold-data/rounds/`** — beside `public_html`, **NOT inside it** | the door lists |

**⚑⚑ CORRECTED 2026-10-01 — the door data goes OUTSIDE `public_html`.** This row used to say
`public_html/data/rounds/`, which is **where the data lived on the first deploy and is exactly
the location that leaked**: `/data/rounds/monument.json` returned **200 and served home
addresses to anyone**, because SiteGround did not honour the `.htaccess` deny. `api/rounds.php`
now reads `dirname(__DIR__, 2) . '/sixfold-data/rounds'` — a sibling of `public_html` that the
web server cannot serve at all. **The stale row survived the fix and would have walked the next
upload straight back into the leak** — as of 2026-10-01 that is 31,422 names and addresses.

**Upload the `.json` files into `sixfold-data/rounds/`, overwriting what is there.** No
`.htaccess` is needed there — nothing outside the web root can be requested. **After uploading,
confirm `https://sixfoldcolorado.com/data/rounds/monument.json` still returns 404.**

**⚑ `rounds-codes.php` is gitignored and holds the live codes.** It is not in the repository;
it lives in `sixfold-private/` on the host (since SX-9e, 2026-10-03). Treat it like `secrets.php`.

## The check that matters — do this immediately after uploading

Established practice on this site: **verify a live host by requesting what must be denied.**

```
curl -s -o /dev/null -w "%{http_code}\n" https://sixfoldcolorado.com/data/rounds/monument.json
curl -s -o /dev/null -w "%{http_code}\n" https://sixfoldcolorado.com/api/rounds-codes.php
curl -s -o /dev/null -w "%{http_code}\n" https://sixfoldcolorado.com/api/rounds.php?action=regions
```

**⚑ A status code alone does not answer this. Read the body.** Corrected 2026-09-30 after the
check was actually run against the live host for the first time.

### What the live host really returns, measured 2026-09-30

| Request | Got | Verdict |
|---|---|---|
| `/data/rounds/monument.json` | **404** | **Safe.** `/data/` 404s exactly like a path that does not exist, and this host *does* return 403 where it means it (`/api/` and `/api/.ratelimit/` both do). **The door JSON is not under the document root at all** — which is better than a 403, because there is nothing there to deny |
| `/api/rounds-codes.php` | **200, and zero bytes** (2026-09-30). **Since SX-9e (2026-10-03) it must be 404** — the file is no longer there | **Not a leak, but not the designed protection either.** PHP executes the file and a top-level `return` emits nothing, so the body is empty. **The `.htaccess` deny is not what is protecting it** |
| `/api/secrets.php` | **200, and zero bytes** (2026-09-30). **Since SX-9e it must be 404** | Same situation, same caveat |
| `/api/submissions.log` | **403** | **Safe, and this closes an assumption that had been carried untested since the app went live.** `.htaccess` deny *does* work for `.log` on this host |
| `/api/rounds.php?action=regions` | **401** | The sign-in gate working without a session |

**So the rule for this host is narrower than "SiteGround ignores `.htaccess`":** it honours a
deny for `.log`, and a `.php` file still answers 200 because PHP runs it first.

**⚑ The two `.php` secret files are protected by PHP executing them, not by any deny rule.**
That holds until the day PHP does not run for that directory — a handler misconfiguration, a
version change, a directory copied somewhere without the handler — and then `rounds-codes.php`
serves as plain text and **every crew code is public**.

**The fix is the one already applied to the door data: move it above the document root** and
have `rounds.php` include it by absolute path. Not urgent, not done, and it should be done
before the code list grows.

**When re-running the check, always fetch the body:**

```
curl -s https://sixfoldcolorado.com/api/rounds-codes.php | wc -c      # must be 0
curl -s https://sixfoldcolorado.com/api/rounds-codes.php | grep -c "'"  # must be 0
```

**A non-zero byte count on that first line is the emergency.** Change `session_key`, reissue
every code, and move the file above the document root.

## Also do

- **⚑ DO NOT put the path in `robots.txt`.** An earlier draft of this file said to add a
  `Disallow` line. That was wrong and would have defeated the point: **robots.txt is public**,
  so anyone reading `sixfoldcolorado.com/robots.txt` would be handed the address of the
  internal tool. The page already sends `noindex` and the API sends `X-Robots-Tag: noindex`,
  which is what actually keeps it out of search results.
- **Do not link the page from anywhere on the public site**, and do not mention the path in
  anything customer-facing.

## The codes

Six digits each, handed out in person or by a channel you trust — not in a group chat.

| Person | Role | What they see |
|---|---|---|
| Matthew | admin | everything, plus who marked what and the CSV export |
| Brandon | crew | neighbourhoods and doors |
| Brad | crew | neighbourhoods and doors |
| Nneka | crew | neighbourhoods and doors |
| Cai | crew | neighbourhoods and doors |
| Will D | crew | neighbourhoods and doors |
| Christian Jensen | crew | neighbourhoods and doors — added 2026-10-02 |

**Roster corrected 2026-09-30** — Nneka and Cai were already in `rounds-codes.php` and missing
from this table, and **Will D was added the same day**. The codes themselves are never written
here: this file is tracked in git, `rounds-codes.php` is not.

Adding or removing someone is one line in `api/rounds-codes.php`. Removing a code deletes the
way in; their past marks stay in the log under their name.

**If a code gets loose:** change `session_key` in that file. Every session everywhere ends and
everyone signs in again with new codes.

## Refreshing the door lists

**⚑ The check is part of the procedure, not optional** (added 2026-10-03, after a review found it
missing from this section). It is what stops a rebuild putting one house's marks on another.

```
# 1. baseline = what is LIVE now, straight from git (not a hand copy: cp -r into an existing
#    folder nests it, and the check used to "pass" having compared nothing)
mkdir -p /tmp/rounds-before && for f in $(git ls-files sixfold/site/data/rounds/*.json); do git show HEAD:$f > /tmp/rounds-before/$(basename $f); done
# 2. rebuild
node ../../operations/door-territory/sample-value.mjs                   # county values (Douglas, Teller)
node ../../operations/door-territory/build-walklist-pdf.mjs <area>.csv   # clustering
node ../../operations/door-territory/build-rounds-data.mjs              # writes data/rounds/
# 3. the gate
node ../../operations/door-territory/verify-superset.mjs /tmp/rounds-before
```
**Exit 1 means do not upload.** It fails on a lost, moved or renamed door, on a town missing from
the new index.json, and when it had nothing to compare. A door that left a town for its partner
town (see "One town per door" above) is reported as a move and passes.

Then re-upload `data/rounds/*.json` (including index.json) only. **The marks log is never
regenerated** — it lives on the server and is the record.

## What was tested here, and what was not

**Tested against a real PHP 8.4 server before upload:** the sign-in gate refuses every action
without a session (401); a wrong code is refused; a good code signs in and marking works;
marks persist and carry the right name; a crew code is refused the admin report (403); a door
id containing `../` is refused; the sign-in rate limit trips after 8 tries (429); the CSV
exports cleanly; undo removes a mark.

**Not tested, because it cannot be from here:** whether this host honours `.htaccess` (the
curl checks above are exactly that test), the live PHP version, and real phone signal in the
neighbourhoods.

---

## ⚑ The folder name is deliberately meaningless

`/rounds/` was the first name and it was too obvious — guessable, and it announces that there
is an internal application on a customer-facing domain. The path is now
**`/summit-de59ae83/`**.

**This is not what protects the data.** The sign-in gate and keeping the door lists outside the
document root are what protect it, and both are tested. An unguessable path adds one thing on
top: nobody stumbles on it, and nobody browsing the site learns that the tool exists.

**Change it whenever you like** — rename the folder on the server and tell the crew. Nothing
else refers to it: the page reaches the API as `../api/rounds.php`, which works at any
single-level path.

**Hand it out as a bookmark or a QR code, not as something typed.** `brand/qr/build-qr.mjs`
already generates codes; one pointed at this URL, shown once, means nobody ever types it and
it never appears in a text message.

## What to upload for the 2026-09-29 revisions

| File | Where | Why |
|---|---|---|
| `summit-de59ae83/index.html` | rename `public_html/rounds` → `public_html/summit-de59ae83`, then upload into it | the no-answer section, and the new path |
| `api/rounds.php` | over the existing one | counts no-answers separately from done |
| `api/rounds-codes.php` | over the existing one | Brad's full name |

**Three states now, not two.** A **no answer** means nobody was home — that door is not
finished. It leaves the main list, so nobody re-knocks it the same afternoon, and lands in its
own **"No answer — try again"** section with the buttons still live. The neighbourhood card
shows it too: *"18 to knock · 5 to try again"*. **Quote booked** and **Not now** are done and
sit under **Done**.
