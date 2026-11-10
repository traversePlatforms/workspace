# Overnight review 9-10 Nov 2026: side apps and laptop tools

Area: Matthew's assistant + hub, Prospect Desk, Post calendar, Peak desk, personal apps (Star Station), laptop tools and scheduled jobs,
the server's other jobs, and a read-only look at the data-pipeline scripts the VM runs. Written for Matthew, 10 Nov about 12:30 am MT.

Nothing was sent, posted, queued or approved. The Prospect Desk batch kept sending the whole time (15 an hour; 681 waiting at 11 pm, done
about Wed 11 Nov evening). Queue, send-after, events.log and the cron were not touched.

## 1. Fixed and live

### Peak desk: company look-ups lost every phone, email and address on some websites (hourly job)
- **What was wrong:** the server's PHP log had "Passing null to parameter" warnings from `scan.php` on every hourly rescan since 7 Nov.
  Cause: when a company's website is not UTF-8 (older Latin-1 pages), one text clean-up step returned nothing, so the look-up came back
  with no phone, no email and no address for that company, and the page said "0 phones 0 emails".
- **Change:** `matthew/peak-pickleball-sponsorship/app/api/scan.php`: the page text is converted to UTF-8 first and the step can no longer
  come back empty.
- **Proof:** the old file on a Latin-1 test page: `phones=[] emails=[] addr=` plus the warning. The new file on the same page:
  `phones=["7195550100"] emails=["info@example.com"] addr=123 Main Street, Colorado Springs, CO 80920`. UTF-8 pages unchanged.
- **Live:** `public_html/peak-desk-28d38d/api/scan.php`, md5 2146d0a1 matches the repo; `php -l` clean; the rescan ran clean after upload.
- **Backup:** `~/upload-backups/before-peak-review-20261109-232826.tgz` on the server.

### Peak desk: a tour for "today" was refused after 5 pm
- **What was wrong:** the server's clock is UTC. `desk.php` never set a time zone, so after 5 pm Colorado time "today" already counted as
  tomorrow and booking or moving a tour to today answered "Pick today or a later day".
- **Change:** `matthew/peak-pickleball-sponsorship/app/api/desk.php` sets America/Denver like the Prospect Desk does.
- **Proof:** the desk test suite run at 11:20 pm MT: old code 120/126 with "a tour for ABC today" FAILING; new code 122/126 with both tour
  checks passing. The four that still fail are the same on both: three need a website fetch (hotel Wi-Fi) and one is a headless-browser
  light/dark check.
- **Live:** `public_html/peak-desk-28d38d/api/desk.php`, md5 f27d615c matches the repo. Same backup as above.

## 2. Fixed but not live

Nothing. Everything else below is a report, not a change.

## 3. For Matthew

1. **The repo copy of `traverse/app/tools/meta-leads.php` is behind the live one.** The live file (the 5-minute SiteGround job) has four
   extra lines that start the post calendar's runner; the repo copy does not. `deploy-app.sh` does not copy meta-leads.php, so nothing
   breaks today, but if that file is ever uploaded from the repo the post calendar stops publishing with no error. It is the app agent's
   file, so I did not touch it. **Recommendation:** copy the live file into the repo (I can do it in a minute; the diff is only those four
   lines) and commit.

2. **Prospect Desk, `desk.php` line 358:** the "usage" line writes to `STDERR`, which PHP does not define when a script is fed on stdin.
   That is why the 6 Nov loader scripts died with "Undefined constant STDERR" in `prospects-47bfe6/api/php_errorlog`. The cron's
   `sendqueue` never hits that line, so sending is unaffected. One-line fix (`fwrite(fopen('php://stderr','w'), ...)`) but it is in the
   sending file, so I left it until the batch finishes about 11 Nov. Say the word after that.

3. **Two old `desk.before-*.php` copies sit inside `public_html/prospects-47bfe6/api/`** (1 Nov). The site's .htaccess refuses them (I
   checked: 403), so nobody can run them, but the 25 Oct rule is that backups go in `~/upload-backups/` only. Moving them is safe at any
   time; I left the folder alone during the batch. The same goes for ten `index.before-*`/`desk.before-*` copies in `peak-desk-data/`
   (outside public_html, so only clutter).

4. **Data-pipeline scripts (review only, as asked; nothing edited).** A read of the VM and finisher scripts found these, worst first.
   None affects the VM's current measuring; they matter when a finisher is run.
   - `door-territory/fill1031-finish.sh` (lines 103-106, 129), `gap1108/finish-gap-2026-11-08.sh` (49-56), `gap1108/finish-rent-2026-11-08.sh`
     (30-37): the build steps are piped through `tail`/`head`, so a crashed roof/solar/photo/yard build still counts as success and the
     finisher pushes whatever side files were on disk. Fix: `set -o pipefail` after `set -u`.
   - `finish-gap-2026-11-08.sh` line 42: `[ -f f ] && node merge ... || step "no new neighbourhoods"` reports a FAILED merge as "no new
     neighbourhoods" and carries on to upload. Fix: an if/else with an exit on failure.
   - `finish-gap` line 63 and `finish-rent` line 44: `upload-towns-sixfold.sh` exits 0 with "another upload is running" if a stale
     `logs-upload/lock` folder is left behind, so a skipped Sixfold upload counts as done. fill1031-finish.sh checks the `.done` marker;
     these two should too. (No stale lock exists right now.)
   - `gap1108/gapb-vm.sh` line 73 and `rentb-vm.sh` line 59: `.vmdone` is written even when some town steps never finished, so the finisher
     cannot tell a town with no trees/roof/yard from a finished one. Also the yard loop never accepts rc 3 the way `lawnfix.sh` does.
   - `finish-gap` line 37 / `finish-rent` line 27: the "before" copy of the caches is overwritten on a same-day retry (fill1031-finish does
     `[ -f before ] || cp`).
   - `finish-hail2min-2026-11-01.sh` says "safe to re-run" but would now REPLACE the live hail-hours.json and drop the 10 am / 11 pm hours
     hail1023 merged in. It is marked done so it will not run by itself; just do not re-run it by hand.
   - `fill1031-finish.sh` line 21: rollback copies go under a hard-coded old session folder in Temp (Storage Sense can empty it);
     `%LOCALAPPDATA%\ProjectBackup\cloud-finish` is the better home, as push-edition.sh already does.
   - `traverse/ops/run-cloud-finishers.sh` line 9: a stale `running.lock` after a crash could block every finisher if Windows reuses the PID.
     Add an age check (older than 12 h = stale).
   - `gapb-vm.sh`: `while read ... < b-towns.txt` without `-u 3`; works today because no child reads stdin, but rentb-vm.sh's pattern is safer.
   **Recommendation:** when the gap1108 batches get your GO, fix the first three in the two gap finishers before running them (10 lines).

5. **Items for the app agent, seen in the server logs, not mine to fix:** `public_html/api/php_errorlog` has "Allowed memory size
   exhausted" fatals in every edition's rounds.php on 6 Nov 22:05-22:13 MT (one burst, likely a one-off big request) and four "Cannot
   redeclare moRoot()" fatals on 2 Nov from including both mail-oauth-lib copies in one process. Nothing since.

6. **Stale laptop tools, harmless:** `shared/tools/Backup-ToOneDrive.ps1` and `Register-BackupSchedule.ps1` still target the OneDrive
   mirror that was retired 13 Oct. Running Register-BackupSchedule would re-create the old task. Archive or delete when convenient.

7. **Assistant housekeeping:** 71 empty `sess_*` files in `assistant-private/data/` (one per signed-out visit; PHP's own clean-up is off
   on this host). Harmless; a one-line cron clean-up if it ever bothers you.

## 4. Checked and fine

- **Assistant:** repo and live code byte-identical (14 files). Never sends on its own: the only send path is the page's Send button with
  `confirmed` true; the Ask chat's tools are list/search/read/draft/mark done, no send. OAuth has a per-session state check; tokens refresh
  (all four inboxes checked 11:00 pm MT, no reconnect flags); the 10-minute check has run 2,660 times since 22 Oct with one error ever
  (before the key was pasted). Spending tracker works: $0.10 this month, 77 calls. Password lockout, same-origin POST check, HttpOnly
  cookies, keys never returned to the page, data folder 0700. Last sign-in failures were 31 Oct (yours).
- **Hub:** live equals repo; tabs are same-site frames; nothing stored.
- **Prospect Desk:** live desk.php = repo (md5 c521c6be). Queue test 49/49 on this laptop. Sending steady: 360/360/339/226/336 a day
  3-9 Nov (the 226 is the 8 Nov pause); only two "connection closed" retries, both resent. Bounce scan runs hourly. Unsubscribe needs a
  POST (scanners cannot unsubscribe people), click links are token-checked, sign-in has per-IP and global limits.
- **Post calendar:** live = repo (page, api, runner, lib). Test 122/122. Approve is admin-only and fingerprinted; the runner re-checks the
  fingerprint, claims under a lock, never retries by itself, scrubs tokens from every error. State: 30 drafts, 1 published, nothing
  approved or stuck. Media folder listing refused (403).
- **Peak desk:** live = repo after the upload; hourly rescan runs; Hunter key file 0600.
- **Star Station (Roblox):** all 24 Lua files compile with luau-compile; every `Enum.Material` and other Enum name used is a real Roblox
  name (the 19 Oct CorrugatedSteel trap is gone). Nolan's username is not in the game, only `Config.ExclusiveUserId`. Not published, as
  it should be.
- **Scheduled jobs on this laptop:** all 7 of yours exist and their script paths resolve through the `C:\Users\Surge Inc` junction.
  Google Drive backup: ran 8:14 pm tonight (core-2026-11-09.7z, 1,492 MB, tested; GitHub sync ok). Traverse server backup: 1:45 am ok,
  30 copies kept. Overnight check: every 30 min, "all fine". Wi-Fi queue: everything done. Help watcher: running. The "Search Console"
  reminder fires 15 Nov. The only non-zero result code is the watcher's 0x800710E0, which is Windows saying "already running", normal.
- **Server jobs:** there is no `crontab` on the host (SiteGround Site Tools runs two jobs: meta-leads.php every 5 min, morning-email.php
  hourly). Every script those start exists and its log shows success tonight: assistant check, post-calendar runner, Peak rescan,
  bounce scan, sendqueue, search warm, regions warm, fuel prices, care sweep, edition EOD, trial sweep.
- **Laptop tools:** Backup-ToGoogleDrive.ps1, github-sync.sh (strips Surge notes, checks, pushes), Extract-Docx.ps1, Open-Desktops.ps1,
  overnight-check.sh, minify-public.cjs read through; nothing wrong. All use the old `Surge Inc` paths, which work through the junction.
- **Public exposure:** `php_errorlog` files and `*.before-*` copies under public_html all answer 403; secret files (`secret.key`,
  `hunter.json`, `meta-token` folder, `kroger.json`, `config.json`) are 0600 outside public_html.
