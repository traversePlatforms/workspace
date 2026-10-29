# Yard v2 re-scored against every hand measure, 29 Oct 2026

This is a read-only analysis. Nothing in `app/data/rounds` was changed, either here or on the server, and nothing was uploaded. The server was only read: the lawnhand logs, ten door figures, and lot lines from its parcel cache.

## The short answer

- **Yard v2 already replaced the old photo estimate on 26 Oct.** The commit was b4510dd ("Yard v2 lawn sizes ... are live"). On 29 Oct the live door files show the v2 figure on every hand-measured lot that has a v2 reading. Ten lots were checked on the server and all of them match the local door files. So the real question now is whether to keep v2, not whether to switch to it.
- **Keep v2. It is much better than the old figure:**
  - On all 19 lots with a whole-property hand measure, the median miss is 24% for v2 against 65% for the old figure.
  - On the 12 lots measured after v2's settings were fixed, it is 25% against 73%.
  - v2 lands within 25% of the hand figure on 10 of 19 lots; the old figure did on 3.
  - v2 gets the size band (N/S/M/L) right on 13 of 19; the old figure did on 6.
- **Don't apply a correction factor yet.** On the lots measured so far, v2 now reads low on open lots: the median lean is −24%. Tree-heavy lots no longer read low (median miss 18%, lean −5%). But the open lots are scattered from −63% to +27%, and no single multiplier helps consistently: ×1.1 improves the median, ×1.15 does not, and ×1.2 makes the open lots that already read high worse.
- **Don't change v2's settings yet.** Variant B (despeckle 4 instead of 5) does better on the 12 lots measured after the 23 Oct tuning: 18% against 25%. But it is closer than v2 on only 6 of those 12. Its worst miss is +97%, against +73% for v2. And it does worse than v2 on the 7 lots v2 was tuned on. That is a coin flip, not evidence.
- **The cards are worse than v2 itself (27% against 24%), because 4 of the 19 hand-measured lots still show the old figure.** Three of those lots carry v2's "shared lot" flag; on the fourth, the door point sits in the road. Details are under "Cards that still show the old figure".
- **Next step: about 10 more whole-property hand measures, mostly open sunny lots and El Paso lots.** Then decide on a correction or on variant B.

## What was scored

| Column | What it is |
|---|---|
| Hand | Matthew's or Jen's own measure. The **Includes** column says what each figure covers. |
| Old | The photo estimate the app showed before 26 Oct: `lawn-cache.json`, compact rule, rounded to 100 as the card showed it. |
| Card | What the app's card shows today, from the local door file, which matched the live server on 29 Oct. It is v2 where v2 has a reading and the old figure where v2 left the lot out. |
| v2 | Yard v2 with its current settings (`V2` in `yard-scan-v2.mjs`), turned into a card figure the way `build-yard-v2.mjs` does it: rounded to 100, and on tree lots (T) the middle of the range the card shows. The raw recompute matched the territory run (`yard-v2/<town>.json`) on every lot that has a territory reading. |
| B | The near-winning variant from 23 Oct with despeckle 4 instead of 5, keeping the full 12 m reach. Variant A (despeckle 4, 8 m reach), the 23 Oct runner-up, is in the JSON file; it scored no better than v2 on these lots. |

The **Set** column splits the lots into two groups:

- **tuned**: one of the 7 lots the 23 Oct settings were picked on. These scores are flattering.
- **unseen**: measured after the settings were fixed. This is the honest test. It covers the eleven traces from 23 Oct, 2195 E Nichols Dr (25 Oct) and 9353 Pike Way (29 Oct).

**Tree-heavy** means tree crowns cover 25% or more of the lot, from the laser survey. The app uses the same cut-off for its "mostly trees" range.

## Per lot (signed miss against the hand figure)

| Lot | Town | Set | Crowns | Hand | Includes | Old | Card now | v2 | B |
|---|---|---|---|---|---|---|---|---|---|
| 3855 S Valentia Ct | denver | tuned | 31% | 8,111 | whole incl. beds + grass under tree edges | 0 (−100%) | 6,300 (−22%) | 6,300 (−22%) | 6,631 (−18%) |
| 11663 Settlers Dr | parker | tuned | 28% | 10,473 | whole lawn (Jen, Google Earth) | 200 (−98%) | 4,600 (−56%) | 4,600 (−56%) | 6,071 (−42%) |
| 2787 Russet Sky Ct | castle-rock | tuned | 7% | 3,898 | total lawn | 4,000 (+3%) | 4,200 (+8%) | 4,200 (+8%) | 4,596 (+18%) |
| 1648 Marsh Hawk Cir | castle-rock | tuned | 24% | 2,344 | total lawn | 1,400 (−40%) | 2,300 (−2%) | 2,300 (−2%) | 2,885 (+23%) |
| 7378 Upton Ct | franktown | tuned | 7% | 2,595 | watered lawn only (acreage lot) | 2,500 (−4%) | 3,300 (+27%) | 3,300 (+27%) | 3,961 (+53%) |
| 6595 Zinnia St | arvada | tuned | 18% | 3,225 | whole incl. grass under a tree | 1,600 (−50%) | 2,100 (−35%) | 2,100 (−35%) | 2,196 (−32%) |
| 3247 Oak Leaf Pl | highlands-ranch | tuned | 32% | 2,556 | grass only, evergreen left out | 1,300 (−49%) | 1,300 (−49%) old, "shared" | 2,900 (+13%) | 3,294 (+29%) |
| 7006 E 131st Way | thornton | unseen | 14% | 2,137 | back + front + 924 under the front trees | 1,100 (−49%) | 800 (−63%) | 800 (−63%) | 958 (−55%) |
| 7614 E 121st Pl | thornton | unseen | 15% | 2,961 | back + front + strip | 700 (−76%) | 3,200 (+8%) | 3,200 (+8%) | 3,477 (+17%) |
| 579 E 76th Ave | welby | unseen | 5% | 3,613 | whole + drive strip, open lot | 2,100 (−42%) | 1,600 (−56%) | 1,600 (−56%) | 1,905 (−47%) |
| 3852 Primrose Ln | castle-rock | unseen | 36% | 3,461 | back incl. under tree edges + front | 1,200 (−65%) | 3,900 (+13%) | 3,900 (+13%) | 4,133 (+19%) |
| 6049 W Roxbury Pl | columbine | unseen | 65% | 3,131 | back + front, heavy trees | 300 (−90%) | 300 (−90%) old, "shared" | 3,000 (−4%) | 3,305 (+6%) |
| 6916 S Elati St | littleton | unseen | 52% | 2,554 | front + side + back strip, rough | 5,800 (+127%) | 2,700 (+6%) | 2,700 (+6%) | 4,166 (+63%) |
| 600 Hiddenbrook Ct | highlands-ranch | unseen | 11% | 2,231 | back + front pieces | 1,900 (−15%) | 1,700 (−24%) | 1,700 (−24%) | 2,185 (−2%) |
| 9267 Canyon Wren Ct | highlands-ranch | unseen | 40% | 4,637 | front + back incl. under tree shade | 400 (−91%) | 3,400 (−27%) | 3,400 (−27%) | 3,843 (−17%) |
| 852 Hughes Ln | highlands-ranch | unseen | 43% | 1,385 | side (partly past the lot line) + front, rough; back under canopy maybe not traced | 2,200 (+59%) | 2,400 (+73%) | 2,400 (+73%) | 2,723 (+97%) |
| 9416 Desert Willow Trl | highlands-ranch | unseen | 30% | 1,473 | front + back under trees | 400 (−73%) | 1,400 (−5%) | 1,400 (−5%) | 1,615 (+10%) |
| 2195 E Nichols Dr | centennial | unseen | 39% | 3,035 | front + back almost all under one big tree + side | 800 (−74%) | 800 (−74%) old, no lot at door point | T 700–2,000, middle 1,350 (−56%) | 2,454 (−19%) |
| **9353 Pike Way** | arvada | **unseen, new today** | 11% | 1,880 | back to the grass edge under fence-line trees + front + drive strip + bed-edge grass (true ~1,820–1,880) | 200 (−89%) | 1,400 (−26%) | 1,400 (−26%) | 1,636 (−13%) |

Not in the medians:

| Lot | Why | Hand | Old | Card now | v2 | B |
|---|---|---|---|---|---|---|
| 9554 Penstemon Ct (black-forest) | upper limit only (≤ 5,746) | ≤ 5,746 | 400 | 2,600 | 2,600 | 3,025 |
| 6431 S Cedar St (littleton) | back lawn only, so the hand figure is a floor | 2,614 | 500 | 500 (old, "shared") | 4,300 (+64%) | 5,145 |
| 375 Lefthand Canyon Dr | a field, not a watered lawn | — | — | — | — | — |

Jen's four Lakewood remote quotes are a check, not hand measures:

| Lot | Quote | Old | v2 |
|---|---|---|---|
| 12405 W 19th Pl | 4,300 | −84% | +12% |
| 155 Everett St | 2,000 | +30% | +90% |
| 1539 Harlan St | 1,500 | −67% | T range, middle −20% |
| 2644 S Hoyt St | 2,700 | −59% | −4% |

## Medians

Each cell gives the median miss (size only), then the median lean (+ high, − low), then the worst miss.

| Group | Lots | Old | Card now | v2 | B |
|---|---|---|---|---|---|
| All whole-property hand measures | 19 | 65% · −50% · +127% | 27% · −24% · −90% | **24% · −5% · +73%** | 19% · +6% · +97% |
| Tuned (in-sample) | 7 | 49% · −49% · −100% | 27% · −22% · −56% | 22% · −2% · −56% | 29% · +18% · +53% |
| **Unseen (out-of-sample)** | 12 | 73% · −69% · +127% | 26% · −25% · −90% | **25% · −14% · +73%** | 18% · +2% · +97% |
| Tree-heavy (crowns ≥ 25%) | 10 | 82% · −73% · +127% | 38% · −25% · −90% | 18% · −5% · +73% | 19% · +8% · +97% |
| Open (crowns < 25%) | 9 | 42% · −42% · −89% | 26% · −24% · −63% | 26% · **−24%** · −63% | 23% · −2% · −55% |
| Unseen tree-heavy | 7 | 74% · −73% · +127% | 27% · −5% · −90% | 13% · −4% · +73% | 19% · +10% · +97% |
| Unseen open | 5 | 49% · −49% · −89% | 26% · −26% · −63% | 26% · −26% · −63% | 17% · −13% · −55% |
| Jen's quotes (check only) | 4 | 63% · −63% · −84% | 16% · +4% · +90% | 16% · +4% · +90% | 43% · +15% · +181% |

Counts within 25% of the hand figure, out of 19:

| | Old | Card now | v2 | B |
|---|---|---|---|---|
| All 19 lots | 3 | 8 | 10 | 11 |
| The 12 unseen lots | 1 | 5 | 6 | 8 |

## What Pike Way shows

- **Hand:** 1,880 sq ft. The true figure is about 1,820–1,880, because two bed-edge pieces may overlap.
- **The other figures:**
  - v2: 1,367 (card 1,400), −26%; against 1,820 it is −25%.
  - The old photo estimate: 170 (card 200), −89%.
  - Variant B: 1,636, −13% (−10% against 1,820).
- **This is an open lot,** with crowns over 11% of it. It fits the pattern of the other open lots measured since the tuning: 7006 E 131st Way −63%, 579 E 76th Ave −56%, 600 Hiddenbrook Ct −24%, and Zinnia −35% in-sample. v2 reads them low. Of the 5 open lots measured since the tuning, 4 read low by 24% or more; only 7614 E 121st Pl reads high (+8%).
- **Where the lawn goes missing,** from v2's picture of the lot:
  - v2 sees the middle of the back lawn and one piece of the front lawn.
  - It misses the edges and narrow strips (the drive strip and the bed-edge grass), which were not green enough in the 25 Sep 2023 photo or were removed by the despeckle.
  - The 2 m roof buffer blocked 484 sq ft of crown next to the house. That is correct, because it is the roof edge, not lawn.
  - Under-tree fill added only 205 sq ft. The fence-line trees where Matthew traced the grass edge are mostly outside the reach of the fill.
- **The old figure (170 sq ft) was badly wrong here, and v2 is a large improvement.** But this lot is not a case for a flat "plus N%". The shortfall is the strips and edges, and they depend on the lot.

## Cards that still show the old figure

v2 reads 4 of the 19 hand-measured lots, and its figure is closer than the old one on all 4. The card still shows the old figure for two reasons:

| Lot | Why the card keeps the old figure | Old on the card | v2 |
|---|---|---|---|
| 3247 Oak Leaf Pl | v2 marked the lot "shared": two doors in the door file fall on the same lot line | 1,300 (−49%) | 2,900 (+13%) |
| 6049 W Roxbury Pl | "shared" | 300 (−90%) | 3,000 (−4%) |
| 6431 S Cedar St | "shared" | 500 (back only: −81%) | 4,300 |
| 2195 E Nichols Dr | the Centennial door point is in the road, so v2 found no lot. The 25 Oct fix moved the point only in the `looked-up` copy. | 800 (−74%) | T 700–2,000 |

All three "shared" lots are single houses with their own yards. The shared rule (two door records on one lot) is meant for townhomes, and here it catches ordinary houses that have a duplicate or neighbouring door record. That is 3 of the 20 hand-measured houses, which is too many to ignore. It needs a look at how often the flag fires on ordinary houses across the territory. That is a code and data change, so it needs Matthew's decision.

## Recommendation

1. **Keep v2 live.** On the evidence it is clearly better than the figure it replaced. Out of sample, the median miss is 25% against 73% and the band is right on 13 of 19 against 6.
2. **No correction factor and no settings change yet.** v2 has a real lean low on open lots: −24% median, and Pike Way agrees. But the spread is wide, and with 9 open lots no factor holds up; ×1.1, ×1.15 and ×1.2 give 19%, 24% and 22%, which is noise. Variant B is the most likely candidate for the fix: it shrinks the open-lot lean from −24% to −2%. It is not yet proven: it is better on 6 of 12 unseen lots and worse on the tuning lots, and its worst miss is +97%.
3. **Get about 10 more whole-property hand measures, then re-run `node yard-v2-rescore.mjs`.** Add the lots to `KEY`, and add their lines to `yard-rescore-parcels.json` from the server's parcel cache. Decide between v2, v2 × a factor on open lots, and variant B once there are at least 12 open lots unseen by the tuning, against 5 now. The lots worth measuring:
   - **5 or more open, sunny lots** (crowns under 25%) with ordinary lawns in tract subdivisions, such as Thornton, Arvada, Westminster or Welby. This is where v2 reads low and where B and a factor disagree.
   - **3 or more El Paso lots** (Colorado Springs, Monument, Black Forest). There is no full hand measure there yet; Penstemon is an upper limit only. El Paso uses the 2021 photo and the 2018 laser survey and has no DRCOG layer, so it is the least-tested part of v2.
   - **2 mid-tree lots** (crowns 25–40%), to confirm that the tree-lot result (13% unseen) holds up.
   - **Measured one way:** whole property, grass including the grass under trees, beds left out, and nothing past the lot line. Several of the existing figures mix these (Valentia includes beds, Oak Leaf leaves out an evergreen, Hughes runs past the lot line, Cedar is back only), and that alone can move a lot by 10–30%.
4. **Separately (Matthew's call):** look at the "shared" flag and the Centennial door point. Those 4 lots are why the cards score 27% when v2 scores 24%.

## Fact-check and caveats

- **Small sample.** There are 19 lots, 12 of them out of sample. One or two lots move any median by several points, so read the percentages as roughly ±5 points.
- **Tuning overlap.** The 7 "tuned" lots chose v2's settings on 23 Oct, so their scores flatter v2 and penalise variants. Only the 12 "unseen" rows are a fair test. Even for those, Matthew's 23 Oct traces were seen before the 26 Oct go-live decision, though no settings changed after them: `V2` is the same as on 23 Oct.
- **The hand figures cover different things.** They include beds (Valentia, Pike Way's bed-edge grass), leave out an evergreen (Oak Leaf), go past the lot line (Hughes, Desert Willow), or cover the watered lawn only (Upton). Two are marked rough (Elati, Hughes). Settlers is Jen's trace; the rest are Matthew's, all from Google Earth or Google Maps imagery dated later than the 2023 photo v2 reads.
- **Photo date.** v2 reads the 25 Sep 2023 NAIP photo in the metro and the 15 Sep 2021 photo in El Paso. Lawns that were dry or dormant that week, or that have changed since, are missed. That is a likely part of the open-lot shortfall.
- **"Card now" was checked.** The local door files were compared with the live server on 29 Oct for 10 lots (Pike Way, Zinnia, Oak Leaf, Valentia, Nichols, Roxbury, Cedar, 131st, Primrose, Hughes), and every one matched.
- **The old figure** is `lawn-cache.json`'s compact figure (`c`, or `s` where no compact figure was made), keyed by the door point, as `build-rounds-data.mjs` `lawnOf()` read it before 26 Oct. It matches the "photo" field in the hand-measure logs taken before the switch, for example Zinnia 1,600. Pike Way's log says "photo 1,400" because it was measured after the switch, so that number is v2's figure.
- **Lot lines.** No parcel requests were sent to gis.colorado.gov. The 13 lots from 23–25 Oct come from `yard-key-parcels.json`. Pike Way and 8 others come from the server's parcel cache, which the app fills when someone opens a card, read only. The three Highlands Ranch lots come from the local Highlands Ranch parcel cells. All of them are in `yard-rescore-parcels.json`. Each lot's first corner matches the lot the territory run used (`pk`).
- **Network.** Photo, DRCOG and laser windows for the 17 lots not yet cached were read from the laptop: Microsoft Planetary Computer, and USGS 3DEP on AWS. The first run stopped on one Planetary Computer search failure at a Lakewood quote lot; a re-run finished cleanly. Nothing was run on the cloud VM.
- **Stale switch-check file.** `yard-v2-switch-check-2026-10-26.md` in the working tree has been overwritten by the overnight finisher scripts, which re-run `build-yard-v2.mjs`. Because the door files now hold v2, its "Old" column equals "New" (for example "old 27% · new 24%"). The committed 26 Oct version (old 73% against new 24% on unseen lots) is the correct one, and this rescore agrees with it. The modified file was not committed.
- **Sources.** USGS 3DEP LiDAR (Entwine copy on AWS); NAIP through Microsoft Planetary Computer; DRCOG 2020 Regional Land Use Land Cover, credited to the Denver Regional Council of Governments, which consented to our use on 2026-10-22. No Google imagery was read by any method. The hand measures were traced by people on Google Earth or Google Maps.

## Files

- `yard-v2-rescore.mjs`: the scoring. Run `node yard-v2-rescore.mjs` to print the tables and rewrite the JSON.
- `yard-v2-rescore-2026-10-29.json`: every lot with every figure, plus the group summaries.
- `yard-rescore-parcels.json`: lot lines for the 12 hand-measured lots that are not in `yard-key-parcels.json`.
- `yard-v2-cache/`: the photo windows. Gitignored, because it holds private-lot imagery.
