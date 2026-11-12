# Cloud jobs of 11 Nov: review (night of 11-12 Nov 2026)

Reviewed: commit f2b8c926 (the lawn-size retune, VM stage `yardv3`, `finish-yardv3-2026-11-11.sh`, the `yardv3` entry in
`run-cloud-finishers.sh`, the `push-edition.sh` fix, the permit refresh and hail check) and the Azure VM as it stood at about
07:45 UTC 12 Nov (2 of 790 town keys finished). Paths below are under `traverse/data-pipeline/door-territory/` unless they start
with `traverse/`.

Not touched: anything on the VM (looked at read-only), the servers (no upload, no deploy, no read of live files), the queue's
`stages.txt`. No finisher, wrapper or Wi-Fi queue job was running when the scripts were edited (no `running.lock`, no bash process
but the J.A.R.V.I.S. watcher). One read-only count query went to the state parcel map to confirm finding 1.

## Bottom line

The finisher is safe in the direction that matters: I found no path where it puts wrong or fewer lawn sizes live. Its guards did have
holes in the other direction (a crashed build passed as "done" with nothing changed), and those are fixed and tested.

The bigger news is on the VM. **The re-measure is losing 1-2% of each town's readings, and as it stands the finisher will refuse the
whole run** (finding 1). That is the guard working, but it means no new lawn sizes go live on 13 Nov unless something is done first.
That needs Matthew's decision; nothing was changed on the VM.

Fixes are in commit **1c36c461**. This file is committed separately.

## Findings

### High

**1. The VM stage is fetching lot lines again, some answers come back empty, and every door in an empty cell loses its reading.**
`lawn-trial/yard-v2-town.mjs:44-55` (`fetchCell`), `overnight/fill1031/yardv3.sh`.
- The report says the stage uses "the same saved lot-line cells (almost no gis.colorado.gov requests)". It does not. The saved cell
  files on the VM are mostly incomplete or on the pre-26-Oct origin, which the code throws away: Arvada has 11 of 189 cells saved,
  Brighton 7 of 69, Monument 56 of 126, Lakewood and Parker have no origin recorded so all 211 and 239 are fetched again. All six
  towns started so far have had their cell file rewritten today.
- When the state map answers with an empty or error body (HTTP 200, no `features`), `fetchCell` saves the cell as "no lots" for good.
  Every door in that cell is then written as `null` (no lot line) and the town is marked finished.
- Measured on the two finished towns: **Thornton 571 doors** (three cells, e.g. 413 of 413 doors in one cell) and **Westminster 314
  doors** had a reading in yard-v2 and have none in yard-v3. None of the cell files not yet touched has an empty cell, so the empties
  are from tonight's fetching. I asked the state map for the count in Thornton's worst cell: 532 lots. The saved answer is 0.
- What happens at the finisher: a town where any lot is lost fails the town check (line 60-61) and keeps its old file; more than 5
  failing towns stops the run with NOT MERGED. Two of two finished towns fail. So the finisher will almost certainly stop, three
  times, and the overnight check will report `yardv3` FAILED. Nothing wrong goes live; nothing new goes live either.
- Also: three town runs fetch from gis.colorado.gov at once. The queue's own rule (and the memory note) is one parcel job at a time.
  It is light (a few cell requests a minute) but it is the likely reason for the empty answers.
- **Not fixed: it is on the VM and it is a choice.** Options under "For Matthew" below.

### Medium

**2. A crashed build was read as success; the run could end "done" with nothing changed.** `finish-yardv3-2026-11-11.sh` (old lines
63, 64, 70). `node build-yard-v2.mjs | head -1`, `node build-rounds-data.mjs | grep ...` and the editions build took the exit code of
`head`/`grep`, not of the build. Scenario: build-yard-v2 runs out of memory; yard-v2-lawn.json stays as it was; build-rounds-data
rebuilds the same door files; the count check passes (it only asks "not fewer"); Sixfold gets the same files again; the editions find
0 files to send; the three-town read-back matches; the stage is marked done for good and the log says "retuned lawn sizes live".
Same for the editions: a build that failed part way left older door files in the build folder, and "every door file present" passed.
This is not theoretical: last night's rented-homes finisher had a build crash that went unseen the same way (finding 7).
**Fixed (1c36c461):** `pipefail` on all three; yard-v2-lawn.json must be newer than this run's unpack; the editions build's exit
code counts and each edition door file must be the same size as the one just built (they are plain copies; checked on today's
build: all five editions pass).

**3. A stage that ended early could pass as finished.** `yardv3.sh:21,30-35` and the finisher's check. If the VM runs short of disk,
`room` ends each worker, the script still tars what there is and exits 0, so `yardv3.vmdone` is written. Towns never started have no
file and the "more than 5 missing" rule catches that. But town files that are part measured merge cleanly (old readings are kept for
doors the new run never reached), so a run that stopped with few towns left, or with many towns half done, would go live as a mix of
old and new settings and be marked done. Tonight's Littleton file, mid-run, is that case: 2,719 of 9,984 doors.
**Fixed (1c36c461):** the check now counts readings carried over from the old files and refuses the merge above 2% (the known gap is
about 2,000 doors, 0.1%). It also refuses any new file whose `settings` are not the 11 Nov ones. Tested on made-up town files: good
run merges; empty-cell, part-measured, old-settings, shrunken and missing-file runs all end NOT MERGED with yard-v2 untouched; a
second run after a merge passes.

**4. A copy of the result kept from an earlier try was trusted because it was not empty.** `finish-yardv3-2026-11-11.sh` (old line 36).
Two scenarios: the copy-back is cut off (the file is there, short), every later try fails at "unpack" and the stage is FAILED for a
dropped connection; or, after finding 1 is repaired and the stage is run again on the VM, the finisher would have used the old result
still sitting in `ProjectBackup/push-tmp/yardv3/`. The backup had the same pattern (old line 39): a backup cut short on try 1 was
"the backup" on try 2, and try 2 then merged.
**Fixed (1c36c461):** the kept copy is used only if its md5 equals the VM's file now; copy and backup are written to `.part`, the
backup is read back, then renamed.

**5. `push-edition.sh` fix: correct.** `push-edition.sh:8,14`. Reproduced the fault here: `md5sum`, `sha1sum` and `cksum` fail with
input closed; `sort`, `tar`, `sed`, `join`, `diff`, `node` do not. `exec < /dev/null` cures it and nothing in the script needs a real
stdin (every later read is a pipe or a file). The short-list check does catch the old failure (0 lines against N). With no files at
all it also stops, which is the safe side. One loose end, not changed: the local list is sorted in the laptop's locale and the live
list in the server's; where they disagree `join` fails to pair a file and it is sent again. That wastes upload, it cannot skip a file.

**6. Other md5sum callers.** Whether a job is exposed depends on how it is started: tested here, a job bash starts in the background
gets `/dev/null` (fine); the tasks Task Scheduler starts directly are fine too (the weekly refresh uploaded 809 files on 9 Nov as a
task on this laptop). The fault needs a closed input, which is what the Wi-Fi queue gave the rented finisher.

| Script | Run by | If md5sum fails | Now |
|---|---|---|---|
| `push-edition.sh` | finishers, by hand | sent 0 files, said nothing | fixed in f2b8c926 |
| `push-sixfold-side.sh` | by hand | same silent "0 to send" | **fixed 1c36c461** (input + short-list stop) |
| `traverse/ops/refresh-permits.sh` | task, 1st of month | "no change" for every edition, logged ok | **fixed 1c36c461** (input + stop on empty list) |
| `traverse/ops/refresh-weekly.sh` | task, Mondays | files skipped without a word | **fixed 1c36c461** (same) |
| `traverse/ops/wifi-queue/jobs/yearbuilt.sh` | Wi-Fi queue (same context as the failure) | loud: CHECKSUM MISMATCH after uploading | **fixed 1c36c461** (input) |
| `traverse/ops/deploy-app.sh`, `deploy-practice.sh` | by hand / sessions | not exposed: md5sum runs inside a `while read ... < file` loop | left |
| `traverse/post-calendar/tools/deploy.sh` | by hand | not exposed: `xargs md5sum` | left |
| `fill1031-finish.sh`, `finish-centlawn/g2mat/g3hail/hail1023/hail2min/hailhours` | finisher wrapper (background) | not exposed there; stages all done | left |
| `shared/tools/*` | | no md5sum at all | |

**7. Found on the way: last night's rented build did not rebuild the pest files from Denver on.** `pest/build-pest.mjs:103`,
`logs-finish-rent.log:20-28`. `Math.min(...lons)` overflows the call stack now that Denver has 135,569 doors. The build stopped at
Denver, the 24th of 421 towns; `| tail -1` hid the exit code and the finisher carried on. `pest-denver.json` and the towns after it
are from 10 Nov or earlier, so the rented homes added last night have no pest entry there, and that is what f2b8c926 re-pushed to
the editions. Not in this commit's files and it needs a rebuild and a push, so **left for Matthew** (the fix is a loop in place of
the spread; `lawn-trial/yard-v2-town.mjs:41` has the same spread and will fail the same way if it is ever run on the laptop's Denver
or Aurora lists; the VM's slimmer lists are under the limit, checked).

### Low

**8. `V2_1023` does not reproduce the old setting.** `lawn-trial/yard-scan-v2.mjs:51-52,188`. `yardClassify(S, V2_1023)` merges it
over the new `V2`, and `V2_1023` has no `ndvi` key, so the green line stays 0.33: a hybrid, not the 23 Oct setting. Nothing uses it
yet. Same cause: the older scoring scripts (`yard-eval-v2.mjs`, `v2-check.mjs`, `yard-v2-rescore.mjs`) pass partial settings and now
inherit the new defaults, so re-running the 29 Oct re-score will not give the 29 Oct numbers. Fix is `ndvi: 0.36` in `V2_1023`.
Left (not one of the files I was to edit; it is one line).

**9. The speed-up is sound.** `yard-scan-v2.mjs:173-186`. The per-cell projections depend only on the lot's sources (grid, lot line,
the three samplers), all read from the same object the cache is keyed on, and a missing sample is kept as -1 and turned back into
`null`. Same numbers. Roof buffer: one grid cell is one metre on the ground (`cell = 1/cos(lat)` in map metres), so `roofBuf: 1` is
1 m; the circle test at 1 takes the four side neighbours, not the diagonals. No off-by-one. The VM's copies of `yard-scan-v2.mjs`,
`yard-v2-town.mjs`, `build-yard-v2.mjs` and `yardv3.sh` match the laptop's by md5, and the finished files record the new settings.

**10. Sixfold batches already marked uploaded are skipped on a retry the same day.** Line 94 (`yardv3-<first town>-<date>` labels).
Right if the rebuild gives the same files, which it should. If something else changed the door files between two tries, Sixfold
would keep the first try's files for those batches; the read-back checks three towns, not all. Left: a full read-back of every
Sixfold town against the build would close it, and I could not test that without reading the live server.

**11. The busy check runs once, at the start.** Lines 29, 33. It waits for other uploads before it begins, then runs for hours. A
weekly refresh (Monday 04:40), a deploy or a build started by a session during that time is not seen, and neither of those looks for
the finisher. I confirmed the check does see scripts started from inside other scripts. **Fixed in part (1c36c461):** it now also
waits for `push-edition`, `push-sixfold-side` and `upload-towns-sixfold`. A build run with `node` directly is still not seen.

**12. An empty town list skipped the Sixfold upload silently.** Old line 76. The read-back would have caught it. **Fixed (1c36c461).**

### Checked and fine

- **Backup before overwrite:** yes. Result is unpacked to its own folder, the backup is made, then the merge writes `.tmp` files and
  renames them only after every check passes. The backup holds `yard-v2/*.json` and `yard-v2-lawn.json`, not the door files; those
  are rebuilt from it (the restore line is in the stop message). Server side, `upload-towns-sixfold.sh` and `push-edition.sh` each
  back up what they replace.
- **Live index.json is merged, not replaced.** `upload-towns-sixfold.sh:30-50` swaps only the named towns' entries and keeps every
  other one, admin-only (one-off) entries included; `push-edition.sh` never sends index.json or company.json as files.
- **Cannot run twice or beside another finisher:** `run-cloud-finishers.sh:9,69` holds one lock for all stages, `.done` is written
  only on exit 0, three tries at most. Every `stop` exits 1. A VM stage that failed is counted failed, not finished.
- **A second try after a merge** passes the check honestly (ratio 1.0, same counts) and goes on to build and upload.
- **Hotspot:** checked in the wrapper, at the start and before every upload.
- 790 town files on the laptop, 790 keys in the stage, the same names.

## For Matthew, before the finisher fires (about 13 Nov)

1. **The lost readings (finding 1).** As things stand the finisher will stop and nothing changes live. To get the new sizes live,
   one of:
   - **Repair on the VM, then let the finisher run** (my pick): after the stage ends, for each town drop the empty cells from
     `drcog-turf/parcels-<town>.json`, drop the doors that are `null` in yard-v3 but had a reading in yard-v2, remove the town's
     `.finished`, and run the towns again one at a time; make `fetchCell` refuse an answer with an `error` field or treat an empty
     cell where doors sit as a failed fetch. Then tar again. The finisher's kept copy is now checked by md5, so it will fetch the
     new result. If the finisher has already failed three times by then, clear `%LOCALAPPDATA%\ProjectBackup\cloud-finish\yardv3.tries`.
   - **Or accept old readings for those doors:** change the merge (line 60) to keep the old reading wherever the new run has none.
     Then about 1-2% of doors stay on the old setting (roughly 20% lower than their neighbours) and the rest go live.
   - Or leave it: the finisher refuses, the cards stay as they are.
2. **Three parcel fetchers at once** on gis.colorado.gov until the stage ends. Say if it should be cut to one (it means stopping and
   restarting the stage; about three times as long).
3. **Pest files (finding 7):** rebuild and push, when convenient.
