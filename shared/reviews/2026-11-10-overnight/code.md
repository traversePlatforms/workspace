# Overnight review, 10 Nov 2026: today's code changes

Every commit made on 10 Nov was read line by line (14 commits; the app page and API, the hand-save tool, the two sign-in changes,
the drag guard, the Wi-Fi queue scripts, the gap and rented-homes scripts, the roof scripts, the toy drive scripts, and the Surge
site's redirect rules and deploy scripts). Two real
problems were found and fixed. Nothing was sent, posted, approved, scheduled or deleted. Jen's screens were not touched.

## 1. Fixed and live

### My pipeline: a link to a lead opened an empty screen (app, Matthew's sign-in only)
- **What was wrong.** Since today's stage tabs, My pipeline shows nothing until a stage is picked. But the links that point at one
  lead (the new-lead alert on your phone, Person search, "Open it" on a possible double) still opened My pipeline with no stage
  picked, so the lead you tapped through to was not on the screen. With Facebook leads coming to you again, that is the link you
  will tap most.
- **Fix.** When a link points at one of your leads, My pipeline opens the stage that lead is in (and on a phone scrolls to it).
  If the lead is not yours, nothing changes. Jen's Pipeline, other admins and the editions are unchanged.
- **Proof.** A test that pulls the My pipeline block out of the page and runs it: 11 of 11 pass on the new code; the same test on
  this afternoon's code fails the 3 link cases. It also confirms the tab counts add up to the "My pipeline (N)" total, the tabs are
  in Jen's order, To call uses the same call groups, and Transferred from Jen sits on top inside a stage.
- **Live.** Commit `bce16aef`. Deploy label `overnight-1110-minelink`, ended "all checks passed" (72 files, MD5 match), practice
  copy deployed too. Server backup: `~/upload-backups/before-overnight-1110-minelink-20261110-230134.tgz`. Checked from the server:
  page 200, signed-out API 401, live page md5 equals the local build. Only the page and version stamps differed from live; the API
  was already identical (so today's rounds.php changes were all live before I started).

### Wi-Fi queue: the rented-homes job would have been marked "finished" without ever running
- **What was wrong.** When the laptop joins your iPhone hotspot, the watchdog stops the running job. I tested what the queue sees
  when that happens: exit 0, the same as "finished". Until today that hardly mattered because the rented job ran for 5 seconds at a
  time. Today's pile-up fix makes it wait 23 minutes at a time, so the next time the laptop joined the hotspot the queue would
  have marked `rented` done and the finisher would never have run on 12 Nov. The watchdog also stopped itself along with the job,
  usually before writing its pause flag or its log line.
- **Fix (commits `ea41a1a3` and `4622ceed`, laptop scripts only, the VM and what it runs were not touched).**
  - `wifi-queue.sh`: a job stopped for the hotspot counts as "resume later", never finished or failed.
  - `hotspot-watchdog2.sh`: writes the pause flag first, no longer stops itself, and takes back a wrong "finished" mark made in
    the seconds after a stop. One watchdog per job: a second copy ends at once, so they cannot pile up again whatever else goes
    wrong. If the process list stops answering for 10 minutes it ends instead of looping.
  - `upload-towns-sixfold.sh`: its lock now names its owner. Before, an upload stopped from outside left the lock behind, and every
    later upload said "another upload is running" and ended as a success having sent nothing.
  - `gap1108/finish-rent-2026-11-08.sh`: waits off the hotspot before every upload (the only hotspot check was at the very top,
    hours earlier), and counts a Sixfold batch only when its `.done` marker exists, with three tries.
  - `jobs/rented.sh`: does not build and upload everything a second time if the finisher already reached the end.
- **Proof.** Stop test: a job stopped the watchdog's way came back as exit 0. Sandbox run of the new watchdog with the network
  name swapped to the current one: flag written, job stopped, watchdog still alive to log it, a second copy ended at once. Lock
  test, 5 cases (free, dead owner, live owner, old lock fresh, old lock 3 hours old): all correct. All five scripts pass a syntax
  check. `GO-rented` was not created and the finisher was not run.

## 2. Fixed but not fully in effect yet
- **The queue runner in memory is still this afternoon's version.** The fix in `wifi-queue.sh` takes effect the next time the
  runner starts (a restart or sign-in; the 30-minute task only starts one when none is running). I tried to stop the runner so it
  would restart and was blocked from doing that. It is covered meanwhile: the watchdog (which starts fresh with every job) removes
  the wrong "finished" mark itself. No action needed; restarting the laptop some time before 12 Nov makes it belt and braces.

- **One odd line in a watchdog log, harmless.** I edited `hotspot-watchdog2.sh` while the 10:40 pm watchdog was still running
  from it, and it printed "line 21: : command not found" before ending normally at 11:04 pm. The job it watched had already ended
  as it should (exit 4, "will resume"). Nothing was stopped or lost.

## 3. For Matthew
- **Drag guard is not scheduled.** I did not schedule it. The script parses cleanly and a no-stop copy ran clean ("ok, memory
  available 15.9 GB"). To switch it on: right-click `shared/tools/drag-guard-install.ps1`, Run with PowerShell.
- **Remove lead, "Other".** The note says "Matthew's sign-in only" but the code shows it to every admin who is not using View as
  (any other admin sign-in would see it too). Jen and the office do not see it. Left as is; say if it should be yours alone.
- **Jen's alert links have always opened her Pipeline with no stage picked.** Same thing I fixed on yours, but it is her screen
  and it was that way before today, so I left it. Say if you want hers to open the lead's stage too.
- **Rented-homes finisher, read end to end.** Paths with the space in "Matthew sharpe" are fine (it uses the short path, and
  `C:\Users\Surge Inc` is a link to your folder on this laptop). The editions build step is there. All 421 Sixfold towns have a
  file to send, no batch is empty, `APP-READY` exists. One thing left alone: if the laptop joins the hotspot in the middle of the
  build (not the upload), the watchdog stops the build programs and some build steps do not check for that, so a side file could
  be built short. The main door build does check and stops the run. Low odds; easiest is to stay off the hotspot while it runs.
- **Old watchdog (`hotspot-watchdog.sh`, no pattern).** The drag guard would stop it after 2 minutes as "its job had ended". The
  queue does not use it, only the October runners do. Mention only.

## 4. Checked and fine
- Facebook leads to Matthew again (`metaMineAgain`): live setting is 10 Nov 12:40 pm, no end. On the server: 3 Facebook form
  leads since then, all 3 yours; 42 between the two periods, the only ones of those in your pipeline are the 14 transferred from
  Jen; Messenger still goes to Jen. Alerts, the 15-minute nudge, the office lists and counts all go through the one rule.
- Full pipeline in Jen's stages: your sign-in only (not other admins, not View as, not the editions). Door bookings map onto the
  stages; Won-not-in-Customers still shows.
- Remove lead "Other": server needs 3+ characters, caps at 200, marks Lost with the reason as the note; nothing else reads the
  reason in a way that breaks.
- `hand-save.php` lookup homes: matches the lookup file's shape; a listed door still wins over a lookup home.
- Assistant and post calendar one-year sign-in: no leftover 14-day or 60-day limit anywhere.
- Roof scripts (`sample-roofs.mjs`, `outline-photos.mjs`): parse, and the skips sit inside the right loops.
- Toy drive: `make-manifest.mjs` rebuilds the same manifest from `posts.md`; 14 posts, all Mon/Wed, pictures all present,
  countdowns match the dates. Calendar posts not touched, nothing approved.
- `upload-gap-2026-11-10.sh`: one-off, already run; no stale upload lock left behind.
- Server PHP error logs: nothing new in the last 25 hours.
- Surge site commits (`.htaccess` redirects for the old WordPress addresses, `serve-surge.mjs`, `toggle-noindex.mjs`): the two
  scripts parse and the local preview table matches the `.htaccess` rules. Nothing uploaded; the live Surge site was not touched.
- Queue right now: one runner, one rented job, one watchdog (checked again after the fixes).

## 5. Could not check
- The My pipeline fix in a real signed-in browser or phone (tested by running the page's own code against a fake page, not by
  signing in).
- A real hotspot stop on the real queue (simulated in a sandbox).
- The finisher itself (read only, never run) and the drag guard's actual stops (ran a copy that only reports).
