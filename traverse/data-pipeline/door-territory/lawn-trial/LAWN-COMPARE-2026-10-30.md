# Lawn size: ours vs DRCOG vs hand, 30 Oct 2026

Read-only analysis, done "just so we have the data". No app files, door files or server data were changed. Nothing was uploaded. The server was only read: the lawnhand logs, `lawn-range.json`, and one lot line from the parcel cache. The full numbers are in `LAWN-COMPARE-2026-10-30.json`.

## The short answer

- **20 houses** have a whole-property hand measure. All 20 are inside DRCOG's area: 10 open lots and 10 tree-heavy lots.
- **Ours (the card figure, yard v2):** median miss 25%. It leans low (mean −13%). 8 of 20 are within 20%.
- **DRCOG turf:** median miss 38%. It leans high (mean +25%, median +7%). 5 of 20 are within 20%. It reads high on open lots (median +44%) and low on tree lots (median −19%). It has two very large misses:
  - 7378 Upton Ct, an acreage lot: +346%.
  - 579 E 76th Ave, a lawn that is probably newer than 2020: −93%.
- **DRCOG turf + trees:** median miss 81%, nearly always high. It works only as an upper bound.
- **The average of ours and DRCOG turf:** median miss 22%. The lean mostly goes away (mean +6%, median −3%). 9 of 20 are within 20%, and 13 of 20 within 25% (ours: 10). It is closer than ours on 12 of the 20 houses.
- **That gain is not proven.** In a bootstrap, the average's median miss is 2 points better than ours, but the 90% range runs from 11 points better to 12 points worse.
- **The gain is all on open lots.** There, the average has a median miss of 22% against 26% for ours, and the lean goes from −25% to +9%.
- **On tree-heavy lots, ours alone is best:** 18%, against 22% for the average.
- **Recommendation: don't switch the card yet.** There is one candidate rule worth testing on the next hand measures, set out below. No change was made.

## 567 E 77th Pl (Welby, today)

| | Figure | Against 2,229 (all pieces) | Against 1,851 (without the dark side strip) |
|---|---|---|---|
| Hand | 2,229 or 1,851 | | |
| Ours (card, M) | 1,400 | −37% | −24% |
| DRCOG turf | 3,083 (the app shows 3,100) | +38% | +67% |
| DRCOG turf + trees | 3,359 (the app shows 3,400) | +51% | +81% |
| Average(ours, turf) | 2,240 | +1% | +21% |

## Per house

- **Crowns** is the share of the lot under tree crowns, from the laser survey. Tree-heavy means 25% or more, the same cut-off the app uses.
- **Ours** is the card figure today, from the local door files (which match live). On T cards, ours is the middle of the range.
- **DRCOG** values are unrounded; the app shows them rounded to 100.
- **Bold brackets** mark houses where the hand figure covers something different from "grass on this lot".

| # | Town | Address id | Crowns | Hand (what it covers) | Ours | DRCOG turf | DRCOG turf+trees | Avg(ours, turf) | Ours err | Turf err | Turf+trees err | Avg err |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | denver | 3855-s-valentia-ct | 31% | 8,111: whole property incl. beds and grass under tree edges (back yard alone 5,843) **[includes beds]** | 6,300 | 6,751 | 10,084 | 6,530 | −22% | −17% | +24% | −19% |
| 2 | parker | 11663-settlers-dr | 28% | 10,473: whole lawn, Google Earth **[Jen's trace]** | 4,600 | 8,063 | 11,665 | 6,330 | −56% | −23% | +11% | −39% |
| 3 | castle-rock | 2787-russet-sky-ct | 7% | 3,898: total lawn, Google Maps | 4,200 | 6,586 | 6,725 | 5,390 | +8% | +69% | +73% | +38% |
| 4 | castle-rock | 1648-marsh-hawk-cir | 24% | 2,344: total lawn, Google Maps | 2,300 | 3,218 | 4,670 | 2,760 | −2% | +37% | +99% | +18% |
| 5 | franktown | 7378-upton-ct | 7% | 2,595: watered lawn only **[watered lawn only, on a 1.2-acre lot]** | 3,300 | 11,579 | 13,704 | 7,440 | +27% | +346% | +428% | +187% |
| 6 | arvada | 6595-zinnia-st | 18% | 3,225: whole property incl. grass under a tree | 2,100 | 2,914 | 3,824 | 2,510 | −35% | −10% | +19% | −22% |
| 7 | highlands-ranch | 3247-oak-leaf-pl | 32% | 2,556: grass only **[front evergreen left out]** | 2,900 | 3,129 | 5,482 | 3,010 | +13% | +22% | +114% | +18% |
| 8 | thornton | 7006-e-131st-way | 14% | 2,137: back 450 + front 763 + 924 under the front trees | 800 | 3,185 | 3,185 | 1,990 | −63% | +49% | +49% | −7% |
| 9 | thornton | 7614-e-121st-pl | 15% | 2,961: back 1,801 + front 854 + 306 | 3,200 | 4,871 | 5,858 | 4,040 | +8% | +65% | +98% | +36% |
| 10 | welby | 579-e-76th-ave | 5% | 3,613: whole property 3,402 + 211 strip by the drive, open lot | 1,600 | 238 | 390 | 920 | −56% | −93% | −89% | −75% |
| 11 | castle-rock | 3852-primrose-ln | 36% | 3,461: back 3,061 incl. under tree edges + front 400 | 3,900 | 3,713 | 6,401 | 3,810 | +13% | +7% | +85% | +10% |
| 12 | columbine | 6049-w-roxbury-pl | 65% | 3,131: back 1,867 + front 1,264, heavy trees | 3,000 | 1,725 | 9,443 | 2,360 | −4% | −45% | +202% | −24% |
| 13 | littleton | 6916-s-elati-st | 52% | 2,554: front + side + back strip, heavy canopy **[rough trace]** | 2,700 | 2,509 | 7,619 | 2,600 | +6% | −2% | +198% | +2% |
| 14 | highlands-ranch | 600-hiddenbrook-ct | 11% | 2,231: back 1,691 + front 290 + 130 + 120 | 1,700 | 3,770 | 4,115 | 2,740 | −24% | +69% | +84% | +23% |
| 15 | highlands-ranch | 9267-canyon-wren-ct | 40% | 4,637: front 1,169 + back 3,468 incl. under tree shade | 3,400 | 3,672 | 7,458 | 3,540 | −27% | −21% | +61% | −24% |
| 16 | highlands-ranch | 852-hughes-ln | 43% | 1,385: side 745 + front 640 **[side runs past the lot line; back under the canopy may not be traced; rough]** | 2,400 | 2,332 | 5,312 | 2,370 | +73% | +68% | +284% | +71% |
| 17 | highlands-ranch | 9416-desert-willow-trl | 30% | 1,473: front 766 + back 707 under trees **[front partly past the lot line]** | 1,400 | 1,143 | 2,630 | 1,270 | −5% | −22% | +79% | −14% |
| 18 | centennial | 2195-e-nichols-dr | 39% | 3,035: front-left 848 + back 1,858 almost all under one big tree + side 329 | 1,350 (T 700–2,000) | 1,830 | 3,991 | 1,590 | −56% | −40% | +32% | −48% |
| 19 | arvada | 9353-pike-way | 11% | 1,880: back 1,165 to the grass edge under fence-line trees + front 451 + drive strip 121 + bed-edge grass 81 + 62 **[the two bed-edge pieces may overlap: true ~1,820–1,880]** | 1,400 | 2,009 | 2,119 | 1,700 | −26% | +7% | +13% | −9% |
| 20 | welby | 567-e-77th-pl | 17% | 2,229: back 1,175 (deck/patio left out) + front 676 + side strip 378 **[the side strip reads dark, shade or gravel: 1,851 without it]** | 1,400 | 3,083 | 3,359 | 2,240 | −37% | +38% | +51% | +1% |

Not in the medians:

| Town | Address id | Why | Hand | Ours | DRCOG turf | DRCOG turf+trees | Avg | Ours err | Turf err | Avg err |
|---|---|---|---|---|---|---|---|---|---|---|
| black-forest | 9554-penstemon-ct | upper limit only; **El Paso, so no DRCOG** | ≤ 5,746 | 2,600 | — | — | — | — | — | — |
| littleton | 6431-s-cedar-st | back lawn only, so the hand figure is a floor | ≥ 2,614 | 4,300 | 4,854 | 8,245 | 4,580 | all three above the floor | | |
| boulder | 375 Lefthand Canyon Dr | a dry field, not a watered lawn | 34,123 | — | 0 (23 Oct) | — | — | — | — | — |
| lakewood | 12405-w-19th-pl | Jen's remote quote, not a hand measure | 4,300 | 4,800 | 3,230 | 8,317 | 4,020 | +12% | −25% | −7% |
| lakewood | 155-everett-st | quote | 2,000 | 3,800 | 4,519 | 8,653 | 4,160 | +90% | +126% | +108% |
| lakewood | 1539-harlan-st | quote | 1,500 | 1,200 | 551 | 3,352 | 880 | −20% | −63% | −42% |
| lakewood | 2644-s-hoyt-st | quote | 2,700 | 2,600 | 1,515 | 5,322 | 2,060 | −4% | −44% | −24% |

Jen's four quote lots are all tree-heavy (crowns 39–49%). On them, DRCOG makes things worse: the average is further off than ours on 3 of the 4. That agrees with the tree-lot result below.

## Summary

Each row gives the median absolute % error, the mean signed error (the bias), the median signed error, how many fall within 20% and within 25%, and the worst miss.

### All 20 houses

| Method | Median miss | Mean lean | Median lean | Within 20% | Within 25% | Worst |
|---|---|---|---|---|---|---|
| **Ours (card)** | **25%** | −13% | −14% | 8/20 | 10/20 | +73% |
| DRCOG turf | 38% | +25% | +7% | 5/20 | 9/20 | +346% |
| DRCOG turf + trees | 81% | +96% | +76% | 3/20 | 4/20 | +428% |
| **Average(ours, turf)** | **22%** | +6% | −3% | 9/20 | 13/20 | +187% |
| Average, guarded (ours if the lot is over 20,000 sq ft or turf is under half of ours) | 22% | −1% | −3% | 9/20 | 13/20 | +71% |
| Open lots: guarded average; tree lots: ours | 22% | −1% | −2% | 9/20 | 12/20 | +73% |
| Geometric mean(ours, turf) | 24% | +1% | −9% | 9/20 | 11/20 | +138% |
| w·turf + (1−w)·ours, w fitted (leave-one-out) | 23% | +1% | −12% | 7/20 | 12/20 | +171% |
| ours + w·(turf − ours) only when turf is higher, fitted (leave-one-out) | 24% | +7% | −4% | 8/20 | 12/20 | +155% |
| ours × (1 + w), fitted (leave-one-out) | 23% | −7% | −9% | 8/20 | 12/20 | +91% |
| Larger of ours and turf | 30% | +31% | +10% | 7/20 | 10/20 | +346% |
| Average(ours, turf + trees) | 38% | +41% | +34% | 7/20 | 8/20 | +228% |
| Crown-weighted: (1 − crowns)·ours + crowns·(turf + trees) | 24% | +19% | +10% | 4/20 | 10/20 | +164% |

### Split by tree cover

| Method | Tree-heavy, n=10: median miss / lean / within 20% | Open, n=10: median miss / lean / within 20% |
|---|---|---|
| Ours (card) | **18%** / −5% / 5 | 26% / −25% / 3 |
| DRCOG turf | 22% / −19% / 3 | 57% / +44% / 2 |
| DRCOG turf + trees | 82% / +82% / 1 | 78% / +62% / 2 |
| Average(ours, turf) | 22% / −17% / 5 | **22%** / +9% / 4 |
| Guarded average | 22% / −17% / 5 | **22%** / +9% / 4 (worst −56% instead of +187%) |

### Other cuts

| Method | Scope-clean, n=16 (Valentia, Upton, Hughes, Desert Willow dropped) | Lots unseen by the v2 tuning, n=13 |
|---|---|---|
| Ours | 25% / −25% / 7 of 16 | 26% / −24% / 5 of 13 |
| DRCOG turf | 38% / +7% / 4 | 40% / +7% / 3 |
| Average(ours, turf) | 22% / −3% / 7 | 23% / −7% / 6 |
| Guarded average | 22% / −3% / 7 | 23% / −7% / 6 |
| Open: guarded average; tree: ours | 20% / −2% / 8 | 13% / −4% / 7 |

**Scoring 567 at 1,851 instead of 2,229 changes almost nothing.** All 20: ours 24%, average 22%, guarded average 22%. Open lots: ours 25%, average 22%, but the average's open-lot lean rises to +19%.

### How sure is this?

- **Paired bootstrap, 5,000 resamples of the 20 houses:** the average's median miss minus ours has a middle value of −2 points. The 90% range runs from −11 to +12 points. 65% of the resamples favour the average. That is a lean, not a result.
- **Fitted blends gain nothing.** Fitted blends scored leave-one-out (the weight picked on the other 19 houses) score 23–24%, no better than the plain average. Weighting by tree cover or lot size did not beat the simple rules above.
- **The 13% figures were found after looking at the data.** "Open lots: average; tree lots: ours" scores 13% on the 13 unseen lots, and so does "ours plus 45% of the gap when DRCOG is higher". Both rules were chosen after seeing these houses, so neither has been tested.

## Where DRCOG doesn't exist

- **DRCOG's 2020 land cover covers the Denver region only.** That is Adams, Arapahoe, Boulder, Broomfield, Clear Creek, Denver, Douglas, Gilpin, Jefferson and SW Weld. It does not cover El Paso.
- **In the territory yard v2 run, about 409,000 of 1.15 million measured lots have no DRCOG turf.** The count is approximate: a few lots inside the area also lack it, where the land cover did not answer. Most of the 409,000 are in 238 towns outside the region, including:
  - El Paso: the four Colorado Springs quadrants, Black Forest, Monument, Fountain, Security-Widefield
  - Larimer: Fort Collins, Loveland
  - Weld: Greeley, Windsor, Evans, Johnstown
  - Pueblo, Grand Junction, Durango
- **A blend is impossible there.** The card would stay as ours.
- **There is still no full hand measure outside DRCOG's area.** Penstemon is an upper limit only, so ours is untested there too.

## Recommendation (no change made)

1. **Don't switch the card to a blend yet.**
   - The average beats ours by 3 points of median miss on 20 houses, and the bootstrap can't tell that apart from zero.
   - It also makes tree-heavy lots worse.
   - What it clearly does is remove ours' low lean on open lots. That is real, but the sample is 10 open lots.
2. **One rule is worth testing on the next hand measures.** It was set out here, before those measures exist, so that they are a fair test:
   - Inside DRCOG's area, on open lots, show the average of ours and DRCOG turf.
   - Open means crowns under 25% of the lot, a lot of 20,000 sq ft or less, and DRCOG turf at least half of ours.
   - Everywhere else, show ours.
   - On today's 20 houses it scores 22% against 25%, with the lean −1% against −13%.
   - Switch only if it beats ours on median miss and on the count within 20% across at least 8–10 new open lots.
   - Matthew's list of 10 has 5 open tract lots. The 3 El Paso lots on it can't test a blend, but they are still needed to test ours.
3. **DRCOG now sits on the wrong lots.** The app shows it only on tree lots, inside the range box. That was decided on 21 Oct, when the old photo estimate badly undercounted tree lots. Under v2, tree lots are ours' best case (18%) and DRCOG's figure there reads low (−19%). On open lots it is a useful counterweight. If DRCOG stays in the range box, it may belong on open lots instead. This is Matthew's call, and nothing was changed.
4. **Don't use turf + trees as a size.** It reads above the hand figure on 19 of 20 houses. It is at most a ceiling.
5. **Measure one way.** Measure the whole property: grass including grass under trees, beds left out, nothing past the lot line. Four of the 20 hand figures cover something else, and that alone moves a house by 10–30%.

## Caveats

- **The sample is small.** With 20 houses, one or two houses move any median by several points. Read every percentage as roughly ±5 points.
- **Ours and DRCOG are not independent.** Inside DRCOG's area, yard v2 already counts DRCOG turf (class 6) that is a little green in the 2023 photo as seen lawn. So averaging partly counts DRCOG twice.
- **Dates differ.** DRCOG is 2020. Ours reads the 25 Sep 2023 photo and laser surveys from 2020. The hand traces are on Google imagery dated after 2023.
  - Lawns put in since 2020 are invisible to DRCOG (579 E 76th, −93%).
  - Irrigated areas that are not mown lawn count as turf on acreage (7378 Upton Ct, +346%).
- **The tuned lots flatter ours.** Ours (v2) was tuned on 7 of the 20 houses on 23 Oct, so its score on those is flattering. DRCOG was not tuned on anything. On the 13 unseen houses, ours scores 26%.
- **Lot lines come from the state parcel layer (county records).** They are often a few feet out, and the hand traces don't follow them exactly.

## Fact-check log

- **Verified:**
  - **The DRCOG figures were recomputed here from the cached 2020 land-cover windows** (`yard-v2-cache/`, read with the lot lines in `yard-key-parcels.json` and `yard-rescore-parcels.json`). The method is the same as `lawn-range.mjs`: 1 ft pixels whose centre is inside the lot line, class 6 = turf, classes 6+5 = turf + trees.
  - **They match the app's own cached answers** in `lawn-range.json` on the server, to the nearest 100, on all 7 houses where both exist: Zinnia, Desert Willow, Oak Leaf, 7006 E 131st, 7614 E 121st, Nichols, 567 E 77th.
  - **They also match the 21–23 Oct trial figures** to within ±2 sq ft, for example Valentia 6,751 and Russet 6,586.
  - **567 E 77th Pl: lot line and DRCOG.** Its lot line came from the server's parcel cache (read only; its first corner matches the territory run's `pk`). Its DRCOG window was read from Microsoft Planetary Computer: 3,083 / 3,359, against the app's 3,100 / 3,400.
  - **Ours comes from the local door files**, which match live after the 29 Oct shared-lot fix. Three houses changed since the 29 Oct re-score, because they now show v2 instead of the old figure: Oak Leaf 1,300 → 2,900, Roxbury 300 → 3,000, Cedar 500 → 4,300. Nichols now shows T 700–2,000 (scored at its middle, 1,350).
  - **The hand figures and their pieces** were taken from the server's lawnhand logs (arvada, highlands-ranch, looked-up, welby) and from `yard-v2-rescore-2026-10-29.json`. No owner names were copied.
- **Corrected:** "6 rows" in the brief. The server holds 8 log rows for 6 houses: Valentia has two rows (back only, and whole), and 567 E 77th has two rows. The whole-property figures were used.
- **Unresolved:**
  - Whether 567's side strip is grass. The figures are shown both ways.
  - Whether Upton's DRCOG turf is irrigated pasture.
  - Whether 579 E 76th's lawn is newer than 2020 (not checked).
- **No gis.colorado.gov calls were made.** No Google imagery was read by any method; the hand traces were made by people.
- **Credit:** DRCOG 2020 Regional Land Use Land Cover, Denver Regional Council of Governments. Use consented on 2026-10-22. Also used: USDA NAIP via Microsoft Planetary Computer, and USGS 3DEP LiDAR (inside ours).

## Files

- `LAWN-COMPARE-2026-10-30.json`: every house with every figure and error, plus the summaries for every method and group. It also holds the same summaries with 567 scored at 1,851, and the in-sample fitted weights.
- The working scripts (`compute.mjs`, `analyse.mjs`, `build.mjs`) were kept in the session scratchpad, not the repo. Their inputs are all in `lawn-trial/` and the server reads listed above.
