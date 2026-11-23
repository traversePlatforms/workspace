# Cloud job, 22 Nov 2026: lawn sizes, the low readings (before the cloud credit ends)

Matthew, 22 Nov: "go ahead and run 1": fold in the hand measures not yet used, retune, and if the lots held out get closer,
measure again the doors that read no green or a range under trees. **Nothing is live.** Going live waits for Matthew's check (end of
this file), as with the 15 Nov yard v3 update.

**Summary:** 11 new hand measures added (all Jen's, 13-20 Nov; none from Matthew or Claire since 11 Nov; a 12th, a 13-acre lot, is too
big for the method). New rule: a second, lower green line on lots that read under 1,200 sq ft. On the held-out lots the typical miss
went from 40% to 29%, and no hand-measured lot got worse. Status at 2026-11-23 00:28 UTC: the cloud machine is still measuring (first pass, owner-lived Check doors near Englewood); 83,017 doors are back on the laptop and on those the lawn-caused "Check before quoting" drops from 83,017 to 51,404 (simulated). Not live.

## 1. Hand measures added

`lawn-trial/hand-logs.mjs` (read-only on the server) found 24 hand measures, all in Sixfold 365's logs; Traverse Yards (Claire's
measure-only account) has none yet. 12 were not in the tuning list, all Jen's (Google Earth, grass under trees counted):
3 Arvada, 2 Aurora, and one each in Cherry Creek, Denver, Westminster, Windsor, Erie, plus Arvada's 18753 W 94th Ln (live reading 0)
and an Aurora one. 11321 Dransfeldt Rd (Parker, 13.15 ac) is over yard v2's 5-acre limit and has no reading to score; it is in the KEY
as `none`. Lot lines for the 11: one point query each (`yard-retune-parcels.mjs`, gis lock held, 11 requests).

## 2. Retune and the held-out check

Rule fixed before scoring: TUNE = the 26 lots used up to 11 Nov (the 7 held out then were read once to make that change, so they are no
longer unseen); HOLD = Jen's 11, never used to pick. `yard-v2-retune.mjs` scored 1,836 settings (green line, despeckle, under-tree fill,
near-house, roof buffer, and the new **low** knob: a second green line 0.28/0.25/0.22/0.18, used only on lots reading under 300 or
1,200 sq ft, despeckle as is or 2) x a flat multiplier 1.0-1.3, on the card figure (17 s on the laptop).
`yard-v2-retune-score.mjs --run=2026-11-22` picks two ways on TUNE only:

- **target** = the best of V2's own settings plus a low knob, no multiplier. Only this one changes nothing on lots reading 1,200 sq ft or
  more, so measuring just the low-reading doors again gives every door the same method. Pick: **low line 0.18, despeckle 2, on lots
  under 1,200 sq ft** (`V2_1122` in `yard-scan-v2.mjs`). It goes ahead only if it beats V2 on HOLD.
- **pick** = the best of the whole grid, for information: despeckle 5 + the same low knob + x1.2. Better on HOLD too (26%), but the
  leave-one-out check fails it (closer on 11 lots, further on 23): the flat multiplier again does not hold up. Not used.

| Lots | | Typical miss (median) | Lean | Within 25% | Mean log miss |
|---|---|---|---|---|---|
| TUNE (26, picked on) | live V2 | 24% | -9% | 14 of 26 | 0.353 |
| | V2_1122 | 24% | -9% | 14 of 26 | 0.333 |
| **HOLD (11, Jen's, never used to pick)** | live V2 | **40%** | +10% | **3 of 11** | 0.528 |
| | V2_1122 | **29%** | +10% | **4 of 11** | 0.320 |
| All 37 | live V2 | 29% | -9% | 17 of 37 | 0.405 |
| | V2_1122 | 26% | -1% | 18 of 37 | 0.329 |

It changes only the 4 hand lots that read low, every one closer, none further: 18753 W 94th Ln (hand 950) 0 -> 1,000; 12847 W 78th Cir
(2,265) 1,100 -> 1,200; 449 S Stuart St (1,942) 600 -> 800; 7006 E 131st Way (2,137) 1,100 -> 1,400. Honest size of it: the held-out
gain rests mostly on one zero-green lot; the other held-out lots read 1,200+ and are unchanged by design. The over-reads (2006 S
Ironton +87%, 8218 Balsam +47%, 852 Hughes +102%) and big under-reads (1730 S Rooney -77%, Settlers -40%) are untouched by this
change. Files: `lawn-trial/yard-v2-retune-score-2026-11-22.json` (the grid parts `yard-v2-retune-2026-11-22.part*.json`, not committed,
rebuild in 17 s).

Check on the cloud machine before the run (Welby, 188 doors): every door where the low line did not help read exactly as live (22 of 22),
so the method change is only the low line.

## 3. Re-measure on the cloud machine

Which doors: every door whose live reading is under 1,200 sq ft (the only ones the new rule can change), from the laptop's yard-v2
(`lawn-trial/yard-low-targets.mjs`): **771,193 doors** (291,349 read zero, 155,942 show a range under trees, 529,555 are
Check for their lawn). In four passes, most useful first: t1 owner-lived Check doors within 45 mi of Englewood 229,652; t2 other Check
doors within 45 mi 112,565; t3 other low readings within 45 mi 118,508; t4 farther out 310,468.

VM stage `lawn1122` (fill1031 queue, `overnight/fill1031/lawn1122.sh`): from `~/run/lawn-trial` with its own script copies
(`yard-v2-town-1122.mjs`, `yard-scan-v2-1122.mjs`), `YV2_SETTINGS=1122`, output `~/run/lawn-trial/yard-v4/` (live yard-v2/ and yard-v3/
untouched), each finished town gzipped to `~/run/lawn1122/out/` and listed in `~/run/lawn1122/done.txt`. No laptop finisher is
registered for it. Started 18:27 UTC, stopped 19:31 for the grid fault below, restarted 19:41 UTC; 4 workers from then (the J.A.R.V.I.S.
move is copying from the machine; LiDAR cache trimmed 30 -> 18 GB to keep the disk clear, re-downloadable).
Speed: about 18,000 doors an hour, slower than yard v3 (each low lot is read twice, and the lot-line cells several towns had lost are
being fetched again). At that speed the first pass alone needs about 13 hours, so **the credit will very likely cut it off inside t1**.

Copy-back: `overnight/lawn1122/pull-lawn1122.sh` on the laptop, every 4 minutes (skips the iPhone hotspot), each finished town's
compact result to `lawn-trial/yard-v4/<key>.json` (gitignored); log `yard-v4/pull.log`, list `yard-v4/pulled.txt`.

Progress at 00:30 UTC 23 Nov: 19 towns of the first pass finished and copied back (83,017 doors usable after the acreage guard; about 86,000 of 771,193 targeted). The VM is still running.

**Acreage guard (added after the first towns came back):** on lots of an acre or more the low line counted fields and native grass as
lawn (one Parker lot of 4.9 ac went from 100 to 63,900 sq ft). None of the hand lots it helped is over 0.2 ac, so the scores above do
not change: `V2_1122.lowMaxLot` = 1 acre, and `merge-yard-v4.mjs` / `yard-v4-compare.mjs` keep the live reading for any low-line
reading on an acre or more (257 doors so far). The VM run was not restarted for this: its acreage readings are just not used.

Readings that changed without the low line: 669 of 23,647 so far (3%), almost all where the re-measure found a different photo than
the live reading (a refreshed photo search, not the method); every other one is identical to the live figure.

## 4. Before and after (simulated cards)

`lawn-trial/yard-v4-compare.mjs` -> `yard-v4/compare.json` (door ids: never put in a public file). On the 83,017 doors back so far
(all t1: owner-lived, within 45 mi, Check for their lawn):

| | Before (live) | After |
|---|---|---|
| Check for the lawn (no green or a range under trees) | 83,017 | **51,404** |
| Read zero | 43,830 | 26,501 |
| Levels | T 38,104, N 44,913 | L 1,860, M 17,842, S 11,868, T 20,555, N 30,892 |

Card figure change: median +100 sq ft (25%: +0, 75%: +450, 90%: +850). The low line was used on
59,370 of them. 24 read more than the lot's open ground (spot-check those). Biggest jumps (after the acreage guard) are
large lots just under an acre (Greenwood Village, Wheat Ridge, Lakewood, Arvada: 0 -> 10,000-25,600 sq ft on 0.45-0.95 ac lots): plausible
for big yards but **spot-check before going live**; the list is in compare.json (top). All other Check reasons (built after the photo, etc.)
are unchanged.

## Found on the way: subset runs moved the lot-line grid

`yard-v2-town.mjs` puts its lot-line cells on a 0.008 degree grid starting at the town list's south-west door. Run on a subset of a
town's doors (this job's lists), the start moved and the saved cells were thrown away and fetched again from gis.colorado.gov: in the
first hour Highlands Ranch's and Thornton's caches were reset (and Welby's in the test). Stopped, fixed (`YV2_GRID_DATA`: the whole town
list sets the grid; a run with no whole list stops instead of resetting; commit 5bbde817), and the two restored from the VM's
`vm-backup/yardv3fix/` copies (Westminster, Centennial, Littleton merged with their backups). Castle Rock's, Westminster's, Centennial's
and Littleton's caches were already nearly empty when this job started (Castle Rock 6 KB), with the right grid: an earlier subset
stage (likely yardgap or every1115) probably hit the same thing. Readings are not affected (the lot lines are the same either way),
only speed and gis requests. Copies of the files as they were: `~/run/fill1031/vm-backup/lawn1122/`.

## Going live (Matthew's check first)

Nothing below has been run. On Matthew's go, from `traverse/data-pipeline/door-territory`:

1. `node lawn-trial/merge-yard-v4.mjs --dry` then `node lawn-trial/merge-yard-v4.mjs` (laptop only; copies each yard-v2 file it changes to
   `%LOCALAPPDATA%/ProjectBackup/lawn1122-before/yard-v2/` first; acreage guard applied).
2. `(cd lawn-trial && node --max-old-space-size=8192 build-yard-v2.mjs)`
3. `node --max-old-space-size=8192 build-rounds-data.mjs`
4. `(cd ../../app && node ../editions/build-editions.cjs)`
5. Uploads, the same as the 15 Nov yard v3 go-live (finish-yardv3-2026-11-11.sh, from "upload to Sixfold"): `bash upload-towns-sixfold.sh <town keys>`
   in batches for Sixfold, then `bash push-edition.sh <edition> "^(<keys>).json$"` for each of the five editions, MD5 MATCH required.

Undo before step 5: restore the yard-v2 files from that backup and rebuild (steps 2-4).
If the VM is cut off, only the towns in `yard-v4/pulled.txt` are merged; every other door keeps its live reading (same method on all lots
of 1,200 sq ft or more, so the cards stay consistent; the untouched low ones are just not improved yet).

## 23 Nov: tiers 2-4 restarted (Matthew: "restart lawn1122 on yardtest ... I just want everything running through this vm")

The 22 Nov run had not stopped early: only t1's door lists (299 towns, 229,652 doors) were ever on yardtest, so t2-t4 "finished" with
nothing in them, and all of t1 had come back (232,328 doors). 23 Nov ~17:35 UTC: t2-t4 lists (1,008 towns, 541,541 doors; 1,281 files,
md5-checked) copied from the cloud computer to ~/run/lawn1122/lists/, the stale "t2/t3/t4 done" lines taken out of done.txt (copy
done.txt.before-1123), lawn1122.vmdone moved aside, queue.sh started: 4 workers, t2 first. Towns already finished are skipped (fin/ markers);
yard-v2-town-1122.mjs adds to an existing town file, so every copy-back carries all tiers so far.
Copy-back now runs on the cloud computer (systemd user unit lawn1122-pull, the same pull-lawn1122.sh, key ~/.ssh/azure_yard), and
lawn1122-alert sends Matthew a J.A.R.V.I.S. alert when it's finished: then Stop yardtest in the portal (only Matthew can; a shutdown from
inside keeps it billing). Going live still waits for Matthew's check ("Going live" above).
