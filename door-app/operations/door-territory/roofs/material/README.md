# Roof material per house (2026-10-05)

What is on each roof, for the roofing version of the door-knocking app: `site/data/rounds/material-<town>.json`.
Two sources, kept apart in the file:

- **county** – Douglas County's assessor records the roof material (`year-<town>.json` `mat`). Used as is for Castle Rock,
  Franktown, Sedalia and Larkspur: 9,812 houses, `p: 1`.
- **imagery** – a classifier trained on those county labels and run on USDA NAIP 2023 aerial photographs (0.3 m, four
  bands, public domain), written **only where its confidence clears a per-class threshold at which it was at least 90%
  right in every Douglas town it had not seen**. Everything else is left out of the file rather than guessed.

The short version: **the photograph can tell asphalt shingle from concrete/clay tile; it cannot tell wood shake, metal
or flat roofs from anything, because Douglas County has too few of them to learn from.** El Paso's three towns
(Black Forest, Monument, Palmer Lake) got 7,709 imagery calls at that bar. The four Teller towns got none, for a
reason explained below.

## Output

```
material-<town>.json = { source, built, classes, thresholds, doors: { <id>: { m, p, src } } }
   m    asphalt | tile | shake | metal | flat
   p    1 for a county record; the classifier's probability (0.999-1.0 after thresholding) for imagery
   src  county | imagery
```

Houses with no entry have no material known to the required standard. Files are compact (Black Forest 330 KB).

## Coverage

| Town | Houses | County record | Imagery call | Any material | Imagery: asphalt / tile |
|---|---:|---:|---:|---:|---|
| Castle Rock | 7,082 | 7,025 | 40 | 7,065 (100%) | 40 / 0 |
| Franktown | 1,545 | 1,544 | 0 | 1,544 (100%) | – |
| Sedalia | 575 | 575 | 0 | 575 (100%) | – |
| Larkspur | 671 | 668 | 0 | 668 (100%) | – |
| Black Forest | 9,286 | 0 | 5,409 | 5,409 (58%) | 5,275 / 134 |
| Monument | 7,071 | 0 | 2,117 | 2,117 (30%) | 2,068 / 49 |
| Palmer Lake | 444 | 0 | 183 | 183 (41%) | 183 / 0 |
| Woodland Park | 2,751 | 0 | 0 | 0 | see Teller below |
| Divide | 575 | 0 | 0 | 0 | |
| Florissant | 409 | 0 | 0 | 0 | |
| Cripple Creek | 55 | 0 | 0 | 0 | |
| **All** | **30,464** | **9,812** | **7,749** | **17,561 (58%)** | |

Monument is lower than Black Forest because its houses are smaller, older and more often under trees, which leaves the
model less sure; the threshold is the same everywhere.

### Why the Teller towns have nothing

The chosen model leans on year built and the LiDAR roof size/pitch alongside the photo (year built is its single
strongest feature; see `model-report.json` `top_features`). Teller has neither `year-<town>.json` nor `roof-<town>.json`,
so the model would be running on a path it was never trained on. The imagery-only variant was tested the same way and
**reached 90% precision in no class in every held-out town** (`model-report.json` `runs.imagery_only*`), so there is no
honest threshold to apply there. Teller also has the most metal roofs of the eleven towns by eye (white, green and red
standing-seam roofs are common in the Divide and Woodland Park crops), which is exactly the material the training
data cannot teach. Getting Teller labelled needs either Teller assessor roof data or a hand-labelled sample there.

## Method

1. **Where the house is** (`houses.mjs`). The door's lat/lon is the parcel's point and can sit in a field on a rural lot.
   Per door: the lot from Colorado's statewide public parcel layer, the house as the largest Microsoft building outline
   whose centre is inside the lot (the same rule as tree-zones), or failing that the largest outline within 40 m; for the
   8,360 Douglas and El Paso houses that `sample-roofs.mjs` measured with a centre (Douglas only, in practice), the outline is slid onto the LiDAR roof centre. Result:
   30,464 doors, of which 28,655 have an outline on the lot, 743 a nearby outline, 1,066 none (those get a 6 m disc on
   the point and are never given an imagery call).
2. **The photograph** (`fetch.mjs`). One crop per house from Microsoft Planetary Computer's data API
   (`/api/data/v1/item/bbox/...npy`, collection `naip`, bands 1-4 + mask), NAIP 2023 for Colorado, 0.3 m, flown
   22 Sep - 20 Oct 2023, framed on the house with 4 m to spare, 20-60 m across. 30,464 crops, 0 failures, 1.2 GB in
   `cache/crops/`, 30 min at 6 concurrent requests. Every town is covered by 2023 NAIP (the STAC search per town is in
   `cache/naip-items.json`). No Google imagery is used anywhere.
3. **Roof pixels** (`features.py`). Inside the outline, 2 px in from its edge, minus vegetation and deep shadow.
   Vegetation is NDVI > 0.30 **and** near-infrared more than 35 over the brightest visible band: plain NDVI > 0.2
   wrongly stripped green metal roofs (they read NDVI 0.25-0.3 with NIR only ~15 over green; a tree reads 0.4+ and
   60-80 over), found on a Castle Rock spot-check and fixed before training.
4. **Features** (93): mean/std/percentiles of R, G, B, NIR; hue (circular), saturation, value; CIE Lab; NDVI; band
   ratios; the sunlit half's colour on its own; a two-plane brightness split; texture (Sobel gradient, Laplacian, local
   std at 5 and 9 px, structure-tensor coherence, the same at 0.6 m); the share of spectral power at 0.6-1.5 m
   wavelengths (tile ribs, seams, courses); tree-cover and shadow shares; plus LiDAR roof area, pitch, height and
   footprint (`roof-<town>.json`) and year built, remodel year and building sq ft (`year-<town>.json`) where present.
5. **Classes.** The county's nine materials collapsed to five:

   | Class | County materials | Labels | Verdict |
   |---|---|---:|---|
   | asphalt | Composition Shingle 8,489, Composition Roll 25 | 8,514 | learnable |
   | tile | Concrete Tile 1,030, Clay Tile 64 | 1,094 | learnable |
   | shake | Wood Shake | 156 | **not enough reliable data** – the labels are stale (see failure modes); 3% recall |
   | metal | Preformed Metal 23, Formed Seam Metal 7, Copper 1 | 31 | **not enough data** – 3% recall |
   | flat | Built Up Rock 16, Elastomeric 1 | 17 | **not enough data** – 6% recall |

   Per town: Castle Rock 6,404 / 567 / 37 / 9 / 8; Franktown 1,151 / 326 / 62 / 2 / 3; Sedalia 354 / 159 / 51 / 10 / 1;
   Larkspur 605 / 42 / 6 / 10 / 5 (asphalt / tile / shake / metal / flat). Tile is 8% of Castle Rock but 28% of Sedalia.
6. **Model** (`train.py`): scikit-learn `HistGradientBoostingClassifier` (400 trees, depth-limited, class-balanced).
   Four variants were run (all features / imagery only, balanced / not); the one that labels the most houses at the
   90%-in-every-town bar wins: all features, balanced.
7. **Prediction** (`predict.py`): county record where it exists; else the model's call if the crop has 40+ clear roof
   pixels, the house has an outline, and the probability clears the class threshold.

## Accuracy

All numbers are on houses the model did not train on. The headline split is **leave-one-town-out**: each Douglas town
predicted by a model trained on the other three, because the model is used on towns it has never seen. A random split
is also given; it flatters (neighbours in one subdivision share a builder's roofs).

### Leave-one-town-out, all four Douglas towns (n = 9,812, accuracy 92.9%)

| Class | Precision | Recall | Support |
|---|---:|---:|---:|
| asphalt | 0.952 | 0.971 | 8,514 |
| tile | 0.801 | 0.772 | 1,094 |
| shake | 0.098 | 0.032 | 156 |
| metal | 0.083 | 0.032 | 31 |
| flat | 0.083 | 0.059 | 17 |

Confusion (rows = county label, columns = model's call):

| | asphalt | tile | shake | metal | flat |
|---|---:|---:|---:|---:|---:|
| asphalt | 8,265 | 188 | 43 | 9 | 9 |
| tile | 244 | 845 | 3 | 2 | 0 |
| shake | 133 | 16 | 5 | 0 | 2 |
| metal | 27 | 3 | 0 | 1 | 0 |
| flat | 13 | 3 | 0 | 0 | 1 |

Accuracy by held-out town: Castle Rock 96.0%, Franktown 85.0%, Sedalia 79.8%, Larkspur 90.0%. The drop in Franktown
and Sedalia is their tile and shake share: a model that has learnt Castle Rock's 8% tile under-calls tile where it is
28%.

### Castle Rock only -> Franktown + Sedalia + Larkspur (n = 2,787, accuracy 85.1%)

asphalt P 0.857 R 0.973; tile P 0.833 R 0.596; shake 0.375 / 0.025; metal 0 / 0; flat 0.5 / 0.111. With thresholds
chosen on Castle Rock's own cross-validation (asphalt 0.461, tile 0.481), 99% of houses are kept at 85.4% precision:
**thresholds picked in one town do not carry its precision to the next**, which is why the final thresholds are set
the stricter way below.

### Random 5-fold over all four towns (n = 9,812, accuracy 95.4%)

asphalt P 0.968 R 0.983; tile P 0.888 R 0.888; shake 0.283 / 0.109; metal 0.286 / 0.065; flat 0.222 / 0.118.

## Thresholds

Rule: for each class, the lowest probability at which the houses the model calls that class are **at least 90% right in
every one of the four held-out towns** (each with 10+ calls), with 30+ calls overall. The pooled rule the brief
describes ("precision >= 90% on the held-out set") is also computed and reported in `model-report.json`
(`thresholds_pooled`), but it is satisfied by calling everything asphalt at p >= 0.34, because Castle Rock is 72% of
the labels and 91% asphalt; it would have been 80% right in Sedalia.

| Class | Threshold | Held-out houses passing | Precision | Recall at threshold | Per town precision (CR / Fr / Se / La) |
|---|---:|---:|---:|---:|---|
| asphalt | p >= 0.999 | 4,433 of 8,514 | 98.8% | 51.5% | 99.7% / 97.4% / 90.8% / 97.7% |
| tile | p >= 0.999 | 152 of 1,094 | 96.1% | 13.4% | 96.8% / 95.2% / 94.7% / 94.1% |
| shake | none | | | | no threshold reaches 90% |
| metal | none | | | | no threshold reaches 90% |
| flat | none | | | | no threshold reaches 90% |

Taken together the thresholds label 46.7% of held-out houses at 98.7% precision.

**What the asphalt call means outside Douglas.** Of the county's 31 metal roofs, 16% still receive p(asphalt) >= 0.999
(shake: 12%; flat: 0%). In a town where metal were a quarter of all roofs, the asphalt calls would be wrong about
0.25 x 0.16 / (0.75 x 0.51 + 0.25 x 0.16) = 9.5% of the time, i.e. right at the 90% line; where metal is rarer they are
better than that. This is the arithmetic behind running the model on El Paso, where metal is visibly more common than in
Castle Rock but far from a quarter of roofs, and behind not running it on Teller. A by-eye check of 24 Black Forest
asphalt calls found 3 that could be light-grey metal (8585-black-forest-rd, 16175-herring-rd, 7855-pine-cone-rd); of 24
Monument asphalt calls, none looked wrong; of 16 Black Forest tile calls, 14 are clearly tan concrete tile on large
custom homes and 2 are grey roofs the eye cannot settle. That is a sanity check, not a measurement.

## Known failure modes

- **Trees over the roof.** Vegetation pixels are masked, but a roof mostly under canopy leaves few clear pixels and a
  shadow-skewed colour; `veg_frac` and `shadow_frac` are features, and crops with under 40 clear pixels get no call.
  Monument's lower coverage is partly this.
- **Dark metal vs dark shingle, and light-grey metal vs weathered shingle.** At 0.3 m a standing seam is one pixel wide;
  the colour of a charcoal metal roof and a charcoal shingle roof is the same. The 31 metal labels cannot teach the
  difference, and 16% of them pass the asphalt threshold.
- **Stale county labels.** The county's "Wood Shake" houses include, on inspection, a red standing-seam metal roof
  (3237-haystack-rd) and several ordinary grey shingle roofs: shake has been replaced across Colorado for fire reasons
  and the assessor's field was not updated. So the shake class is noisy on both sides, and some of the model's 133
  "shake called asphalt" are probably right. The county records themselves (`src: county`) carry the same staleness.
- **2023 photo vs a later re-roof.** Everything here is as of Sept-Oct 2023; a hail re-roof since will not show.
- **Snow and shadow.** No snow was seen in any of the five towns spot-checked (Sept-Oct 2023 flights); long autumn
  shadows are present and the north plane of a steep roof can be near-black, which the DARK mask drops.
- **Outline off the roof.** Where the Microsoft outline is a garage or the lot has two buildings, the crop is the wrong
  building. The LiDAR slide corrects position for Douglas; El Paso and Teller rely on the raw outline.
- **The output is in EPSG:4326**, resampled from the native UTM grid by the data API; a slight blur, the same for every
  house.
- **Houses with no outline (1,066)** are never given an imagery call: the 6 m disc on the parcel point was seen sitting
  on trees (2535-sunnywood-ave, Woodland Park).

## Re-running

```
cd door-app/operations/door-territory/roofs/material
node houses.mjs                 # house centres and outlines -> cache/houses-<town>.json (skips towns already done)
node fetch.mjs [--town=x]       # NAIP crops -> cache/crops/<town>/ (fetches only what is missing; ~30 min from empty)
python features.py [town ...]   # -> cache/features-<town>.csv (skips a town whose csv is newer than its crop index; --force)
python train.py                 # -> cache/model.pkl, model-report.json (about 6 min)
python predict.py               # -> site/data/rounds/material-<town>.json, coverage.json
python look.py <town> [n] [start] [out.png] ["Concrete Tile" | pred:asphalt]   # spot-check sheet, delete after looking
```

Python is `C:/Users/Surge Inc/AppData/Local/Programs/Python/Python313/python.exe` (not on PATH); it needs numpy,
scipy, scikit-learn, pandas, pillow (scikit-learn, scipy and pandas were installed `--user` for this). `cache/` is
gitignored (1.3 GB: crops, features, model). The STAC item list in `cache/naip-items.json` pins the 2023 items; when a
newer NAIP year appears, delete it and `cache/crops/` to refetch.

To lift coverage: assessor roof-material records for El Paso or Teller would retrain the model on the materials it
currently cannot learn (metal above all) and make Teller labelable; failing that, a few hundred hand-labelled Teller
roofs would do the same for that county.

## Fact-check log

| Claim | Source | Status |
|---|---|---|
| NAIP 2023 Colorado is 0.3 m, 4-band, flown 22 Sep - 20 Oct 2023 | Planetary Computer STAC items (`cache/naip-items.json`: `gsd` 0.3, datetimes) | verified |
| Every town is inside 2023 NAIP | STAC search per town bbox, 4-12 items each, no crop request failed | verified |
| NAIP is public domain | USDA FSA NAIP programme page, named as licensor in the STAC items | verified |
| Microsoft building outlines, Colorado public parcels | the files and endpoint `tree-zones/zones.mjs` already uses | reused |
| Label counts (Composition Shingle 6,382 in Castle Rock etc.) | `year-<town>.json` counted at the start of this job | verified, matches the brief |
| Accuracy, confusion, thresholds | `cache/train.log`, `model-report.json`, this run | verified |
| Coverage per town | `coverage.json`, this run | verified |
| Metal roofs common in Teller; green metal roofs wrongly masked; shake labels stale | my own eye on spot-check sheets (castle-rock 12 shake / 7 metal, divide 16, woodland-park 16, black-forest 16 + 24 + 16, monument 24) | observed, not measured |
| 3237-haystack-rd is a red metal roof labelled Wood Shake | the Castle Rock shake sheet | observed |
| "shake replaced across Colorado for fire reasons" | general knowledge; not sourced here | unverified, stated as a likely explanation |
| Arithmetic on asphalt precision at 25% metal | the 16% figure from `cache/loto-oof.csv`; the formula is in the text | derived |
