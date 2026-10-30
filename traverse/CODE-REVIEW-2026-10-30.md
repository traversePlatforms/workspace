# Code review, 30 October 2026 (the 29 October changes)

Scope: every commit on `main` from 2026-10-29 00:00 to `a285cc2` (about 80 commits, eight hand merges of parallel branches): the
editions' roles, seats, devices and terms; Setup > Email; other ways to pay; Import; Your costs; billing in every edition, setup mode
and the past-due lock (then narrowed); the weather rebuild (one shared NWS copy, polygon matching, radar); permits per trade; new movers
and house facts; the Security lot facts; Solar production; the regions warmer; the nightly backups; client branding (logo upload, the
public `action=logo`, the SVG sanitiser); the role permissions editor; the Prospect Desk "With map" email; the pipelines under
`data-pipeline/door-territory/{moved,permits,security,solar,hail}`, `merge-edition-index.py` and `recount-index.py`.

Method: the diff of each changed file read against the current code (not the whole files); the security paths traced by hand
(view-as role previews, `SIXFOLD_WARM_ROLE`, `billGate`/`BILL_DATA_SHUT`, `permElevate`/`permGate`, the Stripe hook, `logoServe`,
`svgClean`, `mailset`'s SMTP host check, `mailsend`); the page and pipeline diffs cross-read by two fresh reviewers whose findings
were then verified here by grep and reproduction; a harness copy on port 8791 (`scratchpad/ptest-rv`, `ptest-rvbl`) run before and
after in edition and Sixfold mode. Line numbers are in the files as of merge `fae77e3`.

Each finding: where, what breaks, what was done. "Fixed" = in this branch. "Left" = listed for the build that owns that area.

## Critical

None found. Checked and sound: the super admin's `role:<role>` preview can only name a role in `previewRoles()` (never super), stays
read-only (POST refused), and never reaches another install; `SIXFOLD_WARM_ROLE` is read only under `PHP_SAPI === 'cli'` and
`SIXFOLD_CLI`, so no web request can set a role with it; `billGate` never makes anyone an admin and the super admin is never locked;
`permElevate` lifts a request to office/manager/sales rep only for an action in that permission's own list and only when the admin
turned it on, and `adminOr()` never grants `super`; the Stripe hook keeps its signature check and `billingTakeEvent` drops a second
subscription instead of taking it; `logoServe` sends the install's own file with `nosniff` and a `sandbox` CSP; `svgClean` rebuilds
an SVG from an allow-list (no script, event attributes, external hrefs, DOCTYPE or entities; `url()` only to an `#id`); `mailset`
refuses private and reserved IPs for a custom SMTP host; `mailsend` only goes to an address on a lead or customer the sender works
with, 30 an hour per sign-in and 300 a day per install. The pipelines write no owner names into any output (checked file by file;
`fetch-arcgis.mjs` refuses any field matching OWN|GRANT|MAIL|NAME).

## High

1. **Page, `copyText` defined twice** (`index.html` ~8611 `copyText(t, said)` and ~18661 `copyText(t, btn)`). The page is one
   script, so the later definition won and the five callers that pass a toast message (the new ways-to-pay Copy, Copy all, the
   quick-quote copies) set `textContent` on a string: no "Copied" ever showed. **Fixed**: the button one is `copyBtn`, its one caller
   updated. A new harness check (`dupfn-test.mjs`) fails on any function statement defined twice.
2. **Pipelines, `moved/build-moved.mjs`**: a county whose fetch failed (or one left out with `--counties=`) was logged and skipped,
   then every town on it was rewritten without that county's sales and house facts, and the run reported success. **Fixed**: a town
   whose counties did not all answer keeps the files it has; the run names them and exits 1.
3. **Pipelines, `hail/rebuild-hail-hours.mjs`**: an archive folder that would not list (an outage, not a 404) was cached as empty,
   every sample came back null, and the date was written down as "no hail hours" and marked done, so a resume never retried it.
   **Fixed**: a failed listing is not cached, the date is left for the next run and said so. Also a `.progress` file with no output
   file skipped its dates for good: both or neither now.
4. **Pipelines, `hail/hail-backfill-vm.sh`**: `fetch.done` was touched even when all three radar fetches failed, so the build ran on
   whatever days were there. **Fixed**: it stops with a status line.

## Medium

5. **Page, Pipeline phone search** (`pipeHit`, ~14890): `/[s().+-]/g` strips the letter s, not spaces, so "303 555 0100" (12
   characters, 10 digits) fell through to the name search and said "Nobody matches". **Fixed**: `/[\s().+-]/g`.
6. **Page, `money2` defined twice** (~9145 old two-decimal, ~13470 the Your-costs one). The new one already won for the 15 older
   callers (same output plus thousands separators). **Fixed**: the old one removed, so the next reader is not misled.
7. **Page, Import** (`impParse`): Excel's byte-order mark was not stripped before parsing, so the first heading carried it into the
   column list and the "needs a look" download (shown as "ï»¿Name" in some tools). **Fixed**: stripped first.
8. **Page, in-app email**: a second tap on "Email it" after a send re-confirmed and re-sent with no sign it had gone (`.mailsent`
   had no CSS). **Fixed**: the confirm says "This email was sent already. Send it again?". Small on purpose: resending is sometimes
   wanted.
9. **Pipelines, `hail/backfill-hail.mjs`**: with no day files it wrote every town's hail file empty with `through: ''`. **Fixed**:
   refuses to build from zero day files. `hail/merge-storms.py`: the final JSON check read `hail-paths.json` even when there is none
   on the server, crashing after a good merge. **Fixed**: checked only when present.
10. **Prospect Desk, `desk.php` render/queue** (left for the Prospect Desk build): the ~4.5 KB HTML body is stored on every
    preview row (up to 2,000) and in `queue.json`, which `sendQueue` rewrites per send. Render the HTML at send time instead.
11. **Prospect Desk, "No tracking pixel"** (left): a hosted `<img>` is still fetched on open by every mail app that does not proxy
    images, so the access log records opens. Reword the comment and the Email page help ("we do not track opens; mail apps that
    load pictures still fetch them from our server").
12. **Regions warmer** (`tools/regions-warm.php`, verified on the server, read-only): the hourly log says "rebuilt" far more often
    than "fresh" (84 to 24). Traced to the deploys of the night (`company.json` and the API's mtime are in the signature; each
    deploy rebuilds all six installs twice, 7 s each) and the new day at midnight. Not a bug; worth watching on a quiet day. If it
    keeps rebuilding, the signature's `filemtime(__FILE__)` is the term to question.

## Low

13. **API, `logoset`/`logodel`** require `$role === 'admin'` while `companyset` takes `adminOr('set.company')`: a role given the
    Company screen can edit the name but not the logo (left for the branding build; one-line change).
14. **Page, `lockedView`/`setupHome`** still carry a `bill` branch ("the app is paused for your team until the plan is paid") that
    cannot run since `lockOn()` excludes `kind === 'billing'`, and is now also wrong (only door data pauses). Left for the narrowed
    lock build: delete the `bill` ternaries.
15. **Page, paused screens**: `hailView`, `hailMapView`, `stormDayView` and the door/followups/mydoors screens are in
    `PAUSED_SCREENS` but do not start with `if (payLockOn()) return pausedView();` like `stormView`/`planView`, so they open, the API
    refuses, and `lockHit` bounces a tick later (a flash). Left for that build.
16. **Page, `LOCK_SCREENS`** lacks `geo` (the "where accounts are used" link on Accounts): an admin opening it during setup is bounced
    to `setupHome` by the next 403. Left for that build.
17. **Page, Profile**: "Your code works on one phone and one computer at a time" was shown on editions too, where a tablet is a third
    class since 2026-10-29. **Fixed**: the edition wording says phone, tablet and computer.
18. **Page, `coLogoBlock.send()`** calls `companyView()` after a logo save and rebuilds the whole form, losing name/phone edits not yet
    saved. Left for the branding build.
19. **Pipelines, `moved/build-moved.mjs`**: the 12-month cut `(y0-1)*12+m0` is inclusive of the same month last year (13 months, in
    coverage.json only). Towns absent from `assessor/town-county.json` are skipped silently. Left; cosmetic.
20. **Pipelines, `security/fetch-denver-alleys.mjs`**: no retry and no `orderByFields` on offset paging (the fetch-arcgis comment says
    pages may overlap without one). Left; reuse `fetch-denver-parcels.mjs`'s `page()`.
21. **Pipelines, `solar/build-solar.mjs:56`**: `nearest(...)[1]` throws on an empty list (pv-grid with no block for the key). Left.
22. **Pipelines, `merge-edition-index.py`** recounts only when the door count differs from live, so a re-pull with the same door count
    but different area count keeps a stale `areas` (unverified at runtime). `recount-index.py` labels with `abspath(d)` after
    `chdir(d)`, so a relative dir is named wrongly. Left; cosmetic.
23. **Spanish**: eight new fragments had no key (`Customers see: `, `Connected as `, `to add`, `Row `, `Priced per `, `covers`,
    `Use `, `Estimated cost `). **Fixed** in `i18n/es.json`. Still English by construction: plurals made by appending `s`
    (`COST_UNIT[r.unit] + 's'`, `roleName('crew') + 's'` gives "Vendedors"). Left; needs a plural form in the dictionary.
24. **`desk.php` `deskOrigin()`** trusts `HTTP_HOST` for the image and unsubscribe URLs; `logoUrl()` in rounds.php validates the host
    with a regex and falls back. Left for the Prospect Desk build (signed-in users only).

## Cleanup

- **Fixed**: `travMail()` was a second copy of the SMTP client beside `smtpSend()`; it now calls `smtpSend` (which sends one-part
  `text/plain` when given no HTML). The mock path (`TRAV_MAIL_MOCK`) is unchanged, so billlock-test's seat and lock notes still pass.
- **Fixed**: `$roofOf =roofDataOn(` (rounds.php), `$json =json_encode(` (nightly-backup.php), unused `RADAR_URL` (page), the
  `build-moved.mjs` header comment that described `counties` as `[name, asof]` (the code and the PHP reader use three parts).
- Left: `inRing`/point-on-segment helpers are written four times across `security/back-road.mjs`, `check-back.mjs`, `check-lot.mjs`
  and `solar/build-solar.mjs` (the checks say "no shared code" deliberately; the builds could share one); `parseCSV` twice
  (build-moved, build-permits); `check-back.mjs:164` imports `node:fs` dynamically though it is already imported; `S.permOffL` set
  and never read; two swapped trailing comments at the `permBox` line; `costsQuoteLine`'s unused `picks`; `rectS(...).replace(/ fill=""/)`
  in `build-maps.mjs`; the hard-coded 'Denver' default in two places of the Prospect Desk.
- Comments that now lie were looked for (`$50`, "about 25%", "2 business days", "one phone and one computer"): the first two are gone
  from code and copy (the billing header says the uplift was removed; the page reads `setupDays` from the server). No `console.log`
  or TODO left in the new page code.
- Licence notes missing in READMEs (left, documentation): moved/README names no licence for Arapahoe, Elbert, El Paso, Douglas,
  Adams, Weld, Boulder (its "internal use only" is the weakest) and Larimer; permits/README has no written reuse terms for Thornton,
  Parker, Centennial and PPRBD and flags Aurora's CC-BY-SA; hail/README does not state the Iowa State mtarchive terms.

## Not bugs, checked

- `tr -d ""` in `run-cloud-finishers.sh` is a literal carriage return inside the quotes (checked byte by byte).
- `movedSide()`/`houseSide()` read the whole town file per area request, as `loadSide()` with `$only` already does; `leadsAllRaw()`
  is memoised per request, so `jobItemItems()` per job is cheap; the shared weather folder on the host holds 6 KB (no zones yet).
- `wxDoorMatcher` reads `alerts-cache.json` and `zones.json` once per area request; zones.json does not exist yet on the host.
- `billLockNote` writes `lock_noted` once per lapse; `seatWatch` writes `seat-over.json` only on a change of state.
- `webLead()`'s new `mhand` clause, `jobphoto`/`jobphotoget` widened to `jobOpen()` (Jen's quote account), and `pipeMine()` for
  Matthew's Sixfold stats are as Matthew asked on 29 Oct.

## Tests

Harness: `scratchpad/ptest-rv` (copy of `ptest-roles`, port 8791, Chrome debug ports 8xxx, wx mock 8793, SMTP sink 18793) and
`scratchpad/ptest-rvbl` (copy of `ptest-bl`). Two harness problems fixed in the copies, not the code: `mode.cjs` lacked
`billexempt` for the edition (every door call answered 403 'locked' in setup mode); `reps-test`'s `day(n)` moved a Sunday to Monday,
so from a Friday `day(2)` and `day(3)` were the same Monday and the second booking was refused as taken (the bl copy's
`batch1029-ui-test` also moved off the shared 18773 sink). New: `dupfn-test.mjs` (duplicate function statements, the phone regex, the
BOM strip, `copyBtn`).

Before (main at `1bb4f2a`, the harness fixed) and after (this branch at the merge of `a285cc2`), same machine, same harness:

| suite | edition before | edition after | Sixfold before | Sixfold after |
|---|---|---|---|---|
| card | 18/0 | 18/0 | 1/1 (page timeout: tools) | 1/1 (same) |
| accounts | 34/0 | 34/0 | 26/1 (timeout: tools) | 26/1 (same) |
| payments | 20/0 | 20/0 | 20/0 | 20/0 |
| roles | 73/2 (terms pre-accepted by run-ed.sh, as in the bl2 run) | 73/2 (same) | 75/0 | 75/0 |
| rolepreview | 9/0 | 9/0 | 9/0 | 9/0 |
| reps | 14/4 (the Friday day() fault) | **37/0** | 14/4 | **37/0** |
| batch1029-ui | 13/2 (shared SMTP sink) | **43/0** | 43/0 | 43/0 |
| wx | 40/0 | 40/0 | 40/0 | 40/0 |
| mailapp | 15/0 | 15/0 | 15/0 | 15/0 |
| board | 28/0 | 28/0 | 28/0 | 28/0 |
| crew | 30/1 (timeout: thumbnail) | 30/1 (same) | 30/1 | 30/1 |
| mydoors | 30/0 | 30/0 | 30/0 | 30/0 |
| onetown | 20/0 | 20/0 | 20/0 | 20/0 |
| billlock (ptest-rvbl) | 97/0 with the pre-narrowing suite | **111/0** with the narrowed-lock suite from `ptest-perm` (the old suite fails 7 by design: it expects the pipeline shut) | | |
| dupfn (new) | 3/2 before the last two fixes | **5/0** | | |

The remaining failures are the same before and after and are the harness, not the app: `roles-test`'s two terms checks need the
terms not pre-accepted (`run-ed.sh` pre-accepts; the bl2 run script runs it alone), `crew-test`'s thumbnail and the Sixfold
`card`/`accounts` "timeout: tools" are Chrome timeouts on this machine (the 29 Oct reference runs show them passing). viewas-test
prints its summary on a line `run-ed.sh` does not catch, as before.

Build: `node i18n/sync-es.cjs && node ../editions/build-editions.cjs && node ../editions/minify-page.cjs` passes (the worktree needs a
junction to the main repo's `node_modules` for terser and csso; the local build rewrites the tracked `data/rounds/company.json`
from the town files the worktree does not have, so that file was put back and not committed); `php -l` clean on rounds.php and
nightly-backup.php; `node --check` clean on the three changed .mjs files; es.json parses.

### Found by the new check, after the first run

25. **Page, `longDay` defined twice** (~9328 locale-aware, 2026-10-14; ~15589 an older English copy with `WDAY`/`MONTH_L`). The
    older one won, so the 10-14 one never ran and Spanish devices got English day names in the booking texts. Same output in
    English. **Fixed**: the older copy removed (its `WDAY`/`MONTH_L` arrays stay; the calendar uses them). Pre-existing, not from
    tonight's merges.
26. **Spanish sync turns `﻿` in the page source into the invisible character itself** (`sync-es.cjs` rewrites index.html):
    the BOM strip from item 7 came out as `/^<BOM>/`, which works but cannot be seen. **Fixed**: written as `charCodeAt(0) === 0xFEFF`.
    Worth knowing for anyone writing an escape in the page.
