# Lawn size per door: trial, 2026-10-02

**The aeration version of the fire map.** The question isn't "does this lawn look like it needs
aerating?" (colour can't answer that: a brown lawn in August is usually dormant, not compacted).
It's **"does this house have a real lawn, and how big is it?"** That's what makes a door worth
knocking for aeration, and lawn size is also what drives the quote on the walk.

**Status: trial run on 40 doors. Not built into the app.** The script and its contact sheet are in
[lawn-trial/](lawn-trial/).

---

## Sources

| What | Source | Licence |
|---|---|---|
| Aerial photos | USDA **NAIP 2023**, Colorado. Flown 25 Sep – 19 Oct 2023, **30 cm**, four bands **including near-infrared**. Read from Microsoft Planetary Computer's copy | **Public domain** (USDA FSA). The Planetary Computer catalogue links it as such |
| Tree height | Meta + World Resources Institute, **High Resolution Canopy Height Maps**, 1.2 m, metres. Public AWS bucket `dataforgood-fb-data` | Open, attribution required (*understood to be CC BY 4.0; confirm before any public use*) |
| Lot boundaries | Colorado statewide public parcels (the same service the door lists come from) | Public |

- **Not Google's pictures.** Google's terms don't allow software to download or analyse their
  imagery. The app's Satellite button is fine because a person is looking.
- **The USGS copy of NAIP only has Colorado's 2019 flight.** Microsoft's copy has 2023, plus 2021
  at 60 cm.

## Method

For each door:
1. Fetch the lot's real boundary.
2. Read the 2023 photo pixels inside it.
3. Classify each pixel:
   - **Lawn:** green (NDVI above 0.36) **and** under 1 m tall on the height map. Patches smaller
     than about 150 sq ft are dropped.
   - **Trees and shrubs:** green but taller, or 2 m and up.
   - **Other:** roofs, paving, bare and dry ground. These fall out on their own because they
     aren't green.

**Height is what made it work.** Grass and trees overlap completely on colour, brightness and
smoothness in these photos. Three colour-only versions were tried and none separated them. The
measured overlap is in the fact-check log.

## What the trial shows (39 of 40 doors; one point fell between parcels)

**Works well: suburban lots photographed in September.** Russet Sky Ct's lawn outline matches the
photo almost exactly (4,266 sq ft). Marsh Hawk Cir (front and back), 845 Circle Rd and Upton Ct
are also right. New construction shows 0, correctly (bare dirt in 2023).

**Four failure modes, all visible on the contact sheet:**
1. **Photos taken in mid-October undercount.** 13 of the 39 lots, mostly east Monument and Black
   Forest. The lawns had faded, e.g. Kitchener Way reads 680 sq ft against a visibly larger lawn.
   *Fix: also read the 2021 flight (15 Sep) and count a pixel as lawn if it was green in either
   year.*
2. **Dormant brown lawns are missed entirely** (16761 Buffalo Valley Path reads 0). Same fix
   helps. Lawns brown in both photos would still be missed.
3. **Scrub oak and forest clearings on wooded acreage count as lawn.** Gambel oak is green and
   under 2 m. Eagle Rd and Cedar Ct (5 ac each) read about 30,000 sq ft. Patch roughness doesn't
   separate it: real lawns beside trees score the same as scrub. *Fix: on mostly-wooded lots, show
   "mostly trees" and no lawn number.*
4. **Anything after September 2023 isn't in the photo:** new builds, sod, removals.

## If it's built

- **Per door:** "Lawn about 4,300 sq ft · 2023 photo", or "mostly trees" on wooded lots.
- **Per neighbourhood:** a **Most lawn** sort, the aeration counterpart to the fire sort.
- **Guard rails:** the 2021 second look; the wooded-lot suppression; the photo date shown on every
  figure.
- **Scale:** reading 31,000 lots works if done town by town. The height map is stored in full-width
  rows, so neighbouring lots share reads; lot by lot it would be tens of gigabytes. Must pass
  `verify-superset.mjs` like any rebuild.

## Reference lot: Brandon's, 17890 Sierra Way, Monument (2026-10-02)

Brandon's figures: **2.75 acres; house 1,600 sq ft footprint** (two storeys, 3,200 sq ft total).

| Check | Result |
|---|---|
| **Lot area** | The parcel boundary measures **109,580 sq ft = 2.52 acres**, matching the county's 2.52. **Brandon's 2.75 is 0.23 acres (~10,000 sq ft) more.** Worth checking his deed or plat against the county; a road easement or a second parcel are common reasons |
| **House, as a scale check** | Measured by hand on the 2023 photo against a 3 m grid: roof **≈ 160–165 m², ≈ 1,750 sq ft**. A 1,600 sq ft footprint plus eaves lands there. **The photo's scale is right.** (The automatic colour test couldn't find the roof: it's a green-grey, close to the pines) |
| **Lawn** | **≈ 1,200 sq ft lawn against 104,500 sq ft of trees**. The lot is almost entirely pine. This is exactly the wooded-lot case: the app should show **"mostly trees"**, not a lawn number. Fire badge: high |

## Reference lot: Kara's, 3846 Deboodt Ct (2026-10-02)

Her figures: **1-acre lot; 1,543 sq ft garage; 2,318 sq ft finished above ground, 2,574 below.**
Her notes record **~¾ acre of turf**, carried from job 2 and not re-measured.

- **Finding it:** Zillow and the post office call it Colorado Springs 80908; El Paso County files
  it as **Monument** 80908. Searches using "Colorado Springs" found nothing; the county's address
  suggester found it. The address point sits in the street, so the lot was identified from the
  parcels fronting Deboodt Ct.
- **Lot size:** both candidate lots measure **1.00 acre** by the boundary (43,547 and 43,616 sq ft).
  Matches.
- **Lawn:** **can't be tested. The house wasn't built yet.** The 19 Oct 2023 photo shows one lot as
  a mowed empty field and the next as a foundation under construction. This is failure mode 4 in
  action, and it's why every lawn figure must carry its photo date.

## First independent check: 2787 Russet Sky Ct, Castle Rock (2026-10-02)

Matthew measured the lawns by hand with Google Maps' area tool on Google's 2026 imagery, outlining
the grass and leaving out patios, beds and the pool area, but including grass under the trees.
Compared with this method on the September 2023 photo:

| Lawn | Google, hand-measured | This method | Difference |
|---|---|---|---|
| Backyard | 2,984 sq ft | 3,432 | +15% |
| Front, beside the house (with a tree) | 603 | 593 | −2% |
| Front, below the driveway (heavy tree shadow) | 311 | 231 | −26% |
| **Whole lot** | **3,898** | **4,266** | **+9%** |

- **Within about 10% overall.**
- **The errors run in opposite directions.** Open lawn reads high: edge fringe at 30 cm pixels,
  plus any change between 2023 and 2026. Shaded lawn reads low: grass under a canopy or in deep
  shadow is classed as tree.
- **One lot only.** Two or three more are needed before calling the bias typical or applying a
  correction.

## Second independent check: 1648 Marsh Hawk Cir, Castle Rock (2026-10-02)

Hand-measured by Matthew in Google Maps, with the official lot line drawn on the 2023 photo
(`lawn-trial/marsh-hawk-lot-line.png`) as a guide. The backyard lawn runs under about three mature
trees and was outlined straight across them. Matthew rates the outlines as best effort.

| Lawn | Google, hand-measured | This method | Difference |
|---|---|---|---|
| Front | 1,079 sq ft | 945 | −12% |
| Backyard, under trees | 1,265 | 915 (3 patches) | −28% |
| **Whole lot** | **2,344** | **1,866** | **−20%** |

The three tree canopies were also measured (540, 622 and 469 sq ft). They total more than the
backyard because they include crown outside the lawn, so they can't be subtracted to get the
visible grass.

**The pattern from two lots: trees decide the direction of the miss.** On the open lots (Russet
Sky) the method reads about 9% high, from edge fringe. Under canopy (Marsh Hawk) it reads 20% low,
because hidden grass is classed as tree. **A single correction won't fit both.** Plan: report the
visible lawn and adjust by the lot's tree cover, which the height map already gives; or label
tree-heavy lots "plus lawn under trees". The open lots still to measure (845 Circle Rd, 7378 Upton
Ct) will set the open-lot adjustment.

**Still missing: more independent measurements.** Brandon's lot confirms the boundaries and the
scale, but there's no real lawn to check. One suburban customer lot with a measured lawn (Kara's,
or a walk-sheet measurement) is the remaining test.

## Fact-check log

- **Verified:**
  - NAIP 2023 covers all five towns sampled, at 30 cm with a near-infrared band;
  - the licence link reads "Public Domain" (USDA FSA);
  - the USGS service carries only 2019 for Colorado;
  - the height map is reachable, in metres, EPSG:3857, 1.19 m pixels;
  - every figure in "What the trial shows" comes from the run saved in `lawn-trial/results.json`.
- **Measured, not assumed:** the colour-only failure. Green pixels on an all-forest lot (Arrowwood)
  and a lawn-heavy lot (Marsh Hawk) have near-identical median brightness (52 vs 49) and
  overlapping texture. Patch roughness for real lawns beside trees (13–20) overlaps scrub oak
  (14–25).
- **Verified against a real lot (Brandon's):** boundary area matches the county exactly; photo scale matches his house footprint within the eaves.
- **Not verified:** the canopy-height licence wording (understood CC BY 4.0); the acquisition
  dates behind the height map (it has a date layer, not yet read); accuracy on a lot measured on
  the ground. *Kara's lawn, or any lot Sixfold has walked, would be the first true check.*
