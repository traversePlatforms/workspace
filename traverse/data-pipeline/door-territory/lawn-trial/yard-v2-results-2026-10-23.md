# Yard method v2: results, 2026-10-23

Local trial only. Nothing is in the app, nothing was uploaded, and nothing was committed. v1 (`yard-scan.mjs`) has not been changed.

## The winning settings

The v2 settings are `V2` in `yard-scan-v2.mjs`. The green rule, roof buffer and evergreen block below are the three changes the brief asked for. The fourth and fifth rows (despeckle and near the house) were added after the first scoring run, because those three changes alone still left Upton at +137% or worse.

| Setting | v2 value | What it does |
|---|---|---|
| Green | `lated6g`, gate 0.2 | Seen lawn = ground level AND (green in a late-summer photo, NDVI > 0.36, OR DRCOG turf (class 6) that is at least a little green in that photo, NDVI > 0.2). The 2021 July photo and DRCOG class 4 are both dropped. A photo counts as late summer if it was flown 20 Aug – 30 Sep: the metro's 2023 photo (25 Sep) qualifies, and so does El Paso's 2021 photo (15 Sep), because El Paso's 2023 photo is from 8 Oct. |
| Roof buffer | 2 m | No under-tree fill within 2 m of a roof. A roof here is DRCOG's structure outline, or a solid block of laser "roof" cells. DRCOG's building outline also counts as roof where the laser pulse split. |
| Evergreen block | on | No fill under crowns whose laser returns go all the way down: in the surrounding 3×3 cells, more than 20% of the above-ground returns are 0.3–2.5 m up and fewer than 15% of the returns reach the ground. The 2020 survey sees ground through bare shade trees, so those trees still fill. |
| Despeckle | 5 | A seen cell is kept only if at least 5 of its 8 neighbours are also seen. This removes the specks of green in dry native grass. |
| Near the house | 25 m | Seen lawn counts only within 25 m of a roof. |
| Fill reach | 12 m | Distance under tree crowns reached from seen lawn, through crowns that are allowed to fill. |

## Per lot: v1 against v2

v1 (4 m) is v1's default; v1 (0 m) was its best median.

| Lot | Hand (sq ft) | v1 (4 m) | v1 (0 m) | v2 |
|---|---|---|---|---|
| 3855 S Valentia Ct | 8,111 | 7,093 (−13%) | 4,058 (−50%) | 6,286 (−23%) |
| 11663 Settlers Dr | 10,473 | 9,440 (−10%) | 5,500 (−47%) | 4,575 (**−56%**) |
| 2787 Russet Sky Ct | 3,898 | 6,663 (+71%) | 5,845 (+50%) | 4,198 (+8%) |
| 1648 Marsh Hawk Cir | 2,344 | 4,230 (+80%) | 2,476 (+6%) | 2,325 (−1%) |
| 7378 Upton Ct | 2,595 | 15,199 (+486%) | 12,938 (+399%) | 3,337 (+29%) |
| 6595 Zinnia St | 3,225 | 3,165 (−2%) | 2,088 (−35%) | 2,088 (−35%) |
| 3247 Oak Leaf Pl | 2,556 | 4,984 (+95%) | 2,282 (−11%) | 2,885 (+13%) |
| **Median miss** | | **71%** | **47%** | **22.5%** |
| **Worst miss** | | **+486%** | **+399%** | **−56%** |
| 9554 Penstemon Ct (upper limit only) | ≤ 5,746 | 5,780 | 4,209 | 2,551 |

Penstemon is not in the medians, because its hand figure is only an upper limit.

v1 was re-run through the v2 classifier using v1's own rule. Its results match `yard-eval.json` to within 10 sq ft; the lot lines this time came with 7 decimal places.

## What each change did on its own

Each row shows the median and worst miss over the 7 lots that have a full hand measure. 167 variants were scored in all; every one is in `yard-eval-v2.json`.

| Variant | Median | Worst |
|---|---|---|
| v1, 4 m fill | 71% | +486% |
| (a) 2023 photo or DRCOG turf, no gate, 4 m | 70% | +341% |
| (a) DRCOG turf only, 4 m | 67% | +299% |
| (a) 2023 photo only, 4 m | 40% | +97% |
| (a) 2023 photo or turf that is a little green (gate 0.2), 4 m | 36% | +204% |
| (b) v1 green, roof buffer + evergreen block, 4 m | 50% | +453% |
| (a) + (b), 4 m | 31% | +177% |
| (a) + (b) + near the house (30 m), 4 m | 31% | +159% |
| (a) + (b) + despeckle 4, 4 m | 39% | +73% |
| **v2: (a) + (b) + despeckle 5 + near the house 25 m, 12 m** | **22.5%** | **−56%** |
| Runner-up: despeckle 4, near the house 25 m, 8 m | 23.3% | +53% |
| Winner without the evergreen block (despeckle 4, 30 m, 8 m) | 34% | +65% |
| Winner without the roof buffer (despeckle 4, 30 m, 8 m) | 28% | +72% |

What the scores show:

- **Change (a) on its own does not fix acreage lots.** DRCOG's class 6 covers 11,657 sq ft of Upton, including dry native grass. Even gated, Upton reads +137% to +204%. On Upton, only the despeckle and near-the-house filters bring it close to the hand figure.
- **Change (b) on its own does little for the median.** The 2 m roof buffer and the evergreen block each matter once (a) is in: removing either one from the winner costs 5–11 points. The evergreen block found Oak Leaf's front evergreen.
- **The fix for "trees counted as lawn" depends on how far the laser can see.** The block uses the share of laser pulses that reach the ground, which only works where the laser sees under the crowns. The DRCOG 2020 survey sees ground through bare shade trees, but El Paso's 2018 survey may not.

## Penstemon lookup (fix c)

**Cause:** the state parcel layer has no address on 9554 Penstemon Ct (El Paso sends `situsAdd` = null), so v1's exact address match could never find the lot.

**Fix:** find the lot from the app's own point for that door, taken from the town's door file (`black-forest.json`). If there is no door point, the lookup falls back to the exact address, then to the house number plus the street name. This is `lotFor()` in `yard-scan-v2.mjs`.

**Test:** `node yard-scan-v2.mjs --address "9554 Penstemon Ct" --town black-forest` returns the lot: 14,908 sq ft, lawn 2,551.

**Not tested:** whether the app's `pull-property.mjs` hits the same problem. It finds the point with the Census geocoder first, so it may not.

## What is still wrong

1. **Tuned on the same lots it is scored on.** 167 variants on 7 lots. The best score sits on a flat plateau, about 22–25% across many nearby settings, so read the exact numbers loosely. The next lots measured by hand are the real test.
2. **Tree-heavy lots now read low.** Valentia (−23%), Settlers (−56%) and Zinnia (−35%) are the lots whose hand figures include grass under trees, or beds. v1 at 4 m was closer on all three. Despeckle removes Settlers' shaded back lawn, which tree shadows make look lacy; this is the same failure the old ragged-patch filter had. With despeckle at 4 instead of 5, Settlers is −43% but Upton is +53%.
3. **The split between open lots (high) and tree lots (low) remains.** v2 makes it smaller but does not remove it. Part of the cause is that the hand figures cover different things: beds are included at Valentia, the evergreen is left out at Oak Leaf, and Upton counts watered lawn only.
4. **Lots outside DRCOG's area (El Paso, Penstemon) fall back on the photo alone.** They also use the 2018 survey, which leaves gaps in the roofs.
5. **What the photos cannot show.** Post-2023 changes and dormant lawns are still missed.

## Sources and limits

- **Sources:** USGS 3DEP LiDAR, through the Entwine copy on AWS; NAIP, through Microsoft Planetary Computer; and the DRCOG 2020 Regional Land Use Land Cover, credited to the Denver Regional Council of Governments, which consented to our use on 2026-10-22.
- **No Google imagery** was used.
- **Server:** read-only. The lawnhand logs held only Zinnia, Oak Leaf and Valentia, so no new lots were added to the key. Zinnia's and Oak Leaf's lot lines were copied from the server's parcelat cache.
- **gis.colorado.gov:** 7 requests, sent one at a time: 6 lot lines and 1 test of the command line. The lot lines are kept in `yard-key-parcels.json`, so later runs make no parcel requests.

## Files (`traverse/data-pipeline/door-territory/lawn-trial/`)

- `yard-scan-v2.mjs`: the v2 method. It exports `yardSources`, `yardClassify`, `yardPic`, `lotFor` and `V2`.
- `yard-eval-v2.mjs`: scores every variant and writes `yard-eval-v2.json`. Pictures go to `yard-v2-pics/` with `--pics`.
- `yard-key-parcels.mjs` and `yard-key-parcels.json`: the lot lines for the hand-measured lots.
- `yard-v2-cache/`: the photo, DRCOG and laser windows for each lot. It holds private-lot imagery, so it is added to `.gitignore`.
- `yard-v2-pics/`: a v1 and a v2 picture for each lot. The colours are: green = seen lawn, teal = under-tree fill, yellow = crowns, grey = roof.
