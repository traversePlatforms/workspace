# Overnight health check: live systems and data, night of Tue 10 Nov 2026

Run about 10:40 to 11:00 pm MT. Server checks were made from the server itself (the hotel Wi-Fi gets SiteGround's bot page).
Nothing was sent, posted, queued or approved. No live data was changed.

## 1. Needs Matthew

### A. The Traverse Google account stopped working about 7:30 pm (new tonight)
Two separate signs, same account (m.sharpe@traverseplatforms.com):

- **Prospect Desk follow-up emails stopped.** Last one went out 7:28 pm. The 8, 9 and 10 pm runs each got this from Google:
  `534 5.7.9 Please log in with your web browser and then try again (WebLoginRequired)`. The desk stopped cleanly each time and kept the
  next email for the following run, so nothing is lost and nothing was half-sent. 838 of the 1,211 follow-ups are sent, 373 are waiting.
  It was a steady 15 an hour all day until then. It will keep trying once an hour by itself.
- **G: (the Traverse Google Drive) is not on the laptop.** The laptop restarted at 6:29 pm. H: (Surge), I: (Sixfold) and J: (personal
  Gmail) came back; G: did not. The 5 pm backup goes to `G:\My Drive`, so **tomorrow's 5 pm backup will fail** unless G: is back.
  Today's 5 pm backup did finish (1,645 MB, tested, in Drive, GitHub sync ok).

The Traverse Workspace trial was due to end 10 Nov, which would fit both, but I could not confirm that is the cause. What to do: sign in
to m.sharpe@traverseplatforms.com in a browser, check whether the Workspace went paid or was paused, then sign that account back in to
Google Drive for desktop. Once the mailbox takes sign-ins again the desk carries on with the 373 by itself; I did not touch its queue,
cron or send-after.

Also uses the same mailbox, so probably affected until it is fixed: the Traverse website's own emails (demo booking, trial sign-up and
set-up emails; `traverse-site-private/site-config.php`) and the five edition templates. I found no failed send from those tonight, only
the desk's. Sixfold's emails use other accounts and are fine (tonight's 8 pm End of day report went to both people).

### B. J: (personal Gmail drive) shows 100 GB, 0 free
Not used by any job here. Only worth knowing if that account's mail or photos start bouncing.

### C. Drag guard is not scheduled
`shared/tools/drag-guard.ps1` last ran once at 5:26 pm ("ok"). There is no Windows task for it; `shared/tools/drag-guard-install.ps1`
still needs you to run it (scheduling was refused to me). The laptop is quiet right now (see section 3, Laptop), so nothing is piling up.

### D. JARVIS is up, but on its slow path
From this Wi-Fi the 5-second check gets SiteGround's bot page, so the watcher has fallen back to reading over SSH every 30 seconds (its
built-in fallback, log line 10:20 pm). One watcher is running, nothing is waiting (Sixfold 0, practice 0), last ticket was 9 Nov. A new
message should be picked up within about 30 seconds instead of 5. I did not send a test message, so this is from the watcher's log and
the server's waiting count, not from a real reply. It goes back to the fast check by itself on a network SiteGround accepts.

### E. Small things, no action tonight
- Sixfold's live town list holds McKinney, Plano and Frisco (Texas, tabled) with no door files. The app skips them (the signed-in towns
  answer has 420 towns and none of the three), so nobody sees them. In the index since October, not new.
- 365aeration.com/privacy/ is a 404. The homepage does not link to it, so no broken link, but aeration365.com/privacy/ forwards there.
- sixfoldcolorado.com certificate ends 20 Dec 2026 (SiteGround normally renews by itself; worth a look in early December). The others
  end in January.

## 2. Fixed (with backup)

- **The half-hourly overnight check called a running backup a failure.** Today it logged "Backup ... ended with code 267009" twice
  (1:45 am and 5:15 pm). 267009 is Task Scheduler's code for "running right now". `shared/tools/overnight-check.sh` now says
  "running now" for that code and still reports any real failure. Backup of the old file:
  `%LOCALAPPDATA%\ProjectBackup\push-tmp\overnight-check.sh.before-1110-night`. Syntax checked; its first real run is the next
  half-hour check. This was the only file I changed.

## 3. Healthy

### The seven app installs (Sixfold, practice copy, Roofing, Yards, Solar, Pest, Security)
- Every page 200; the served page is byte-for-byte the file on disk; sw.js and es.json 200.
- version.txt matches the stamp inside each page (Sixfold 3bc3739086f1, practice 569f8340a392, Roofing 518d374803bd, Yards 46d38be7e001,
  Solar 2df7c16a4283, Pest 322f012eb8fe, Security 250283a3021a).
- `deploy-app.sh --check`: 0 of 72 live files differ from the laptop's build.
- All seven APIs answer 401 signed out (regions, me, leads). All API files pass a PHP syntax check.
- **PHP error logs: nothing since 6 Nov.** No fatals or warnings after pipestages-1110, minestages-1110, metaagain-1110 or rmother-1110.
- Signed in read-only as Claude Check on the six installs (not the practice copy): sign-in, me, towns and leads all 200, sign-out, then
  401 again. Towns shown: Sixfold 420, Roofing 422, the other four 418. Towns answer about 0.2 s.

### Town data after today's gap upload
- Live index: Sixfold 424, Roofing 422 (418 + 4 commercial), Yards / Solar / Pest / Security 418. No duplicate keys.
- Every town in every edition's index has its door file. (Sixfold: all but the three Texas towns in E above.)
- 177 towns were touched today (El Paso 12 new + 10 merged, mountain 3 new + 152 merged). All are in every index.
- Every JSON file changed since 10 Nov was parsed whole: Sixfold 384, Roofing 1,054, Yards 742, Solar 1,054, Pest 742, Security 565.
  **None truncated or invalid.**
- Door and neighbourhood counts inside each touched town's door file equal its index line, on all six.
- Every town's door count on all six live indexes equals the laptop's `traverse/app/data/rounds/index.json` (0 differences; the touched
  towns total 278,515 doors). Sixfold's three extra entries (bailey, barnes-brighton, looked-up) are its one-off properties, still there.

### Sixfold leads data
- `leads.log`: 164 rows, all valid, no duplicate ids, clean UTF-8, ends with a newline.
- `leadst.log`: 1,102 rows, all valid, **no row points at an unknown lead**, all times sensible, no broken characters. 64 rows stamped
  today (55 Matthew, 7 Jen, 2 Facebook). 13 rows are out of time order: those are back-dated history rows; the file still loads.
- Recall dates: 26 set, all real dates (29 Oct 2026 to 2 Mar 2027).
- `company.json` valid; metaMineAgain = 2026-11-10 12:40, metaMineAgainTo empty (no end yet), both in the right format.
- The app itself reads them: the signed-in leads answer returns 164.
- Every other Sixfold data file changed in the last 36 hours (250 files) parses. Nothing needed a backup or a repair.
- Not checked: whether each hand-added history row says the right thing for that person. I checked shape, ids and dates only, and did
  not open the rows' text.

### Side apps and sites
- Post calendar: page 200, API 401 signed out. 45 posts: 44 drafts, 1 published (the 5 Nov reel). **All 14 toy-drive posts are drafts with
  no approval.** Next due is Wed 11 Nov 3 pm (Surge toy drive); as a draft it will not post. No post has an error.
- Assistant: page 200, API says signed out. Peak desk: 200, API 401. Prospect Desk: 200, API 401 (sending: see A).
- Hub, Traverse homepage, editions, start, find, demo, terms, privacy, sitemap, robots: all 200.
- 365aeration.com 200 (/sign/ and /q/ 200); aeration365.com forwards to it; sixfoldcolorado.com forwards to it (as set up 23 Oct).
  I did not submit the website form (a test would have made a real lead).
- Surge staging: home, team, careers, contact 200; still noindex with the staging robots.txt. Live surgeftw.com 200. Not touched.
- No PHP errors logged since 10 Nov on the 365, Sixfold or Surge accounts.
- Sixfold emails: Morning email sent 10 Nov; End of day sent 8:01 pm to both.

### Laptop
- Tasks: Drive backup 5:00 pm ok; Traverse server backup 1:45 am ok (4,484 files, 27 MB); Overnight check every 30 min ok; weekly refresh
  9 Nov ok; Help watcher and Wi-Fi queue running. Permit refresh and the Search Console reminder have not come due yet.
- Wi-Fi queue: one `rented` job, waiting, checking the cloud stage about every 23 minutes. **No pile-up:** 6 bash, 6 sleep, 2 PowerShell,
  no node. CPU idle. Memory 15.9 of 31.6 GB free. C: 733 GB free.
- The half-hourly check ran 37 times today; its only problems were short SSH drop-outs on the hotel Wi-Fi (5 times) and the false backup
  alarm fixed above.

### Cloud computer (read only)
- Up 17 days, disk 64%, load about 1.2. `rentb` is on its yard-measuring step: 221 of 372 lists done (56 on the 9th, 89 on the 10th,
  76 so far on the 11th, UTC days), status line fresh. 151 lists left on this step; at the recent pace that is very roughly a day or
  two, and I do not know whether more steps follow it. Nothing touched.

### Server space
- The "85%" is SiteGround's shared disk, not this account. The account is 14 GB and about 261,000 files (budget 400,000).
- upload-backups: 3.2 GB, 844 files; today added 68 files, 154 MB. No backup copies sitting inside public_html.
- Biggest files that changed today are the six search indexes (142 MB each, rebuilt through the day). Nothing growing fast.
