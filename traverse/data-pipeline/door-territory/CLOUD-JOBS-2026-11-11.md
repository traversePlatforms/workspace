# Cloud jobs, 11 Nov 2026: better lawn sizes, and this month's permit + hail refresh

Matthew, 11 Nov: "go ahead and run ... 3 4". Item 3 = retune the lawn-size method (yard v2) against the hand measures and re-measure
every lawn with it; item 4 = the permit refresh early (normally the laptop task "Traverse permit refresh" on 1 Dec) and any November hail.

## 3. Lawn sizes (yard v2 retune)

**Lots.** Every whole-property hand measure there is: the 19 of the 29 Oct re-score (`yard-v2-rescore.mjs`) and the 7 made since,
from the server's `lawnhand-*.log` files: 567 E 77th Pl (30 Oct), 651 Potomac St (Jen, 3.1 ac), 9819 Meade Cir, 449 S Stuart St,
9635 Newcastle Dr, 3184 S Nepal Way, 1730 S Rooney Rd (11,233, the main block). Lot lines for the six new ones: one point query each
(`lawn-trial/yard-retune-parcels.mjs`); Rooney's was already in its cached sources.

**Method.** `lawn-trial/yard-v2-retune.mjs` scores 1,080 settings (green line 0.30/0.33/0.36, despeckle 3/4/5, under-tree fill
12/16/20 m, near-house 25/35 m, roof buffer 1/2 m, a new "edge" option that grows seen lawn into slightly less green shade at its
edges) times a flat multiplier 1.0-1.3, all on the card figure (rounded, middle of the range on tree lots). Rule fixed before
looking: pick on the 19 older lots (TUNE), then read the 7 newer ones (HOLD) once; change only if the pick also beats the live setting
on HOLD. `yard-v2-retune-score.mjs` does the scoring; results in `yard-v2-retune-2026-11-11.part*.json` and
`yard-v2-retune-score-2026-11-11.json`. No setting was tried on the HOLD lots before the pick.

**Pick:** green line 0.36 -> 0.33, despeckle 5 -> 4, roof buffer 2 -> 1 m, no multiplier (now `V2` in `yard-scan-v2.mjs`;
the old one is kept as `V2_1023`).

| Lots | | Typical miss (median) | Lean | Within 25% | Mean log miss |
|---|---|---|---|---|---|
| TUNE (19, picked on) | live setting | 24% | -5% | 10 of 19 | 0.332 |
| | new setting | 24% | +9% | 11 of 19 | 0.291 |
| **HOLD (7, never used to pick)** | live setting | **51%** | -37% | **1 of 7** | 0.696 |
| | new setting | **31%** | -19% | **3 of 7** | 0.543 |
| All 26 | live setting | 27% | -23% | 11 of 26 | 0.430 |
| | new setting | 24% | -9% | 14 of 26 | 0.359 |

Held-out lots one by one (hand, live, new): 567 E 77th 2,229: 1,400 (-37%) -> 1,500 (-33%); 9819 Meade 4,330: 3,400 (-21%) -> 3,800
(-12%); 449 S Stuart 1,942: 600 (-69%) -> 600 (same: a lawn wholly under one crown, nothing seen to fill from); 9635 Newcastle 2,594:
1,800 (-31%) -> 2,100 (-19%); 3184 S Nepal 2,022: 1,000 (-51%) -> 1,400 (-31%); 1730 S Rooney 11,233: 4,400 (-61%) -> 9,300 (-17%);
**651 Potomac 7,100: 19,000 (+168%) -> 26,900 (+279%), worse** (a 3.1-acre lot, already far too high). Closer on 5 of 7, same on 1,
worse on 1.

**Second check, leave-one-out over all 26** (pick on 25, score the one left out, 26 times):
- settings only (no multiplier): the same setting is picked 23 of 26 times (green 0.30, despeckle 4, roof buffer 1, the runner-up
  of the main pick); mean log miss 0.377 against 0.430 for the live setting, within 25% on 13 of 26 against 11, median miss 28%
  against 27% (flat), closer on 14 lots and further on 11.
- with the flat multiplier allowed: worse than the live setting (median 39% against 27%). **A flat correction factor does not hold up;
  the settings change does.** That is why no multiplier is used.

**What it means.** The new setting reads more lawn: about +23% on a typical lot (Welby test, 2,707 doors: median new/old 1.23, 10% of
lots 1.10, 90% 2.21). That fixes most of yard v2's low reading on shaded suburban lots and narrow strips (the pattern in every
November hand measure). The cost: lots that already read high read higher (852 Hughes Ln +73% -> +102%, 7378 Upton Ct +27% -> +73%,
6916 S Elati St +6% -> +68%, Potomac). It is a modest, real gain on the lots it was not tuned on, not a cure; 26 lots is a small
sample. Hand measures stay on top of every card. The "edge" option never helped and is off.

**Re-measure.** VM stage `yardv3` (fill1031, queued 11 Nov ~11:20 pm MT): every door yard v2 has measured (790 town keys,
1,755,458 doors) measured again with the new setting into `~/run/lawn-trial/yard-v3/`, from the same slim door lists and the same saved
lot-line cells (almost no gis.colorado.gov requests). Three workers (one town run uses one core; Welby test 9.9 houses/s each).
The live `yard-v2/` on the VM and the laptop is untouched until the finisher. Backups on the VM: `~/run/fill1031/vm-backup/yardv3/`
(the old scripts), `stages.txt.before-yardv3-20261112`.

**Going live: automatic, when the VM finishes** (expected around 13 Nov). `finish-yardv3-2026-11-11.sh` is registered as stage
`yardv3` in `traverse/ops/run-cloud-finishers.sh`: it waits for other uploads, copies back, saves `yard-v2/*.json` +
`yard-v2-lawn.json` to `%LOCALAPPDATA%/ProjectBackup/yardv3-before/yard-v2-before-v3.tgz`, checks every town (no door or lot lost,
whole-run median new/old between 0.95 and 1.6, else nothing is merged), merges, builds (door counts and lawn-size counts per town
checked against before), builds the editions, uploads every town to Sixfold and the door files to the five editions (MD5 MATCH
required), and reads three towns back live. Log: `logs-finish-yardv3.log`.

Code changed: `lawn-trial/yard-scan-v2.mjs` (V2 retuned; knobs `ndvi` and `edge`; the per-cell map projections worked out once per
lot, same numbers, checked on all 31 lots), `lawn-trial/yard-v2-town.mjs` (`YV2_OUT` output folder). The server does not run yard v2
itself (prop-pull has no copy), so nothing customer-facing changes until the finisher.

## 4. Permits and hail

**November hail: none in our towns.** VM stage `hailnov` fetched the radar's daily hail maximum (MRMS MESH, Iowa State's archive) for
29 Oct - 10 Nov over the whole state (`~/run/hailfill/days/`, summary `~/run/fill1031/hailnov-summary.tsv`). Hail of 0.75 in or more
showed in one radar square on two days, both on the Utah line (30 Oct 38.59 N 109.04 W, 0.82 in; 4 Nov 37.92 N 109.03 W, 0.76 in),
nowhere near a door. The server's own storm job (rounds.php, every 12 h) already carries `hail-storms.json` through 2026-11-10 and has
no storm day after 27 Sep. So nothing to rebuild: no new hail days, no hail hours to add, nothing pushed.

**Permits:** see the run below.

## Found on the way: the rented-homes finisher sent nothing to the five editions

`gap1108/finish-rent-2026-11-08.sh` (Wi-Fi queue job `rented`) finished 23:12 with "done", Sixfold fully uploaded, but every
`push-edition.sh` call printed `md5sum: failed to set file descriptor text/binary mode: Bad file descriptor` and `0 files to send`:
the Wi-Fi queue runs jobs with stdin closed, and Git Bash's md5sum fails then. The editions' index.json files were merged (new counts)
while their door files stayed old (checked: monument.json live on Roofing and Yards differed from the build; Sixfold matched).
Fixed: `push-edition.sh` now starts with `exec < /dev/null` and stops if its local md5 list is short (backup
`%LOCALAPPDATA%/ProjectBackup/push-edition.sh.before-stdin-20261111`). Then the same files were pushed to the five editions with the
finisher's own filter.

## Runs and results

All times Mountain.

- **11 Nov 22:55-23:00** retune grid (laptop, 35 s in two shards once the projections were cached) and scoring.
- **11 Nov 23:00** VM stage `hailnov` ran (minutes): 13 radar days fetched, no hail near a door (above).
- **11 Nov 23:12** the rented-homes finisher ended; **23:20 VM stage `yardv3` started** (3 workers, about 16-20 houses a second
  combined at the start, so roughly 25-30 hours; Centennial is the slow key). Welby test beforehand: 2,709 doors, 0 errors, batch
  reading of 567 E 77th Pl the same as the single-lot run.
- **11 Nov 23:25-00:10** the rented build pushed to the five editions with the fixed `push-edition.sh`: Yards 1,446 files,
  Pest 1,280, Security 1,028, Solar 2,145, Roofing 2,145, every one MD5 MATCH and json ok; monument.json live on Roofing, Yards and
  Solar now matches the build (it did not before). Server backups: `~/upload-backups/before-push-<edition>-20261111-*.tgz`.
- **12 Nov 00:10-00:38 permit refresh** (`traverse/ops/refresh-permits.sh`, the monthly task's own script, run by hand on the laptop:
  it needs the laptop's door files and the editions build, so it does not port to the VM). Permits per source, before -> after:
  Pikes Peak Regional 231,116 -> 231,461 (+345), Douglas County 57,527 -> 57,612 (+85), Centennial 21,053 -> 21,112 (+59),
  Denver 29,235 -> 29,259 (+24), Boulder 14,378 -> 14,428 (+50), Aurora 48,323 -> 48,165 and Longmont 1,567 -> 1,561 (both rolling
  windows that drop old months). 231,008 of 675,526 doors in the covered towns have a permit. **103 permit files uploaded** to Roofing,
  Pest, Security, Solar and Yards (each edition's changed files only, backup `~/upload-backups/permits-<edition>-before-2026-11-12.tgz`,
  md5 checked by the script). Log line in `traverse/ops/logs/permit-refresh.log`. The 1 Dec task still runs as usual.

Still running at the time of writing: `yardv3` on the VM; its finisher puts it live by itself (see above). If its check stops it,
the log says why and yard-v2 is left as it was.
