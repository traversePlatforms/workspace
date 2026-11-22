# Test health check, 22 Nov 2026

Run on the Azure VM (Ubuntu, 4 vCPU), not the laptop. Repo state: committed HEAD `e16ea0ec` (laptop edits that were not committed are not in it). Report only: nothing fixed, nothing deployed, no live server touched.

## Result

**34 suites found: 22 run, 12 skipped. Of the 22 run, 15 pass and 7 fail.** The 12 skipped are the Peak desk and prospect desk suites (gitignored data) and the 10 older traverse harness suites (Windows-only harness). Of the 7 failures, 2 are stale tests (outbox, hub-tabs), 1 is unsettled and worth a look on the laptop (leadfix), and 4 are the VM or test setup (jarvis, pc-ui, trial-copy-check, words-same). None points to a broken live feature.

| Suite | Passed / total | Time | Result |
|---|---|---|---|
| assistant/jarvis jarvis-test.mjs | 639 / 641 | 182 s | FAIL (2, both test-environment) |
| assistant/jarvis watch-test.sh | 15 / 15 | 1 s | pass |
| traverse/ops cloud-test.sh | 42 / 42 | 24 s | pass |
| assistant/outbox outbox-test.mjs | crashed before the count | 2 s | FAIL (stale test fixture) |
| assistant/outbox hub-tabs-test.mjs | 8 / 21 | 11 s | FAIL (stale test) |
| matthew/peak mail-test.mjs | 196 / 196 | 13 s | pass |
| matthew/peak desk-test.mjs | not run | - | skipped: needs `desk-data-local/test-admin-code.txt` (gitignored) |
| shared/site-analytics sa-test.mjs | 61 / 61 | 2 s | pass |
| traverse/post-calendar pc-test.mjs | 387 / 387 | under 1 min | pass (see note 2) |
| traverse/post-calendar pc-ui-test.mjs | 86 / 93 | 48 s | FAIL (7, likely test-environment) |
| traverse/prospect-desk desk-queue-test.php | 49 / 49 | 6 s | pass |
| traverse/prospect-desk desk-test.mjs | not run | - | skipped: needs `desk-data-local/seed.json` (gitignored) |
| traverse/data-pipeline owner-history-test.mjs | all passed (10 checks) | under 1 s | pass |
| traverse/app review-trial-1106 trial-unit-test.php | 89 / 89 | 1 s | pass |
| traverse/app review-trial-1106 trial-e2e-test.mjs | 36 / 36 | 2 s | pass |
| traverse/app review-trial-1106 trial-copy-check.cjs | 60 / 61 | under 1 s | FAIL (1, test-environment) |
| traverse/app review-mailstats-1118 mailstats-test.mjs | 112 / 112 | 5 s | pass |
| traverse/app review-mailstats-1118 mailtrack-all-test.mjs | 42 / 42 | 2 s | pass |
| traverse/app review-mailstats-1118 words-same-test.mjs | 8 / 9 | under 1 s | FAIL (1, test-environment) |
| traverse/app review-staysignedin-1113 | 68 / 68 | 8 s | pass |
| traverse/app review-measure-1121 | 58 / 58 | 15 s | pass |
| traverse/app review-custform-1118 | 45 / 45 | 15 s | pass |
| traverse/app review-paynow-1112 | 70 / 70 | 9 s | pass |
| traverse/app review-leadfix-1112 | 60 / 61 | 59 s | FAIL (1, cause not settled) |
| traverse/app older harness suites (auditfix, billlock, deep-ci, deep1031, deep desk, fbleads, care, satcache, satcache-ui, storm-mem) | not run | - | skipped: hard-wired to the Windows scratchpad harness (`C:/Users/SURGEI~1/...ptest-*` data, Stripe test key file in `~/.ssh`, a Windows Chrome path). Not portable; the data they need is gitignored. |

`mobile-shots.mjs` and `price-fix.mjs` are scripts, not tests, and were not counted.

## Failures

**1. outbox-test.mjs: stale test fixture (probably a real test bug).** Crashes at line 289 (`r.json.diff.sponsors`, `Cannot read properties of undefined`). The Peak import call answered 503: `the desk's code did not load (Failed opening required .../peak-desk-28d38d/api/desk-inbox.php)`. The test copies only `desk-store.php` into its throwaway Peak desk folder (line 30), but the Outbox's Peak importer now also requires `desk-inbox.php`. The app is fine; the test needs that second file copied. It would fail the same way on the laptop.

**2. hub-tabs-test.mjs: stale test (real test bug, no app bug).** 8 / 21. `WANT` still lists 8 tabs including `Assistant`. The hub dropped the Assistant tab on 19 Nov (commit 9d99b041) and gained Site stats on 20 Nov (f57b62f5), so every tab from 3 onward is off by one and `Alt+8` opens Site stats, not Outbox. The test needs its tab list updated.

**3. jarvis-test.mjs: 2 of 641 fail, both test-environment.**
- `jarvis-status.sh alert: a message in his main thread`: the script needs `LOCALAPPDATA` (`unbound variable`) and the test calls `jarvis-reply.sh` by a hard-coded `/c/Users/Matthew sharpe/...` path. Windows-only.
- `meeting: transcripts folders are gitignored (never committed)`: the VM copy has no repo `.gitignore` (only sub-folders were copied), so the check cannot pass there.
Everything else, 639 checks, passed.

**4. pc-ui-test.mjs: 7 of 93 fail, all in one LinkedIn block.** `Connect LinkedIn opens LinkedIn's authorization page in a new tab`, then six that depend on it (`the return page: connected, no token`, `back on the calendar: Connected as Matt Sharpe...`, `Surge Inc picked`, `Surge lane`, `LinkedIn preview`, `saved: LinkedIn only`). The first failure is that the test looks for the popup as a new browser target (`/json` list) after a synthetic tap, which headless Chrome on Linux probably does not open the same way. The 86 other checks, including all the rest of the calendar UI, pass. Likely test-environment; I did not prove it.

**5. leadfix-test.mjs: 1 of 61 fails, cause not settled.** `Email them again takes it off`: after the "Don't email" button is tapped, the "Email them again" button is tapped and the test waits for the "Don't email" button to come back; it never does. It failed identically on two runs (the second was a deliberate single re-run to see if it was timing), so it is not a flake. Everything around it passes (the "Not emailed" marking, the customer card). Could be a real bug in un-marking a lead, could be Linux Chrome click handling; needs a look on the laptop. This is the one failure I would check first.

**6. trial-copy-check.cjs: 1 of 61 fails, test-environment.** `homepage pricing line`. The check reads built website pages, and the website build (`build-site.cjs`) calls Windows `tar.exe`, which does not exist on the VM, so that page was not rebuilt. `build-editions.cjs` and `build-legal.cjs` did run.

**7. words-same-test.mjs: 1 of 9 fails, test-environment.** `the old code (HEAD) is the code before the change, the working copy has the words`. It compares `git show HEAD:` with the working copy, so it only passes while that edit is uncommitted. The VM copy was committed as one baseline, so there is no difference to find. Not an app bug.

## How the run was set up (so the numbers can be trusted)

- The repo on the VM is a `git archive` of laptop HEAD (assistant, shared, traverse, matthew/peak-pickleball-sponsorship, sixfold/aeration365-site; videos left out). The bare repo on the VM is filtered and out of date, and a full bundle was 570 MB, too slow to send.
- First pass failed 20 of 24 suites because the VM's `php-cli` had no `mbstring`, `curl`, `gd`, `sqlite3` or `xml`. **I installed those five PHP extensions on the VM with apt** (`php8.3-mbstring`, `-curl`, `-gd`, `-sqlite3`, `-xml`). That is the one change to the VM outside my work folder. It does not touch the jarvis service, which kept running.
- The copy had `traverse/marketing-site` missing at first; added. Installed `sharp`, `terser`, `csso`, `html-minifier-terser`, `marked` with npm inside the work folder only, then built the editions (`dist` is gitignored).
- The Windows Chrome path in the test files was swapped for `/usr/bin/google-chrome` in the VM copy only.
- Suites were re-run when the first run was spoiled by the setup (missing PHP modules, missing folders, missing built pages). Each suite's numbers above come from its last run on a fixed setup. Two suites ran more than once for other reasons: `leadfix` (twice, on purpose, same failure) and `pc-test` (it first failed because the VM has `ffprobe` and the test assumes the machine has none; re-run with `PC_FFPROBE` and `PC_FFMPEG` pointed at nothing, then 387 / 387).
- Nothing from gitignored customer or door data, and nothing from `~/.ssh`, was copied to the VM. The work folder `~/health-1122`, its temp folders and stray test servers were removed at the end. Disk on the VM is now 4.2 GB free (other jobs under `~/run` use 47 GB).

## Not covered

- The skipped older traverse harness suites (they need the 30 Oct Windows scratchpad data) and the two desk suites that need gitignored seed data. If those matter, run them on the laptop.
- Anything under the laptop's uncommitted edits (git showed 12 modified files at the start).
