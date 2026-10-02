# Wildfire hazard per door — research, 2026-10-01

**Sixfold's equivalent of Via's hail map.** Via narrows its cold-call list by asking *where did
hail actually fall?* before anyone looks a property up. The fire-mitigation version of that
question is *where is the land actually fire-prone?* — and there is a free, documented,
authoritative answer to it.

**Status: researched and verified. Not yet built into the app.**

---

## The source

**USDA Forest Service — Wildfire Hazard Potential (WHP), 2023, classified, 270 m.**
Dillon, Gregory K. 2023. *Wildfire Hazard Potential for the United States (270-m), version
2023.* Forest Service Research Data Archive. Funded by the USFS Fire Modeling Institute.

Served open, with no login, as an ArcGIS ImageServer on the USDA GeoSpatial Platform:
`https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/USFS_EDW_RMRS_WildfireHazardPotentialClassified/ImageServer`

WHP is *"an index that quantifies the relative potential for high-intensity wildfire that may be
difficult to manage, used as a measure to help prioritize where fuel treatments may be needed"*
— which is close to a literal description of the work Sixfold sells.

### Why not the layer that was already noted

`Public/TetraTechWUI` on El Paso's server carries a numeric `gridcode`, and **nothing on the
service says what the numbers mean** (SX-9b). Building on an undocumented legend is guessing.
WHP's classes are published.

## The classes — proven, not assumed

The documentation names **five classes: very low, low, moderate, high, very high**, but does not
spell out which number is which, and the service carries no attribute table. So the mapping was
tested on places whose answer is already known:

| Place | Value | Read as |
|---|---|---|
| 480 High Rd, Divide — dense conifer, seen on satellite | 4 | high |
| Black Forest, the 2013 fire area | 4 | high |
| Downtown Colorado Springs | 6 | non-burnable |
| Monument town centre | 6 | non-burnable |
| Pueblo Reservoir | 7 | water |

**1 very low · 2 low · 3 moderate · 4 high · 5 very high · 6 non-burnable · 7 water.** Every
known place landed where it should.

## What it does to the door list

All 31,422 doors sampled at their parcel centroid, in batches of 400. **Zero without a value.**

| Town | Doors | Very high | High | Moderate | Non-burnable | **High +** |
|---|---|---|---|---|---|---|
| Florissant | 409 | 64 | 216 | 86 | 28 | **280 (68%)** |
| Palmer Lake | 737 | 77 | 279 | 115 | 261 | **356 (48%)** |
| Woodland Park | 2,751 | 191 | 1,062 | 348 | 1,119 | **1,253 (46%)** |
| Cripple Creek | 55 | 7 | 15 | 14 | 15 | **22 (40%)** |
| Larkspur | 671 | 4 | 220 | 114 | 266 | **224 (33%)** |
| **Monument** | 7,515 | **189** | 2,023 | 1,572 | 3,560 | **2,212 (29%)** |
| Divide | 575 | 53 | 116 | 196 | 160 | **169 (29%)** |
| Sedalia | 578 | 29 | 77 | 197 | 268 | **106 (18%)** |
| Black Forest | 9,286 | 237 | 1,283 | 3,352 | 4,358 | **1,520 (16%)** |
| Franktown | 1,656 | 0 | 130 | 617 | 878 | **130 (8%)** |
| Castle Rock | 7,189 | 10 | 423 | 1,877 | 4,523 | **433 (6%)** |
| **All** | **31,422** | **861** | **5,844** | **8,488** | **15,436** | **6,705 (21%)** |

**The shortlist: 861 very-high doors, 6,705 high-or-above.** Working high-and-above first cuts
79% of the list while keeping the doors where fire work is most needed.

---

## ⚑ Four things to know before building on it

1. **It rates neighbourhoods, not lots.** Each cell is 270 m across — about 18 acres — so
   neighbouring houses share a value. That is the right shape for an area filter, exactly as a
   hail map is. **The per-house check is the satellite button**, which already exists.
2. **Class 6 "non-burnable" does not mean "no risk."** It means the cell is mapped as town or
   farmland. Half the doors sit in such cells, and a wooded lot can still sit inside one. Treat
   6 as *lower priority for this filter*, never as *excluded* or *safe*.
3. **It is a hazard index, not a sales signal.** High hazard says the land is fire-prone. It says
   nothing about whether the owner wants the work — that is what the knock is for.
4. **The data is 2023.** Recent, but dated; disturbance since then is not in it.

## Recommended build (not done)

Sample WHP at rebuild time and store the class on each door, the same way the coordinates
are carried — then show it on the door card and let the crew sort or filter neighbourhoods by
how many high-hazard doors they hold. That is the funnel: **hazard map → satellite → knock →
manual lookup for the few worth calling.** Rebuild must pass `verify-superset.mjs`.

## Fact-check log

- **Verified:** the service is open; its description and five-class scheme, from its own
  item info; the citation; the class-to-number mapping, by testing five known places; every
  door returns a value.
- **Not verified, and not relied on:** whether a newer WHP than 2023 exists; the exact reason
  Black Forest scores lower than its fire history suggests (one plausible cause is that the
  2013 fire consumed fuel, but that is a guess and is not stated as fact).
