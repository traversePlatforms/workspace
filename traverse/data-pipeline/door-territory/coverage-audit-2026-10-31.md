# Coverage audit, 2026-10-31

What share of homes carries each data layer, for every town in the editions (407 towns, 1,237,418 homes, from the Roofing index). Read only; built by `coverage-audit.mjs` from the local builds in `editions/dist`, `app/data/rounds` and `lawn-trial/yard-v2`. Every town and layer is in `coverage-audit-2026-10-31.json`.

How to read it:

- **Lot line** = the yard v2 run found the house's parcel (lots over 5 acres count, as "big"). **Lawn (yard v2)** = the card's lawn figure comes from yard v2, not the older photo estimate.
- **Roof photo, sun estimate, trees, roof layers** are measured for every home a source covers, so a low share is a gap. Roof photo counts the DRAPP close-up or the NAIP crop.
- **Hail on record** lists only homes that had a 0.75 in+ storm on a kept day. Every town has been through the storm history (all 407 have a file), so a low share is weather, not a gap. **Hail hours** = the share of a town's storm days (since the hours file starts) that carry the hours.
- **New movers, permits, house facts, lot facts** only exist where something happened or is nearby (a sale, a permit, a park within 90 m), so their shares are naturally partial; a dash means the town has no file at all.
- Shares are of the town's homes in the Roofing index; Sixfold, Yards, Solar, Pest and Security carry the same doors (403 of the 407 towns: the 4 commercial towns are Roofing only).

<!-- findings -->
## What the audit found (31 Oct) and what was queued

Cause found per gap from the measuring caches (`roofs/roof-cache.json`, `solar/solar-cache.json`, `tree-cache.json`, `lawn-trial/yard-v2/`), not only the shares below. Queue: TASKS.md TR-54, `overnight/fill1031/`.

| Gap | Homes | Cause | Queued as |
|---|---:|---|---|
| Lawn: "no lot" in towns on the state parcel layer | 6,025 in 190 towns (Rifle 596, Castle Pines 265, Bald Mountain 241, Silverthorne 207, ...) | Some real (no parcel at the door point); some cells may have been saved while the state service throttled (empty answer, not an error) | 1 lawnfix |
| Lawn: doors never measured by yard v2 | 2,577 (South Denver 1,939, Idaho Springs 403, Woodland Park 208, Cripple Creek 27) | Added to the town after its yard v2 run (the Centennial pattern: lists changed after the 24-26 Oct run) | 1 lawnfix |
| Lawn and lot: Group 3b towns | 52,279 in 46 towns (Montrose, Delta, Las Animas, Alamosa, Conejos, Costilla, Mineral, Bent) | No parcels on the state layer (address-point counties) | **Blocked**: needs a county parcel source with clear terms |
| Roof size/pitch never measured, laser survey present | ~126,000 (Denver 71,705; Centennial 12,657; Castle Rock 12,413; Arvada 6,886; Highlands Ranch 6,854; Parker 4,829; Thornton 4,552) | Doors added after the roof run (all-sizes rebuild, west-side and gap fixes); Denver's roof pass never ran on the 26 Oct list (its sun pass did) | 2 roofsolar |
| Sun estimate never measured | ~52,000 (same towns minus Denver) | Same | 2 roofsolar |
| Colorado Springs NE roof "no parcel at the point" | 8,467 | Lot download broke during the roof run (the sun run has 59) | 2 roofsolar |
| Roof material with county records but no file | ~63,500 (Highlands Ranch 25,135; Parker 23,513; Castle Pines 6,689; Castle Rock ~11,000 more) | Material step never run after those towns were (re)built | 3 dougmat |
| Roof, sun, laser trees: "no LiDAR here" / no survey mapped | ~133,000 in 113 towns | The pipeline knew 8 surveys; the probe found more in the same public bucket (Longmont, Lafayette, Louisville, Superior, Mead, Niwot on DRCOG 2020; Greeley, Windsor, Weld Group 1 on Eastern 2018; Durango, Cortez, Pagosa, Sterling, Fort Morgan, Brush, Elizabeth, Leadville, Telluride, Meeker, ...) | 4 newlidar |
| Roof, sun: no survey anywhere | Fort Collins 32,009; Pueblo 26,333; Pueblo West 10,606; Grand Junction and Mesa 38,895; Steamboat; Montrose; Delta | No 3DEP survey in the public Entwine bucket (EPSG:3857) over them | **Blocked** (no source) |
| Trees never measured | 14,861 in 46 towns (Longmont 3,882, Boulder 2,265, Erie 1,891, Brighton 1,239) | Doors added after the tree run | 5 trees2 |
| Home value | Group 1: 70,488 (0%); Group 3: 0% | Group 1 towns were never added to sample-value.mjs's county list; Group 3's value step asked nothing for the same reason (its csv headers are also quoted) | 6 values |
| Roof material, Arapahoe / Jefferson / Denver-area towns | Aurora 82,458, Lakewood 39,332, Centennial, Arvada, ... | No county roof records; the photo model alone reaches 90% in no class | **Blocked**: TR-35 records requests |
| Roof outline over the photo, Groups 2 and 3 | 0% | Outlines are drawn over the DRAPP close-ups, which cover the Denver region only | Not a gap to fill (NAIP crop is shown) |
| Year built, new movers, permits, house and lot facts in Group 3 | 0% | No bulk county source wired for those counties | Not queued (sources first) |
| Hail hours | 66% of town storm days | The hours come from 20-minute samples of the 2-minute radar; short storms fall between samples | Not queued (a full 2-minute rebuild is possible later) |

The "Centennial problem" (cells on the old grid origin) does not show anywhere else: every other town's yard v2 file was written after the fix or has under 4% no-lot doors outside the Group 3b counties.
<!-- /findings -->

## By group

| Layer | core (96 towns, 864,687 homes) | G1 (41 towns, 70,488 homes) | G2 (43 towns, 159,290 homes) | G3 (223 towns, 137,865 homes) | commercial (4 towns, 5,088 homes) | All |
|---|---:|---:|---:|---:|---:|---:|
| Lot line | 99% | 99% | 99% | 62% | 0% | 95% |
| Lawn (yard v2) | 98% | 96% | 98% | 56% | 0% | 93% |
| Trees | 86% | 85% | 77% | 51% | 0% | 81% |
| Roof outline | 94% | 83% | 0% | 0% | 72% | 71% |
| Roof size/pitch | 69% | 31% | 21% | 0% | 0% | 53% |
| Roof photo | 100% | 94% | 100% | 100% | 100% | 100% |
| Roof material | 56% | 75% | 50% | 0% | 0% | 50% |
| Year built | 64% | 75% | 73% | 0% | 0% | 58% |
| Home value | 99% | 0% | 50% | 0% | 100% | 76% |
| Sun estimate | 72% | 28% | 18% | 0% | 0% | 54% |
| Hail on record (0.75 in+) | 96% | 95% | 83% | 34% | 98% | 87% |
| New movers | 77% | 94% | 68% | 0% | 0% | 68% |
| Permits | 18% | 0% | 0% | 0% | 0% | 12% |
| House facts (Pest) | 82% | 99% | 73% | 0% | 0% | 72% |
| Lot facts (Security) | 34% | 0% | 0% | 0% | 0% | 24% |
| Hail hours (town hail days with hours) | 56% | 56% | 60% | 73% | 64% | 66% |

Towns with no file for a layer (count of towns): Roof outline 269, Roof size/pitch 241, Roof photo 0, Roof material 40, Year built 289, Sun estimate 4, Hail on record (0.75 in+) 0, New movers 247, Permits 387, House facts (Pest) 265, Lot facts (Security) 311.

## Lawn and lot faults

Towns where 3% or more of homes read "no lot" in yard v2, or where homes in the door file were never measured.

| Town | County | Group | Homes | No lot | Never measured | Lawn under 300 sq ft (of lots) | Median lawn | yard v2 run |
|---|---|---|---:|---:|---:|---:|---:|---|
| Montrose | montrose | G3 | 7,501 | 7,501 (100%) | 0 | — | — | 2026-10-30 |
| Montrose (rural) | montrose | G3 | 5,238 | 5,232 (100%) | 0 | 0% | 635 | 2026-10-30 |
| Trinidad | lasanimas | G3 | 3,438 | 3,438 (100%) | 0 | — | — | 2026-10-30 |
| Delta | delta | G3 | 2,905 | 2,905 (100%) | 0 | — | — | 2026-10-30 |
| Alamosa | alamosa | G3 | 2,727 | 2,727 (100%) | 0 | — | — | 2026-10-30 |
| Olathe (rural) | montrose | G3 | 2,351 | 2,351 (100%) | 0 | — | — | 2026-10-30 |
| Hotchkiss (rural) | delta | G3 | 2,098 | 2,098 (100%) | 0 | — | — | 2026-10-30 |
| South Denver | denver | core | 26,975 | 5 (0%) | 1,939 | 26% | 958 | 2026-10-25 |
| Cedaredge (rural) | delta | G3 | 1,911 | 1,911 (100%) | 0 | — | — | 2026-10-30 |
| Delta (rural) | delta | G3 | 1,875 | 1,875 (100%) | 0 | — | — | 2026-10-30 |
| Alamosa (rural) | alamosa | G3 | 1,709 | 1,709 (100%) | 0 | — | — | 2026-10-30 |
| Trinidad (rural) | lasanimas | G3 | 1,603 | 1,603 (100%) | 0 | — | — | 2026-10-30 |
| Paonia (rural) | delta | G3 | 1,379 | 1,379 (100%) | 0 | — | — | 2026-10-30 |
| Orchard City | delta | G3 | 1,373 | 1,373 (100%) | 0 | — | — | 2026-10-30 |
| Nucla (rural) | montrose | G3 | 1,078 | 1,078 (100%) | 0 | — | — | 2026-10-30 |
| Weston (rural) | lasanimas | G3 | 1,073 | 1,073 (100%) | 0 | — | — | 2026-10-30 |
| West Conejos (rural) | conejos | G3 | 1,037 | 1,037 (100%) | 0 | — | — | 2026-10-30 |
| Cedaredge | delta | G3 | 978 | 978 (100%) | 0 | — | — | 2026-10-30 |
| Creede (rural) | mineral | G3 | 899 | 898 (100%) | 0 | 0% | 6211 | 2026-10-30 |
| Las Animas | bent | G3 | 795 | 795 (100%) | 0 | — | — | 2026-10-30 |
| Mosca-Hooper (rural) | alamosa | G3 | 786 | 786 (100%) | 0 | — | — | 2026-10-30 |
| La Jara (rural) | conejos | G3 | 773 | 773 (100%) | 0 | — | — | 2026-10-30 |
| Blanca (rural) | costilla | G3 | 703 | 703 (100%) | 0 | — | — | 2026-10-30 |
| Paonia | delta | G3 | 601 | 601 (100%) | 0 | — | — | 2026-10-30 |
| Rifle | garfield | G3 | 2,068 | 596 (29%) | 0 | 30% | 764 | 2026-10-29 |
| Alamosa East | alamosa | G3 | 520 | 520 (100%) | 0 | — | — | 2026-10-30 |
| Olathe | montrose | G3 | 462 | 462 (100%) | 0 | — | — | 2026-10-30 |
| Antonito (rural) | conejos | G3 | 462 | 462 (100%) | 0 | — | — | 2026-10-30 |
| San Luis (rural) | costilla | G3 | 460 | 460 (100%) | 0 | — | — | 2026-10-30 |
| Aguilar (rural) | lasanimas | G3 | 459 | 458 (100%) | 0 | — | — | 2026-10-30 |
| Idaho Springs | clearcreek | core | 487 | 0 (0%) | 403 | 88% | 0 | 2026-10-26 |
| Manassa | conejos | G3 | 383 | 383 (100%) | 0 | — | — | 2026-10-30 |
| Sanford | conejos | G3 | 350 | 350 (100%) | 0 | — | — | 2026-10-30 |
| Hotchkiss | delta | G3 | 346 | 346 (100%) | 0 | — | — | 2026-10-30 |
| Nucla | montrose | G3 | 324 | 324 (100%) | 0 | — | — | 2026-10-30 |
| La Jara | conejos | G3 | 314 | 314 (100%) | 0 | — | — | 2026-10-30 |
| Antonito | conejos | G3 | 312 | 312 (100%) | 0 | — | — | 2026-10-30 |
| Manassa (rural) | conejos | G3 | 291 | 291 (100%) | 0 | — | — | 2026-10-30 |
| Castle Pines | douglas | core | 7,080 | 265 (4%) | 0 | 35% | 947 | 2026-10-26 |
| Aguilar | lasanimas | G3 | 255 | 255 (100%) | 0 | — | — | 2026-10-30 |
| Bald Mountain (rural) | boulder | G1 | 1,724 | 241 (14%) | 0 | 50% | 280 | 2026-10-28 |
| City of Creede | mineral | G3 | 237 | 237 (100%) | 0 | — | — | 2026-10-30 |
| Kim (rural) | lasanimas | G3 | 225 | 225 (100%) | 0 | — | — | 2026-10-30 |
| Las Animas (rural) | bent | G3 | 222 | 222 (100%) | 0 | — | — | 2026-10-30 |
| Woodland Park | teller | core | 2,959 | 0 (0%) | 208 | 4% | 3660 | 2026-10-26 |
| Silverthorne | summit | G3 | 987 | 207 (21%) | 0 | 58% | 97 | 2026-10-29 |
| Romeo | conejos | G3 | 161 | 161 (100%) | 0 | — | — | 2026-10-30 |
| McClave (rural) | bent | G3 | 150 | 150 (100%) | 0 | — | — | 2026-10-30 |
| San Luis | costilla | G3 | 149 | 149 (100%) | 0 | — | — | 2026-10-30 |
| Fort Garland | costilla | G3 | 136 | 136 (100%) | 0 | — | — | 2026-10-30 |
| Branson (rural) | lasanimas | G3 | 116 | 116 (100%) | 0 | — | — | 2026-10-30 |
| Model (rural) | lasanimas | G3 | 80 | 80 (100%) | 0 | — | — | 2026-10-30 |
| Niwot | boulder | core | 1,255 | 42 (3%) | 0 | 10% | 7470 | 2026-10-26 |
| Pine Brook Hill | boulder | G1 | 367 | 38 (10%) | 0 | 67% | 22 | 2026-10-28 |
| Lazy Acres | boulder | G1 | 338 | 38 (11%) | 0 | 79% | 0 | 2026-10-28 |
| South Bent (rural) | bent | G3 | 34 | 34 (100%) | 0 | — | — | 2026-10-30 |
| Livermore (rural) | larimer | G2 | 889 | 28 (3%) | 0 | 62% | 43 | 2026-10-29 |
| Cripple Creek | teller | core | 82 | 0 (0%) | 27 | 20% | 5769 | 2026-10-26 |
| Granby | grand | G3 | 521 | 24 (5%) | 0 | 77% | 22 | 2026-10-29 |
| Lake George (rural) | park | G3 | 501 | 17 (3%) | 0 | 17% | 2895 | 2026-10-29 |
| Grand Lake | grand | G3 | 143 | 17 (12%) | 0 | 79% | 0 | 2026-10-29 |
| Altona | boulder | G1 | 184 | 15 (8%) | 0 | 54% | 205 | 2026-10-28 |
| Granby (rural) | grand | G3 | 110 | 12 (11%) | 0 | 51% | 248 | 2026-10-29 |
| Paragon Estates | boulder | G1 | 289 | 11 (4%) | 0 | 11% | 5985 | 2026-10-28 |
| Center (rural) | saguache | G3 | 70 | 11 (16%) | 0 | 18% | 2433 | 2026-10-30 |
| Saguache (rural) | saguache | G3 | 187 | 10 (5%) | 0 | 75% | 0 | 2026-10-30 |
| Nederland | boulder | core | 97 | 9 (9%) | 0 | 55% | 65 | 2026-10-26 |
| Colorado City | pueblo | G2 | 221 | 9 (4%) | 0 | 55% | 205 | 2026-10-29 |
| Sugarloaf | boulder | G1 | 90 | 5 (6%) | 0 | 47% | 506 | 2026-10-28 |
| St. Ann Highlands | boulder | G1 | 95 | 5 (5%) | 0 | 24% | 1679 | 2026-10-28 |
| Eldorado Springs | boulder | G1 | 102 | 4 (4%) | 0 | 21% | 9537 | 2026-10-28 |
| Kremmling (rural) | grand | G3 | 101 | 4 (4%) | 0 | 63% | 118 | 2026-10-29 |
| Eldora | boulder | G1 | 32 | 1 (3%) | 0 | 62% | 0 | 2026-10-28 |
| Silverthorne (rural) | summit | G3 | 22 | 1 (5%) | 0 | 5% | 9235 | 2026-10-29 |
| Mount Crested Butte | gunnison | G3 | 5 | 1 (20%) | 0 | 25% | 689 | 2026-10-30 |

Towns with no yard v2 file: Commercial test · Springs east (1203), Commercial test · South metro (822), Commercial test · West Denver / Lakewood (3057), Commercial showcase (6).

## Every town

Shares of the town's homes. "—" = no file for that town.

| Town | Grp | County | Homes | Lot line | Lawn | Trees | Roof outline | Roof size/pitch | Roof photo | Roof material | Year built | Home value | Sun estimate | Hail on record | New movers | Permits | House facts | Lot facts | Hail hrs |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Denver | core | denver | 105,486 | 100% | 99% | 89% | 92% | 23% | 100% | 96% | 98% | 100% | 79% | 101% | 53% | — | 99% | 46% | 72% |
| Aurora | core | arapahoe | 82,458 | 100% | 100% | 83% | 97% | 87% | 100% | 0% | — | 100% | 79% | 100% | 62% | 36% | — | 1% | 82% |
| Lakewood | core | jefferson | 39,332 | 100% | 99% | 84% | 99% | 92% | 100% | 0% | — | 100% | 79% | 99% | 87% | — | 100% | 0% | 42% |
| Arvada | core | jefferson | 37,589 | 100% | 99% | 89% | 95% | 74% | 100% | — | — | 100% | 73% | 69% | 89% | — | 98% | 16% | 67% |
| Thornton | core | adams | 33,431 | 100% | 99% | 86% | 98% | 75% | 100% | 86% | 100% | 100% | 75% | 100% | 94% | 9% | 100% | 18% | 55% |
| Fort Collins | G2 | larimer | 32,009 | 100% | 100% | 94% | — | 0% | 100% | 100% | 99% | 0% | 0% | 86% | 96% | — | 99% | — | 56% |
| Centennial | core | arapahoe | 30,291 | 100% | 100% | 94% | 99% | 55% | 100% | 0% | — | 100% | 55% | 100% | 66% | 45% | — | 13% | 57% |
| Colorado Springs Northwest | core | elpaso | 28,359 | 99% | 98% | 88% | 99% | 92% | 100% | 94% | 100% | 100% | 89% | 95% | 58% | 49% | 100% | 100% | 67% |
| South Denver | core | denver | 26,975 | 93% | 92% | 94% | 89% | 90% | 100% | 96% | 99% | 100% | 79% | 84% | 49% | — | 99% | 93% | 83% |
| Highlands Ranch | core | douglas | 26,742 | 100% | 99% | 96% | 92% | 64% | 100% | — | 94% | 100% | 64% | 100% | 100% | 52% | 100% | 74% | 40% |
| Colorado Springs Southwest | core | elpaso | 26,547 | 100% | 99% | 92% | 99% | 94% | 100% | 94% | 100% | 100% | 92% | 100% | 58% | 63% | 100% | 100% | 81% |
| Pueblo | G2 | pueblo | 26,333 | 100% | 100% | 58% | — | 0% | 100% | — | — | 100% | 0% | 100% | — | — | — | — | 56% |
| Westminster | core | adams | 26,249 | 100% | 98% | 92% | 91% | 95% | 100% | 99% | 52% | 100% | 87% | 81% | 90% | — | 100% | 0% | 63% |
| Parker | core | douglas | 24,642 | 100% | 98% | 83% | 95% | 68% | 120% | — | 96% | 100% | 68% | 120% | 99% | 16% | 100% | 80% | 50% |
| Colorado Springs Southeast | core | elpaso | 23,942 | 100% | 99% | 88% | 98% | 87% | 100% | 98% | 100% | 100% | 87% | 100% | 66% | 78% | 100% | 100% | 57% |
| Longmont | core | boulder | 22,371 | 99% | 98% | 81% | 96% | 3% | 100% | 99% | 100% | 100% | 3% | 100% | 98% | 4% | 100% | 0% | 17% |
| Loveland | G2 | larimer | 21,703 | 100% | 100% | 89% | — | 94% | 100% | 100% | 99% | 0% | 88% | 50% | 97% | — | 99% | — | 40% |
| Colorado Springs Northeast | core | elpaso | 21,142 | 100% | 99% | 75% | 96% | 48% | 100% | 97% | 100% | 100% | 74% | 100% | 74% | 56% | 100% | 100% | 80% |
| Greeley | G1 | weld | 20,060 | 99% | 99% | 91% | 93% | 4% | 100% | 100% | 100% | 0% | 4% | 100% | 94% | — | 100% | — | 50% |
| Castle Rock | core | douglas | 19,531 | 100% | 99% | 76% | 95% | 30% | 101% | 36% | 93% | 100% | 30% | 101% | 100% | — | 100% | 35% | 69% |
| Broomfield | core | broomfield | 18,325 | 100% | 99% | 89% | 82% | 90% | 100% | 0% | — | 100% | 86% | 100% | 74% | — | 100% | 0% | 63% |
| Commerce City | core | adams | 17,204 | 100% | 100% | 78% | 93% | 75% | 100% | 100% | 100% | 100% | 75% | 100% | 96% | — | 100% | 7% | 64% |
| Grand Junction | G2 | mesa | 17,075 | 99% | 98% | 88% | — | — | 100% | — | 99% | 100% | 0% | 83% | 87% | — | 99% | — | 40% |
| Boulder | core | boulder | 16,527 | 99% | 88% | 84% | 98% | 84% | 100% | 98% | 100% | 100% | 65% | 53% | 95% | 39% | 100% | 100% | 67% |
| Erie | core | weld | 11,477 | 99% | 99% | 66% | 72% | 59% | 100% | 100% | 100% | 100% | 72% | 100% | 100% | — | 100% | 31% | 57% |
| Windsor | core | weld | 11,452 | 100% | 100% | 73% | 87% | 9% | 100% | 98% | 76% | 76% | 8% | 78% | 74% | — | 76% | 5% | 43% |
| Brighton | core | adams | 10,830 | 100% | 100% | 74% | 93% | 81% | 100% | 100% | 99% | 100% | 77% | 100% | 93% | — | 99% | 0% | 56% |
| Pueblo West | G2 | pueblo | 10,606 | 97% | 97% | 0% | — | 0% | 100% | — | — | 100% | 0% | 84% | — | — | — | — | 62% |
| Dakota Ridge | core | jefferson | 10,341 | 100% | 100% | 92% | 97% | 95% | 100% | 0% | — | 100% | 86% | 100% | 93% | — | 100% | 0% | 71% |
| Ken Caryl | core | jefferson | 9,996 | 100% | 99% | 82% | 97% | 91% | 100% | 0% | — | 100% | 78% | 100% | 93% | — | 100% | 0% | 60% |
| Littleton | core | arapahoe | 9,984 | 100% | 99% | 95% | 92% | 95% | 100% | 0% | — | 100% | 85% | 100% | 62% | — | — | 0% | 57% |
| Black Forest | core | elpaso | 9,286 | 99% | 91% | 73% | 85% | 72% | 100% | 93% | 98% | 99% | 71% | 100% | 64% | 50% | 98% | 100% | 67% |
| Northglenn | core | adams | 8,110 | 100% | 100% | 91% | 100% | 94% | 100% | 100% | 100% | 100% | 84% | 100% | 82% | — | 100% | 0% | 38% |
| Wheat Ridge | core | jefferson | 7,693 | 100% | 99% | 89% | 95% | 90% | 100% | 0% | — | 100% | 82% | 100% | 85% | — | 99% | 0% | 33% |
| South Jefferson (rural) | G1 | jefferson | 7,556 | 99% | 90% | 91% | 93% | 93% | 100% | 0% | — | 0% | 86% | 97% | 90% | — | 99% | — | 72% |
| Montrose | G3 | montrose | 7,501 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Columbine | core | jefferson | 7,358 | 100% | 99% | 91% | 100% | 96% | 100% | 0% | — | 100% | 84% | 100% | 89% | — | 100% | 0% | 20% |
| Lafayette | core | boulder | 7,308 | 98% | 94% | 92% | 99% | 16% | 100% | 100% | 100% | 100% | 13% | 100% | 98% | — | 100% | 0% | 38% |
| Castle Pines | core | douglas | 7,080 | 96% | 93% | 73% | 95% | 70% | 113% | — | 95% | 100% | 70% | 113% | 99% | — | 100% | 88% | 73% |
| Monument | core | elpaso | 7,071 | 98% | 95% | 90% | 86% | 87% | 100% | 88% | 98% | 99% | 87% | 100% | 59% | 44% | 98% | 99% | 56% |
| Englewood | core | arapahoe | 6,899 | 100% | 99% | 96% | 98% | 87% | 100% | 0% | — | 100% | 78% | 100% | 67% | — | — | 1% | 100% |
| Fountain | core | elpaso | 6,825 | 100% | 99% | 91% | 98% | 90% | 100% | 98% | 100% | 100% | 90% | 100% | 73% | 89% | 100% | 100% | 58% |
| Loveland (rural) | G2 | larimer | 6,532 | 99% | 95% | 89% | — | 74% | 100% | 99% | 99% | 0% | 73% | 80% | 94% | — | 98% | — | 63% |
| Security-Widefield | core | elpaso | 6,175 | 100% | 100% | 97% | 99% | 96% | 100% | 99% | 100% | 100% | 96% | 100% | 65% | 89% | 100% | 100% | 50% |
| Montrose (rural) | G3 | montrose | 5,238 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 8% | — | — | — | — | 57% |
| Elizabeth (rural) | G3 | elbert | 5,190 | 99% | 75% | 82% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 72% |
| Louisville | core | boulder | 5,179 | 99% | 96% | 95% | 98% | 26% | 100% | 99% | 100% | 100% | 20% | 100% | 98% | — | 100% | 0% | 40% |
| Golden | core | jefferson | 4,935 | 100% | 99% | 90% | 99% | 94% | 100% | 0% | — | 100% | 86% | 37% | 88% | — | 99% | 0% | 0% |
| Frederick | core | weld | 4,675 | 99% | 99% | 75% | 86% | 81% | 100% | 100% | 100% | 100% | 76% | 100% | 100% | — | 100% | 0% | 50% |
| Johnstown | G1 | weld | 4,624 | 99% | 99% | 74% | 76% | 0% | 100% | 100% | 100% | 0% | 0% | 100% | 98% | — | 100% | — | 50% |
| Fort Collins (rural) | G2 | larimer | 4,577 | 100% | 97% | 93% | — | 0% | 100% | 100% | 98% | 0% | 0% | 91% | 91% | — | 99% | — | 45% |
| Evans | G1 | weld | 4,465 | 100% | 100% | 84% | 87% | 0% | 100% | 100% | 100% | 0% | 0% | 100% | 97% | — | 100% | — | 45% |
| Berthoud | G1 | weld | 4,431 | 100% | 100% | 75% | 4% | 0% | 6% | 99% | 99% | 0% | 0% | 100% | 98% | — | 99% | — | 50% |
| Clifton | G2 | mesa | 4,348 | 99% | 98% | 96% | — | — | 100% | — | 98% | 100% | 0% | 99% | 87% | — | 98% | — | 33% |
| The Pinery | core | douglas | 4,151 | 100% | 97% | 87% | 98% | 87% | 100% | 100% | 98% | 100% | 84% | 100% | 99% | — | 100% | 0% | 70% |
| Sherrelwood | core | adams | 4,139 | 100% | 100% | 98% | 95% | 98% | 100% | 100% | 100% | 100% | 95% | 87% | 80% | — | 100% | 0% | 33% |
| Fruita | G2 | mesa | 4,101 | 99% | 99% | 89% | — | — | 100% | — | 99% | 100% | 0% | 100% | 89% | — | 99% | — | 75% |
| Durango (rural) | G3 | laplata | 3,982 | 100% | 90% | 88% | — | — | 100% | 0% | — | 0% | 0% | 9% | — | — | — | — | 67% |
| Fairplay (rural) | G3 | park | 3,923 | 98% | 80% | 73% | — | — | 100% | 0% | — | 0% | 0% | 48% | — | — | — | — | 78% |
| Durango | G3 | laplata | 3,851 | 100% | 99% | 77% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Lone Tree | core | douglas | 3,718 | 100% | 97% | 78% | 92% | 88% | 100% | 99% | 82% | 100% | 77% | 100% | 100% | — | 100% | 0% | 67% |
| Central Jefferson (rural) | G1 | jefferson | 3,679 | 99% | 87% | 89% | 89% | 91% | 101% | 0% | — | 0% | 81% | 89% | 89% | — | 99% | — | 56% |
| Severance | G1 | weld | 3,523 | 99% | 98% | 45% | 82% | 13% | 100% | 100% | 100% | 0% | 12% | 100% | 100% | — | 100% | — | 45% |
| Greenwood Village | core | arapahoe | 3,510 | 99% | 98% | 95% | 99% | 97% | 100% | 0% | — | 100% | 86% | 100% | 60% | — | — | 0% | 38% |
| Trinidad | G3 | lasanimas | 3,438 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 53% |
| Timnath | G2 | larimer | 3,425 | 100% | 100% | 74% | — | 0% | 100% | 100% | 99% | 0% | 0% | 100% | 99% | — | 99% | — | 67% |
| Roxborough Park | core | douglas | 3,360 | 100% | 97% | 95% | 97% | 95% | 100% | 100% | 97% | 100% | 92% | 100% | 99% | — | 100% | 0% | 17% |
| Firestone | core | weld | 3,287 | 99% | 99% | 88% | 97% | 93% | 100% | 100% | 100% | 100% | 92% | 100% | 100% | — | 100% | 0% | 25% |
| Wellington | G2 | larimer | 3,224 | 100% | 100% | 0% | — | 85% | 100% | 98% | 99% | 0% | 0% | 100% | 98% | — | 99% | — | 38% |
| Superior | core | boulder | 3,106 | 100% | 100% | 78% | 83% | 62% | 100% | 99% | 99% | 100% | 56% | 100% | 99% | — | 99% | 0% | 50% |
| Commercial test · West Denver / Lakewood | commercial | comtest | 3,057 | — | 0% | 0% | 63% | — | 100% | — | — | 100% | — | 97% | — | — | — | — | 44% |
| Franktown | core | douglas | 3,026 | 100% | 91% | 85% | 94% | 50% | 96% | 51% | 94% | 100% | 50% | 100% | 99% | 15% | 100% | 51% | 67% |
| Redlands | G2 | mesa | 2,976 | 98% | 93% | 94% | — | — | 100% | — | 99% | 100% | 0% | 100% | 79% | — | 99% | — | 60% |
| Woodland Park | core | teller | 2,959 | 93% | 89% | 89% | 89% | 74% | 93% | 0% | — | 93% | 74% | 73% | — | 15% | — | 16% | 67% |
| Golden (rural) | G1 | jefferson | 2,941 | 100% | 92% | 94% | 95% | 93% | 100% | 0% | — | 0% | 89% | 65% | 85% | — | 99% | — | 64% |
| Delta | G3 | delta | 2,905 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Evergreen | core | jefferson | 2,851 | 100% | 97% | 88% | 93% | 87% | 100% | 0% | — | 100% | 72% | 100% | 88% | — | 100% | 0% | 57% |
| Fruitvale | G2 | mesa | 2,820 | 99% | 98% | 96% | — | — | 100% | — | 99% | 100% | 0% | 96% | 87% | — | 99% | — | 0% |
| Sterling Ranch | core | douglas | 2,805 | 100% | 100% | 27% | 29% | 27% | 100% | 91% | 91% | 100% | 26% | 100% | 100% | — | 100% | 0% | 17% |
| Cherry Creek | core | arapahoe | 2,749 | 100% | 100% | 99% | 99% | 98% | 100% | 0% | — | 100% | 92% | 100% | 65% | — | — | 0% | 33% |
| Alamosa | G3 | alamosa | 2,727 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 11% | — | — | — | — | 100% |
| Lochbuie | core | weld | 2,723 | 99% | 99% | 74% | 93% | 82% | 100% | 100% | 100% | 100% | 68% | 100% | 98% | — | 100% | 0% | 25% |
| Welby | core | adams | 2,709 | 100% | 100% | 93% | 100% | 96% | 100% | 100% | 99% | 100% | 87% | 100% | 84% | — | 99% | 0% | 67% |
| Gunbarrel | core | boulder | 2,688 | 98% | 84% | 88% | 100% | 93% | 100% | 96% | 100% | 100% | 74% | 100% | 97% | — | 99% | 0% | 60% |
| Sterling | G3 | logan | 2,553 | 100% | 100% | 98% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 69% |
| Pagosa Springs (rural) | G3 | archuleta | 2,548 | 100% | 89% | 84% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | 0% |
| Milliken | G1 | weld | 2,540 | 100% | 99% | 94% | 95% | 0% | 100% | 100% | 100% | 0% | 0% | 100% | 98% | — | 100% | — | 67% |
| Steamboat Springs | G3 | routt | 2,537 | 100% | 99% | 76% | — | — | 100% | 0% | — | 0% | 0% | 41% | — | — | — | — | 0% |
| Stonegate | core | douglas | 2,529 | 100% | 97% | 97% | 100% | 97% | 100% | 100% | 95% | 100% | 96% | 100% | 100% | — | 100% | 0% | 50% |
| Fort Lupton | core | weld | 2,520 | 99% | 99% | 63% | 68% | 2% | 100% | 100% | 100% | 100% | 2% | 100% | 93% | — | 100% | 0% | 46% |
| Twin Lakes | core | adams | 2,472 | 100% | 100% | 90% | 88% | 87% | 100% | 100% | 100% | 100% | 84% | 100% | 86% | — | 100% | 0% | 25% |
| Olathe (rural) | G3 | montrose | 2,351 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 7% | — | — | — | — | 100% |
| St. Charles Mesa (rural) | G2 | pueblo | 2,176 | 97% | 93% | 97% | — | 0% | 100% | — | — | 100% | 0% | 100% | — | — | — | — | 57% |
| Cortez | G3 | montezuma | 2,118 | 100% | 100% | 93% | — | — | 100% | 0% | — | 0% | 0% | 92% | — | — | — | — | 100% |
| Hotchkiss (rural) | G3 | delta | 2,098 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 10% | — | — | — | — | 67% |
| Rifle | G3 | garfield | 2,068 | 71% | 71% | 85% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Berkley | core | adams | 2,044 | 100% | 100% | 91% | 71% | 89% | 100% | 100% | 100% | 100% | 85% | 98% | 81% | — | 100% | 0% | 20% |
| Teller (rural) | G3 | teller | 2,001 | 100% | 90% | 92% | — | 0% | 100% | 0% | — | 0% | 0% | 72% | — | — | — | — | 73% |
| Orchard Mesa | G2 | mesa | 1,991 | 98% | 97% | 97% | — | — | 100% | — | 99% | 100% | 0% | 100% | 81% | — | 99% | — | 50% |
| Johnstown-Milliken (rural) | G1 | weld | 1,977 | 98% | 97% | 62% | 52% | 0% | 100% | 100% | 100% | 0% | 0% | 100% | 98% | — | 100% | — | 63% |
| Berthoud (rural) | G2 | larimer | 1,918 | 99% | 89% | 97% | — | 97% | 100% | 100% | 99% | 0% | 96% | 87% | 94% | — | 99% | — | 36% |
| Cedaredge (rural) | G3 | delta | 1,911 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 11% | — | — | — | — | 40% |
| Cherry Hills Village | core | arapahoe | 1,904 | 99% | 97% | 98% | 98% | 97% | 100% | 0% | — | 100% | 92% | 63% | 60% | — | — | 0% | 33% |
| Sedalia | core | douglas | 1,887 | 100% | 93% | 92% | 95% | 70% | 97% | 30% | 96% | 100% | 70% | 100% | 98% | 8% | 100% | 30% | 50% |
| Delta (rural) | G3 | delta | 1,875 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 1% | — | — | — | — | 100% |
| Bayfield (rural) | G3 | laplata | 1,848 | 100% | 84% | 94% | — | — | 100% | 0% | — | 0% | 0% | 64% | — | — | — | — | 67% |
| Mead | core | weld | 1,838 | 99% | 98% | 77% | 76% | 0% | 100% | 100% | 100% | 100% | 0% | 100% | 100% | — | 100% | 0% | 40% |
| Bald Mountain (rural) | G1 | boulder | 1,724 | 86% | 75% | 90% | 68% | 20% | 100% | 93% | 98% | 0% | 15% | 81% | 92% | — | 96% | — | 64% |
| Alamosa (rural) | G3 | alamosa | 1,709 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 9% | — | — | — | — | 100% |
| Timnath-Wellington (rural) | G2 | larimer | 1,680 | 100% | 88% | 67% | — | 22% | 100% | 98% | 99% | 0% | 4% | 90% | 96% | — | 99% | — | 78% |
| Todd Creek | G1 | adams | 1,658 | 100% | 98% | 96% | 99% | 96% | 100% | 100% | 100% | 0% | 95% | 100% | 97% | — | 100% | — | 63% |
| Eaton | G1 | weld | 1,651 | 98% | 98% | 92% | 98% | 20% | 100% | 100% | 100% | 0% | 20% | 100% | 95% | — | 100% | — | 0% |
| Cortez (rural) | G3 | montezuma | 1,636 | 100% | 76% | 98% | — | — | 100% | 0% | — | 0% | 0% | 49% | — | — | — | — | 100% |
| Trinidad (rural) | G3 | lasanimas | 1,603 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 82% |
| Fruita (rural) | G2 | mesa | 1,573 | 99% | 82% | 90% | — | — | 100% | — | 97% | 100% | 0% | 67% | 79% | — | 97% | — | 83% |
| Glenwood Springs (rural) | G3 | garfield | 1,531 | 100% | 90% | 88% | — | — | 100% | 0% | — | 0% | 0% | 13% | — | — | — | — | 100% |
| Glenwood Springs | G3 | garfield | 1,513 | 100% | 99% | 88% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Four Square Mile | core | arapahoe | 1,509 | 100% | 99% | 86% | 97% | 91% | 100% | 0% | — | 100% | 82% | 100% | 70% | — | — | 0% | 33% |
| Grand Junction (rural) | G2 | mesa | 1,477 | 99% | 98% | 98% | — | — | 100% | — | 94% | 100% | 0% | 48% | 79% | — | 94% | — | 50% |
| Greeley (rural) | G1 | weld | 1,468 | 99% | 96% | 95% | 78% | 3% | 100% | 99% | 100% | 0% | 3% | 100% | 86% | — | 99% | — | 63% |
| Derby | core | adams | 1,452 | 100% | 100% | 99% | 100% | 96% | 100% | 100% | 100% | 100% | 93% | 100% | 83% | — | 100% | 0% | 17% |
| Paonia (rural) | G3 | delta | 1,379 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 1% | — | — | — | — | 0% |
| Dacono | core | weld | 1,375 | 99% | 99% | 75% | 93% | 84% | 100% | 100% | 100% | 100% | 81% | 100% | 96% | — | 100% | 0% | 25% |
| Orchard City | G3 | delta | 1,373 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 26% | — | — | — | — | 100% |
| Estes Park (rural) | G2 | larimer | 1,367 | 98% | 91% | 92% | — | 91% | 100% | 100% | 99% | 0% | 87% | 58% | 91% | — | 99% | — | 80% |
| Shaw Heights | G1 | adams | 1,362 | 100% | 100% | 100% | 88% | 98% | 100% | 100% | 100% | 0% | 94% | 40% | 78% | — | 100% | — | 0% |
| Genesee | G1 | jefferson | 1,290 | 100% | 97% | 91% | 99% | 97% | 100% | 0% | — | 0% | 88% | 70% | 91% | — | 100% | — | 100% |
| Estes Park | G2 | larimer | 1,287 | 99% | 98% | 85% | — | 93% | 100% | 99% | 95% | 0% | 83% | 80% | 93% | — | 99% | — | 33% |
| Fort Morgan | G3 | morgan | 1,270 | 100% | 99% | 92% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 47% |
| Carbondale | G3 | garfield | 1,268 | 100% | 100% | 79% | — | — | 100% | 0% | — | 0% | 0% | 3% | — | — | — | — | 100% |
| Central City (rural) | G3 | gilpin | 1,257 | 99% | 94% | 94% | — | — | 100% | 0% | — | 0% | 0% | 79% | — | — | — | — | 46% |
| Niwot | core | boulder | 1,255 | 97% | 95% | 85% | 95% | 59% | 100% | 96% | 100% | 100% | 52% | 100% | 98% | — | 100% | 0% | 75% |
| Sheridan | core | arapahoe | 1,252 | 100% | 96% | 98% | 74% | 90% | 100% | 0% | — | 100% | 84% | 100% | 66% | — | — | 0% | 100% |
| Commercial test · Springs east | commercial | comtest | 1,203 | — | 0% | 0% | 90% | — | 100% | — | — | 100% | — | 100% | — | — | — | — | 67% |
| New Castle | G3 | garfield | 1,185 | 100% | 100% | 84% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Bennett | core | adams | 1,182 | 100% | 100% | 39% | 66% | 49% | 100% | 100% | 100% | 100% | 46% | 100% | 97% | — | 100% | 0% | 57% |
| Breckenridge | G3 | summit | 1,181 | 100% | 98% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Sterling (rural) | G3 | logan | 1,178 | 100% | 89% | 96% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 70% |
| Nucla (rural) | G3 | montrose | 1,078 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 44% | — | — | — | — | 92% |
| Weston (rural) | G3 | lasanimas | 1,073 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 94% | — | — | — | — | 92% |
| Edgewater | core | jefferson | 1,045 | 100% | 100% | 89% | 95% | 85% | 100% | 0% | — | 100% | 74% | 100% | 89% | — | 99% | 0% | 50% |
| Brush | G3 | morgan | 1,043 | 100% | 100% | 92% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 63% |
| West Conejos (rural) | G3 | conejos | 1,037 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | 0% |
| Ponderosa Park | G3 | elbert | 1,012 | 100% | 86% | 95% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 81% |
| Battlement Mesa | G3 | garfield | 987 | 100% | 98% | 89% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Silverthorne | G3 | summit | 987 | 79% | 78% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Cedaredge | G3 | delta | 978 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Gunnison (rural) | G3 | gunnison | 934 | 100% | 87% | 95% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Federal Heights | core | adams | 927 | 100% | 100% | 97% | 66% | 94% | 100% | 99% | 96% | 100% | 91% | 100% | 88% | — | 96% | 0% | 33% |
| Silt | G3 | garfield | 926 | 100% | 98% | 86% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Steamboat Springs (rural) | G3 | routt | 924 | 99% | 85% | 94% | — | — | 100% | 0% | — | 0% | 0% | 3% | — | — | — | — | 0% |
| Strasburg | core | adams | 922 | 100% | 97% | 97% | 82% | 1% | 100% | 99% | 73% | 100% | 1% | 100% | 90% | — | 73% | 0% | 75% |
| Acres Green | core | douglas | 916 | 100% | 99% | 100% | 99% | 97% | 100% | 100% | 100% | 100% | 93% | 100% | 95% | — | 100% | 0% | 100% |
| Holly Hills | core | arapahoe | 904 | 100% | 100% | 98% | 100% | 98% | 100% | 0% | — | 100% | 88% | 74% | 61% | — | — | 0% | 0% |
| Creede (rural) | G3 | mineral | 899 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 5% | — | — | — | — | 100% |
| Livermore (rural) | G2 | larimer | 889 | 97% | 81% | 13% | — | 80% | 100% | 96% | 96% | 0% | 9% | 37% | 93% | — | 96% | — | 75% |
| Monte Vista | G3 | riogrande | 888 | 100% | 100% | 90% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Fort Morgan (rural) | G3 | morgan | 864 | 100% | 86% | 91% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 73% |
| Gunnison | G3 | gunnison | 863 | 100% | 95% | 88% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Yuma | G3 | yuma | 824 | 100% | 99% | 98% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 60% |
| Snowmass Village (rural) | G3 | pitkin | 822 | 99% | 94% | 89% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | 100% |
| Commercial test · South metro | commercial | comtest | 822 | — | 0% | 0% | 75% | — | 100% | — | — | 100% | — | 100% | — | — | — | — | 47% |
| Elizabeth | core | elbert | 813 | 100% | 100% | 64% | — | — | 0% | — | — | 0% | 0% | 100% | 80% | — | 100% | 0% | 60% |
| Las Animas | G3 | bent | 795 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 38% |
| Clifton (rural) | G2 | mesa | 790 | 98% | 90% | 88% | — | — | 100% | — | 97% | 100% | 0% | 31% | 70% | — | 97% | — | 33% |
| Mosca-Hooper (rural) | G3 | alamosa | 786 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 1% | — | — | — | — | 50% |
| Perry Park | core | douglas | 780 | 100% | 95% | 89% | 87% | 31% | 100% | 100% | 93% | 100% | 29% | 41% | 97% | — | 100% | 0% | 0% |
| La Jara (rural) | G3 | conejos | 773 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 3% | — | — | — | — | 0% |
| Akron | G3 | washington | 773 | 100% | 99% | 94% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 60% |
| Durango Southwest (rural) | G3 | laplata | 741 | 100% | 69% | 96% | — | — | 100% | 0% | — | 0% | 0% | 52% | — | — | — | — | 50% |
| Bayfield | G3 | laplata | 732 | 100% | 99% | 75% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 100% |
| Larkspur | core | douglas | 711 | 100% | 94% | 88% | 89% | 85% | 94% | 94% | 100% | 100% | 85% | 100% | 98% | 42% | 100% | 94% | 33% |
| Pueblo (rural) | G2 | pueblo | 703 | 99% | 86% | 76% | — | 8% | 100% | — | — | 100% | 7% | 98% | — | — | — | — | 82% |
| Blanca (rural) | G3 | costilla | 703 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 23% | — | — | — | — | 100% |
| Whitewater-Kannah Creek (rural) | G2 | mesa | 680 | 98% | 75% | 89% | — | — | 100% | — | 98% | 100% | 0% | 49% | 80% | — | 98% | — | 50% |
| Meeker | G3 | rioblanco | 678 | 100% | 97% | 95% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Dove Valley | core | arapahoe | 673 | 100% | 100% | 66% | 100% | 99% | 100% | 0% | — | 100% | 65% | 100% | 79% | — | — | 0% | 50% |
| Leadville | G3 | lake | 671 | 100% | 98% | 91% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| La Salle | G1 | weld | 653 | 100% | 100% | 98% | 96% | 0% | 100% | 100% | 100% | 0% | 0% | 100% | 87% | — | 100% | — | 40% |
| Frisco | G3 | summit | 653 | 100% | 98% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Idaho Springs (rural) | G3 | clearcreek | 611 | 99% | 88% | 73% | — | — | 100% | 0% | — | 0% | 0% | 69% | — | — | — | — | 50% |
| Aspen | G3 | pitkin | 608 | 100% | 99% | 70% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Brush (rural) | G3 | morgan | 607 | 99% | 83% | 92% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 86% |
| El Jebel | G3 | eagle | 604 | 100% | 96% | 96% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Wiggins | G3 | morgan | 601 | 99% | 99% | 0% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 36% |
| Paonia | G3 | delta | 601 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Columbine Valley | core | arapahoe | 599 | 99% | 98% | 80% | 81% | 83% | 100% | 0% | — | 100% | 79% | 100% | 66% | — | — | 0% | 75% |
| Keenesburg | core | weld | 598 | 99% | 99% | 55% | 76% | 0% | 100% | 100% | 100% | 100% | 0% | 100% | 99% | — | 100% | 0% | 100% |
| Dolores (rural) | G3 | montezuma | 588 | 100% | 66% | 98% | — | — | 100% | 0% | — | 0% | 0% | 60% | — | — | — | — | 100% |
| Divide | core | teller | 575 | 100% | 91% | 94% | 93% | 88% | 100% | 0% | — | 100% | 88% | 96% | — | — | — | 12% | 43% |
| Telluride | G3 | sanmiguel | 571 | 100% | 44% | 88% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Coal Creek | G1 | jefferson | 544 | 100% | 92% | 94% | 94% | 83% | 100% | 0% | — | 0% | 76% | 71% | 86% | — | 99% | — | 75% |
| Rangely | G3 | rioblanco | 544 | 100% | 99% | 98% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Wray | G3 | yuma | 537 | 100% | 98% | 94% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 69% |
| Telluride (rural) | G3 | sanmiguel | 535 | 100% | 83% | 87% | — | — | 100% | 0% | — | 0% | 0% | 6% | — | — | — | — | 67% |
| Platteville | core | weld | 526 | 99% | 99% | 96% | 98% | 0% | 100% | 100% | 100% | 100% | 0% | 100% | 94% | — | 100% | 0% | 67% |
| Julesburg | G3 | sedgwick | 526 | 100% | 100% | 99% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 33% |
| Granby | G3 | grand | 521 | 95% | 87% | 0% | — | — | 100% | 0% | — | 0% | 0% | 9% | — | — | — | — | 0% |
| Alamosa East | G3 | alamosa | 520 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Ignacio (rural) | G3 | laplata | 504 | 100% | 60% | 89% | — | — | 100% | 0% | — | 0% | 0% | 47% | — | — | — | — | 67% |
| Lake George (rural) | G3 | park | 501 | 97% | 75% | 48% | — | — | 100% | 0% | — | 0% | 0% | 40% | — | — | — | — | 64% |
| Idaho Springs | core | clearcreek | 487 | 17% | 17% | 3% | 14% | 0% | 17% | 0% | — | 0% | 0% | 0% | — | — | — | 0% | — |
| Hayden | G3 | routt | 478 | 100% | 99% | 88% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Palisade | G2 | mesa | 472 | 98% | 97% | 85% | — | — | 100% | — | 100% | 100% | 0% | 0% | 83% | — | 100% | — | — |
| Walden | core | elpaso | 470 | 98% | 87% | 81% | 91% | 81% | 100% | 89% | 99% | 99% | 80% | 100% | 57% | — | 99% | 0% | 100% |
| Oak Creek (rural) | G3 | routt | 466 | 98% | 78% | 86% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Olathe | G3 | montrose | 462 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Antonito (rural) | G3 | conejos | 462 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 6% | — | — | — | — | 50% |
| San Luis (rural) | G3 | costilla | 460 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | 50% |
| Aguilar (rural) | G3 | lasanimas | 459 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 82% | — | — | — | — | 89% |
| Ouray (rural) | G3 | ouray | 458 | 100% | 79% | 87% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Mancos (rural) | G3 | montezuma | 445 | 100% | 54% | 97% | — | — | 100% | 0% | — | 0% | 0% | 25% | — | — | — | — | 67% |
| Palmer Lake | core | elpaso | 444 | 98% | 96% | 93% | 82% | 89% | 100% | 95% | 98% | 99% | 89% | 100% | 55% | 40% | 97% | 100% | 67% |
| Leadville North | G3 | lake | 438 | 100% | 99% | 97% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Laporte | G2 | larimer | 417 | 100% | 94% | 89% | — | 0% | 100% | 100% | 98% | 0% | 0% | 16% | 91% | — | 96% | — | 0% |
| Florissant | core | teller | 409 | 100% | 89% | 90% | 89% | 81% | 100% | 0% | — | 100% | 80% | 43% | — | — | — | 17% | 25% |
| Ault | G1 | weld | 404 | 99% | 98% | 37% | 79% | 5% | 100% | 100% | 100% | 0% | 5% | 100% | 100% | — | 100% | — | 0% |
| Aristocrat Ranchettes | G1 | weld | 399 | 100% | 100% | 100% | 90% | 0% | 100% | 99% | 100% | 0% | 0% | 100% | 87% | — | 99% | — | 50% |
| Meridian | core | douglas | 398 | 100% | 83% | 94% | 94% | 89% | 100% | 97% | 79% | 100% | 89% | 100% | 100% | — | 100% | 0% | 80% |
| Aspen (rural) | G3 | pitkin | 394 | 99% | 94% | 87% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Floyd Hill | G3 | clearcreek | 388 | 99% | 94% | 92% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 100% |
| Kremmling | G3 | grand | 385 | 98% | 97% | 88% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Manassa | G3 | conejos | 383 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 95% | — | — | — | — | 0% |
| New Castle (rural) | G3 | garfield | 380 | 100% | 72% | 94% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Ridgway | G3 | ouray | 373 | 100% | 99% | 79% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Pine Brook Hill | G1 | boulder | 367 | 90% | 83% | 89% | 88% | 78% | 100% | 92% | 100% | 0% | 40% | 89% | 96% | — | 99% | — | 0% |
| Deer Trail | G1 | arapahoe | 366 | 99% | 98% | 0% | — | 0% | 100% | 0% | — | 0% | 0% | 100% | 84% | — | — | — | 100% |
| Sanford | G3 | conejos | 350 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Basalt | G3 | eagle | 347 | 100% | 99% | 73% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Edwards | G3 | eagle | 346 | 100% | 95% | 78% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Hotchkiss | G3 | delta | 346 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Georgetown | G3 | clearcreek | 344 | 100% | 100% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Upper Bear Creek | G3 | clearcreek | 339 | 99% | 93% | 89% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 60% |
| Lazy Acres | G1 | boulder | 338 | 89% | 81% | 87% | 69% | 19% | 100% | 93% | 100% | 0% | 12% | 77% | 93% | — | 98% | — | 60% |
| Cripple Creek (rural) | G3 | teller | 338 | 100% | 83% | 89% | — | 0% | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 78% |
| Westcliffe (rural) | G3 | custer | 326 | 99% | 44% | 84% | — | — | 100% | 0% | — | 0% | 0% | 85% | — | — | — | — | 67% |
| Nucla | G3 | montrose | 324 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 3% | — | — | — | — | 100% |
| Del Norte | G3 | riogrande | 321 | 100% | 100% | 90% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| La Jara | G3 | conejos | 314 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Antonito | G3 | conejos | 312 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Ouray | G3 | ouray | 309 | 100% | 98% | 70% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Loghill Village | G3 | ouray | 303 | 100% | 84% | 90% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Winter Park | G3 | grand | 297 | 100% | 73% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Mancos | G3 | montezuma | 295 | 100% | 100% | 96% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Manassa (rural) | G3 | conejos | 291 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 67% | — | — | — | — | 67% |
| Paragon Estates | G1 | boulder | 289 | 96% | 92% | 95% | 93% | 93% | 100% | 94% | 98% | 0% | 84% | 100% | 89% | — | 98% | — | 25% |
| Avondale (rural) | G2 | pueblo | 284 | 100% | 85% | 96% | — | 0% | 100% | — | — | 100% | 0% | 100% | — | — | — | — | 64% |
| Aspen Park | G1 | jefferson | 272 | 100% | 97% | 96% | 91% | 86% | 100% | 0% | — | 0% | 77% | 100% | 83% | — | 99% | — | 67% |
| Bow Mar | core | jefferson | 268 | 99% | 99% | 98% | 99% | 98% | 100% | 0% | — | 100% | 94% | 100% | 67% | — | 32% | 0% | 40% |
| Leadville (rural) | G3 | lake | 263 | 100% | 86% | 92% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | 0% |
| Byers | core | arapahoe | 261 | 100% | 99% | 94% | 94% | 0% | 100% | 0% | — | 100% | 0% | 100% | 77% | — | — | 0% | 43% |
| Crested Butte (rural) | G3 | gunnison | 258 | 99% | 86% | 94% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Kittredge | G1 | jefferson | 257 | 100% | 93% | 89% | 88% | 88% | 100% | 0% | — | 0% | 80% | 100% | 91% | — | 99% | — | 50% |
| Fraser | G3 | grand | 257 | 100% | 79% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Foxfield | core | arapahoe | 255 | 98% | 98% | 97% | 98% | 97% | 100% | 0% | — | 100% | 95% | 100% | 55% | — | — | 0% | 80% |
| Aguilar | G3 | lasanimas | 255 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 50% |
| Otis | G3 | washington | 254 | 100% | 100% | 91% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 40% |
| Vail | G3 | eagle | 253 | 100% | 100% | 90% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Snowmass Village | G3 | pitkin | 251 | 99% | 97% | 90% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Oak Creek | G3 | routt | 241 | 100% | 99% | 95% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Rifle (rural) | G3 | garfield | 240 | 100% | 66% | 98% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Parachute | G3 | garfield | 238 | 100% | 97% | 75% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Colorado City-Rye (rural) | G2 | pueblo | 237 | 98% | 89% | 88% | — | 91% | 100% | — | — | 100% | 85% | 84% | — | — | — | — | 62% |
| City of Creede | G3 | mineral | 237 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Arboles (rural) | G3 | archuleta | 236 | 100% | 84% | 87% | — | — | 100% | 0% | — | 0% | 0% | 9% | — | — | — | — | 100% |
| Silverton | G3 | sanjuan | 236 | 100% | 99% | 79% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Lyons | core | boulder | 233 | 100% | 99% | 96% | 92% | 0% | 100% | 100% | 100% | 100% | 0% | 100% | 100% | — | 100% | 0% | 100% |
| Log Lane Village | G3 | morgan | 232 | 100% | 100% | 97% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 50% |
| Blende | G2 | pueblo | 231 | 99% | 97% | 97% | — | 0% | 100% | — | — | 100% | 0% | 100% | — | — | — | — | 17% |
| Kim (rural) | G3 | lasanimas | 225 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 87% |
| Las Animas (rural) | G3 | bent | 222 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 77% |
| Colorado City | G2 | pueblo | 221 | 96% | 95% | 79% | — | 80% | 100% | — | — | 100% | 79% | 100% | — | — | — | — | 30% |
| Merino (rural) | G3 | logan | 221 | 100% | 89% | 94% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 76% |
| Wiggins (rural) | G3 | morgan | 212 | 100% | 76% | 74% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 71% |
| Dolores | G3 | montezuma | 205 | 100% | 100% | 96% | — | — | 100% | 0% | — | 0% | 0% | 68% | — | — | — | — | 0% |
| Ignacio | G3 | laplata | 204 | 100% | 100% | 86% | — | — | 100% | 0% | — | 0% | 0% | 33% | — | — | — | — | 0% |
| Hudson | core | weld | 200 | 99% | 97% | 95% | 91% | 0% | 100% | 99% | 100% | 100% | 0% | 100% | 97% | — | 100% | 0% | 100% |
| Simla (rural) | G3 | elbert | 195 | 100% | 98% | 6% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 79% |
| Loma | G2 | mesa | 192 | 98% | 87% | 94% | — | — | 100% | — | 96% | 100% | 0% | 98% | 84% | — | 96% | — | 100% |
| Glade Park-Gateway (rural) | G2 | mesa | 192 | 97% | 78% | 89% | — | — | 100% | — | 98% | 100% | 0% | 89% | 71% | — | 98% | — | 86% |
| Hot Sulphur Springs | G3 | grand | 189 | 100% | 96% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Indian Hills | G1 | jefferson | 188 | 100% | 96% | 78% | 81% | 79% | 100% | 0% | — | 0% | 66% | 100% | 87% | — | 97% | — | 75% |
| Kersey | G1 | weld | 188 | 100% | 100% | 99% | 82% | 0% | 100% | 100% | 100% | 0% | 0% | 100% | 97% | — | 100% | — | 0% |
| Saguache (rural) | G3 | saguache | 187 | 95% | 89% | 74% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Altona | G1 | boulder | 184 | 92% | 85% | 91% | 88% | 83% | 100% | 90% | 98% | 0% | 58% | 100% | 97% | — | 98% | — | 33% |
| Monte Vista (rural) | G3 | riogrande | 182 | 99% | 88% | 95% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Georgetown (rural) | G3 | clearcreek | 181 | 100% | 96% | 18% | — | — | 100% | 0% | — | 0% | 0% | 31% | — | — | — | — | 0% |
| Basalt (rural) | G3 | eagle | 179 | 99% | 94% | 97% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Julesburg (rural) | G3 | sedgwick | 175 | 98% | 87% | 96% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 69% |
| Central | G3 | gilpin | 174 | 100% | 99% | 44% | — | — | 100% | 0% | — | 0% | 0% | 45% | — | — | — | — | 0% |
| Pierce | G1 | weld | 170 | 99% | 99% | 96% | 92% | 20% | 100% | 100% | 100% | 0% | 20% | 100% | 94% | — | 100% | — | 100% |
| Saguache | G3 | saguache | 169 | 100% | 100% | 95% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Del Norte (rural) | G3 | riogrande | 163 | 99% | 88% | 84% | — | — | 101% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Meeker (rural) | G3 | rioblanco | 163 | 99% | 54% | 94% | — | — | 100% | 0% | — | 0% | 0% | 6% | — | — | — | — | 33% |
| Romeo | G3 | conejos | 161 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 69% | — | — | — | — | 0% |
| Akron (rural) | G3 | washington | 158 | 100% | 63% | 99% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 70% |
| St. Mary's | G3 | clearcreek | 154 | 100% | 99% | 64% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Downieville-Lawson-Dumont | G3 | clearcreek | 151 | 100% | 99% | 60% | — | — | 100% | 0% | — | 0% | 0% | 63% | — | — | — | — | 0% |
| McClave (rural) | G3 | bent | 150 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 70% |
| San Luis | G3 | costilla | 149 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Ovid | G3 | sedgwick | 147 | 100% | 100% | 99% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 29% |
| Dillon | G3 | summit | 145 | 99% | 99% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Ault (rural) | G1 | weld | 143 | 98% | 88% | 60% | 69% | 15% | 100% | 94% | 99% | 0% | 10% | 81% | 97% | — | 99% | — | 88% |
| Grand Lake | G3 | grand | 143 | 88% | 80% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Salt Creek | G2 | pueblo | 142 | 99% | 99% | 96% | — | 0% | 100% | — | — | 100% | 0% | 100% | — | — | — | — | 33% |
| Norwood (rural) | G3 | sanmiguel | 140 | 100% | 76% | 94% | — | — | 100% | 0% | — | 0% | 0% | 68% | — | — | — | — | 50% |
| Upper Witter Gulch | G3 | clearcreek | 139 | 99% | 96% | 96% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 25% |
| Norwood | G3 | sanmiguel | 139 | 100% | 100% | 88% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 0% |
| Fairplay | G3 | park | 136 | 100% | 100% | 0% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 100% |
| Fort Garland | G3 | costilla | 136 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Yampa | G3 | routt | 135 | 100% | 100% | 86% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Dotsero | G3 | eagle | 134 | 100% | 100% | 95% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Collbran (rural) | G2 | mesa | 133 | 99% | 90% | 98% | — | — | 100% | — | 96% | 100% | 0% | 5% | 73% | — | 96% | — | 100% |
| Beulah Valley | G2 | pueblo | 132 | 99% | 95% | 92% | — | 90% | 100% | — | — | 100% | 86% | 98% | — | — | — | — | 100% |
| Fleming (rural) | G3 | logan | 125 | 99% | 61% | 94% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 73% |
| Weldona (rural) | G3 | morgan | 123 | 100% | 82% | 88% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 81% |
| Fleming | G3 | logan | 122 | 99% | 99% | 96% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 67% |
| Branson (rural) | G3 | lasanimas | 116 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 89% |
| Empire | G3 | clearcreek | 113 | 100% | 100% | 0% | — | — | 100% | 0% | — | 0% | 0% | 45% | — | — | — | — | 0% |
| Granby (rural) | G3 | grand | 110 | 89% | 78% | 0% | — | — | 100% | 0% | — | 0% | 0% | 2% | — | — | — | — | 0% |
| Mountain Village | G3 | sanmiguel | 110 | 100% | 64% | 89% | — | — | 100% | 0% | — | 0% | 0% | 85% | — | — | — | — | 100% |
| Peetz (rural) | G3 | logan | 103 | 98% | 87% | 92% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 75% |
| Pine Valley | G3 | clearcreek | 103 | 100% | 90% | 69% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 50% |
| Center | G3 | saguache | 103 | 97% | 97% | 96% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Eldorado Springs | G1 | boulder | 102 | 96% | 88% | 93% | 80% | 75% | 100% | 87% | 99% | 0% | 69% | 100% | 85% | — | 98% | — | 60% |
| Silver Cliff | G3 | custer | 102 | 100% | 89% | 88% | — | — | 100% | 0% | — | 0% | 0% | 66% | — | — | — | — | 67% |
| Watkins | core | arapahoe | 101 | 100% | 96% | 98% | 97% | 97% | 100% | 0% | — | 100% | 95% | 100% | 54% | — | — | 0% | 40% |
| Kremmling (rural) | G3 | grand | 101 | 96% | 74% | 87% | — | — | 100% | 0% | — | 0% | 0% | 1% | — | — | — | — | 100% |
| Yuma (rural) | G3 | yuma | 100 | 100% | 92% | 94% | — | — | 101% | 0% | — | 0% | 0% | 100% | — | — | — | — | 88% |
| Nederland | core | boulder | 97 | 91% | 91% | 73% | 92% | 60% | 100% | 94% | 96% | 100% | 36% | 0% | 97% | — | 93% | 0% | — |
| Nunn | G1 | weld | 97 | 100% | 100% | 0% | 81% | 38% | 100% | 91% | 99% | 0% | 0% | 100% | 91% | — | 99% | — | 20% |
| St. Ann Highlands | G1 | boulder | 95 | 95% | 89% | 93% | 52% | 0% | 100% | 97% | 100% | 0% | 0% | 97% | 98% | — | 100% | — | 100% |
| Cope (rural) | G3 | washington | 94 | 100% | 74% | 86% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 68% |
| Somerset (rural) | G3 | gunnison | 93 | 99% | 95% | 96% | — | — | 100% | 0% | — | 0% | 0% | 22% | — | — | — | — | 100% |
| Kiowa | core | elbert | 91 | 100% | 100% | 99% | — | — | 0% | — | — | 0% | 0% | 100% | 62% | — | 100% | 0% | 33% |
| Brook Forest | G1 | jefferson | 91 | 100% | 99% | 78% | 81% | 97% | 100% | 0% | — | 0% | 75% | 100% | 91% | — | 99% | — | 0% |
| Sugarloaf | G1 | boulder | 90 | 94% | 74% | 93% | 61% | 0% | 100% | 90% | 100% | 0% | 0% | 100% | 89% | — | 99% | — | 33% |
| Red Feather Lakes | G2 | larimer | 90 | 98% | 96% | 0% | — | 78% | 100% | 94% | 97% | 0% | 0% | 0% | 94% | — | 99% | — | — |
| Allenspark | G1 | boulder | 87 | 98% | 83% | 94% | 72% | 0% | 100% | 95% | 99% | 0% | 0% | 45% | 91% | — | 91% | — | 25% |
| Crook (rural) | G3 | logan | 87 | 98% | 82% | 90% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 71% |
| Sapinero (rural) | G3 | gunnison | 86 | 99% | 86% | 92% | — | — | 100% | 0% | — | 0% | 0% | 1% | — | — | — | — | 100% |
| Leadville North (rural) | G3 | lake | 86 | 99% | 65% | 93% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Pleasant View (rural) | G3 | montezuma | 83 | 100% | 65% | 95% | — | — | 100% | 0% | — | 0% | 0% | 25% | — | — | — | — | 33% |
| Cripple Creek | core | teller | 82 | 67% | 60% | 57% | 54% | 50% | 67% | 0% | — | 67% | 50% | 100% | — | — | — | 7% | 62% |
| Otis (rural) | G3 | washington | 81 | 100% | 48% | 100% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 78% |
| South Fork | G3 | riogrande | 80 | 99% | 98% | 84% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Model (rural) | G3 | lasanimas | 80 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 99% | — | — | — | — | 86% |
| Pagosa Springs | G3 | archuleta | 77 | 100% | 92% | 75% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Placerville | G3 | sanmiguel | 76 | 100% | 97% | 88% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| De Beque (rural) | G2 | mesa | 75 | 100% | 99% | 89% | — | — | 100% | — | 100% | 100% | 0% | 0% | 88% | — | 100% | — | — |
| Vineland | G2 | pueblo | 74 | 100% | 96% | 99% | — | 0% | 100% | — | — | 100% | 0% | 100% | — | — | — | — | 50% |
| Mulford | G3 | garfield | 73 | 100% | 96% | 93% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| North Washington | G1 | adams | 71 | 100% | 100% | 100% | 99% | 99% | 100% | 100% | 100% | 0% | 97% | 100% | 70% | — | 100% | — | 83% |
| Center (rural) | G3 | saguache | 70 | 84% | 49% | 81% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Chacra | G3 | garfield | 69 | 100% | 96% | 97% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Alma | G3 | park | 67 | 100% | 97% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Twin Lakes | G3 | lake | 67 | 100% | 99% | 93% | — | — | 100% | 0% | — | 0% | 0% | 12% | — | — | — | — | 0% |
| Cattle Creek | G3 | garfield | 66 | 100% | 97% | 85% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Gilcrest | G1 | weld | 65 | 98% | 98% | 97% | 71% | 0% | 100% | 100% | 100% | 0% | 0% | 100% | 98% | — | 100% | — | 33% |
| Rangely (rural) | G3 | rioblanco | 65 | 100% | 63% | 91% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Gypsum | G3 | eagle | 62 | 100% | 87% | 95% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Dove Creek (rural) | G3 | dolores | 57 | 98% | 72% | 77% | — | — | 100% | 0% | — | 0% | 0% | 21% | — | — | — | — | 0% |
| Woodlin (rural) | G3 | washington | 57 | 100% | 68% | 96% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 87% |
| Eagle-Gypsum (rural) | G3 | eagle | 54 | 100% | 74% | 85% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Westcliffe | G3 | custer | 54 | 100% | 98% | 78% | — | — | 100% | 0% | — | 0% | 0% | 7% | — | — | — | — | 100% |
| South Sedgwick (rural) | G3 | sedgwick | 50 | 100% | 40% | 100% | — | — | 100% | 0% | — | 0% | 0% | 98% | — | — | — | — | 83% |
| Morrison | core | jefferson | 49 | 100% | 94% | 100% | 98% | 96% | 100% | 0% | — | 100% | 96% | 100% | 80% | — | 100% | 0% | 75% |
| Breckenridge (rural) | G3 | summit | 49 | 100% | 98% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Lewis | G3 | montezuma | 48 | 100% | 83% | 100% | — | — | 100% | 0% | — | 0% | 0% | 31% | — | — | — | — | 100% |
| Idledale | G1 | jefferson | 47 | 100% | 100% | 91% | 87% | 81% | 100% | 0% | — | 0% | 77% | 100% | 91% | — | 100% | — | 67% |
| Boone | G2 | pueblo | 47 | 100% | 98% | 94% | — | 0% | 100% | — | — | 100% | 0% | 13% | — | — | — | — | 0% |
| Wray (rural) | G3 | yuma | 46 | 100% | 85% | 98% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 88% |
| Hayden (rural) | G3 | routt | 43 | 98% | 56% | 88% | — | — | 102% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Alpine | G3 | riogrande | 41 | 100% | 100% | 90% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Huerfano Valley (rural) | G2 | pueblo | 36 | 100% | 42% | 92% | — | 11% | 100% | — | — | 100% | 11% | 100% | — | — | — | — | 50% |
| Marble | G3 | gunnison | 34 | 100% | 100% | 97% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| South Bent (rural) | G3 | bent | 34 | 0% | 0% | 0% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 89% |
| Eldora | G1 | boulder | 32 | 97% | 84% | 94% | 97% | 34% | 100% | 88% | 100% | 0% | 25% | 0% | 94% | — | 100% | — | — |
| Glendale | core | arapahoe | 31 | 100% | 97% | 42% | 100% | 90% | 100% | 0% | — | 100% | 35% | 100% | 74% | — | — | 0% | 0% |
| Pueblo West (rural) | G2 | pueblo | 30 | 100% | 77% | 0% | — | 0% | 100% | — | — | 100% | 0% | 53% | — | — | — | — | 100% |
| Sargent (rural) | G3 | riogrande | 28 | 100% | 79% | 96% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Agate (rural) | G3 | elbert | 27 | 100% | 93% | 89% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 67% |
| Northeast Pueblo (rural) | G2 | pueblo | 25 | 100% | 84% | 76% | — | 4% | 100% | — | — | 100% | 0% | 88% | — | — | — | — | 64% |
| Keystone | G3 | summit | 25 | 100% | 96% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Minturn-Red Cliff (rural) | G3 | eagle | 24 | 100% | 100% | 83% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Silverthorne (rural) | G3 | summit | 22 | 95% | 91% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Silverton (rural) | G3 | sanjuan | 22 | 100% | 86% | 41% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Ute Mountain (rural) | G3 | montezuma | 21 | 100% | 29% | 100% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Idalia-Joes (rural) | G3 | yuma | 19 | 100% | 95% | 100% | — | — | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 71% |
| West Garfield (rural) | G3 | garfield | 13 | 100% | 23% | 85% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Victor | G3 | teller | 12 | 100% | 100% | 83% | — | 0% | 100% | 0% | — | 0% | 0% | 100% | — | — | — | — | 60% |
| Arboles | G3 | archuleta | 12 | 100% | 100% | 100% | — | — | 100% | 0% | — | 0% | 0% | 67% | — | — | — | — | 100% |
| Yampa (rural) | G3 | routt | 11 | 100% | 73% | 100% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Blue River | G3 | summit | 8 | 100% | 100% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Tabernash | G3 | grand | 6 | 100% | 100% | 0% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| West San Miguel (rural) | G3 | sanmiguel | 6 | 100% | 83% | 100% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Rico (rural) | G3 | dolores | 6 | 100% | 100% | 50% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Commercial showcase | commercial | comtest | 6 | — | 0% | 0% | 83% | — | 100% | — | — | 100% | — | 100% | — | — | — | — | 82% |
| Inverness | core | arapahoe | 5 | 100% | 80% | 80% | 100% | 100% | 100% | 0% | — | 100% | 100% | 100% | 80% | — | — | 0% | 100% |
| Mount Crested Butte | G3 | gunnison | 5 | 80% | 80% | 80% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Lake City (rural) | G3 | hinsdale | 5 | 100% | 40% | 100% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Crested Butte | G3 | gunnison | 4 | 100% | 100% | 75% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Rico | G3 | dolores | 4 | 100% | 100% | 100% | — | — | 100% | 0% | — | 0% | 0% | 75% | — | — | — | — | 100% |
| Dove Creek | G3 | dolores | 4 | 100% | 100% | 50% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Pitkin | G3 | gunnison | 2 | 100% | 100% | 100% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Cochetopa (rural) | G3 | saguache | 2 | 100% | 100% | 100% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
| Avon | G3 | eagle | 1 | 100% | 0% | 100% | — | — | 100% | 0% | — | 0% | 0% | 0% | — | — | — | — | — |
