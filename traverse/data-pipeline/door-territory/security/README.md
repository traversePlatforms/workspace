# Security edition data

Two builds write the Security edition's per-door side files into `traverse/app/data/rounds/` (gitignored):

- `build-security.mjs` (2026-10-06): crime counts near the door (Colorado Springs, Denver and Boulder police; area counts only,
  never a location), the town figures (FBI), owner lives elsewhere, sale month and year built. Writes `security-<town>.json`,
  `security-areas.json`, `security-rates.json`. See the header of the script.
- `build-lot.mjs` (2026-10-29): **lot facts**, plain physical facts about the lot. Writes `security-lot-<town>.json`.

Both file names start with `security-`, which every other edition's `keep()` in `editions/build-editions.cjs` already drops
(except the town Security-Widefield's own files), so the lot facts reach the Security edition only and never Sixfold.

## Lot facts (build-lot.mjs)

Per door, when true: `c` corner lot [own street, cross street]; `bk` backs onto a road [road name, metres from the back lot line to
the road's centre line, `h` highway (S1100) / `m` main road (S1200) / `''` other], `bd` = 1 when that lot line is Denver's own (only
where the lot line is on file: see "Backs onto a road" below); `al` an alley behind (`b`) or
beside (`s`), `ad` = 1 when that alley is from Denver's own map; `tr` a walkway, trail or bike path along the side or back;
`de` metres to where the house's own street dead-ends; `nn` metres to the nearest other home's point; `os` open space within 90 m
and `wa` a named creek or pond nearby (copied from the pest build). No score, no label about people or risk.

The card shows them under "The lot" in the security block (`secLotLines` in index.html); the nearest home only when 40 m or more;
the road behind as "Backs onto E 124th Ave, about 30 ft behind the lot", with "(highway)" or "(main road)" after the name only
when the Census class says so (S1100 / S1200), a fact from the class, never a rating.
Doors filters: Corner lot, Backs onto open space, Alley behind, Backs onto a road, Dead end or cul-de-sac.

### Sources and terms

| Source | What | Terms (checked 2026-10-29) |
|---|---|---|
| U.S. Census Bureau, TIGER/Line Shapefiles 2026, All Roads by county (`www2.census.gov/geo/tiger/TIGER2026/ROADS/tl_2026_08xxx_roads.zip`, files dated 2026-10-06, metadata 2026-09) | street centre lines, names (FULLNAME) and class (MTFCC); road classes from the 2026 MAF/TIGER Feature Class Codes (S1730 alley, S1710 walkway, S1820 bike path) | The files' own metadata: "not copyrighted ... free to use in a product or publication, however acknowledgement must be given to the U.S. Census Bureau as the source"; TIGER/Line is a Census trademark; no warranty. The card says "U.S. Census Bureau street map (2026)". |
| City and County of Denver, Alleys (ArcGIS item c8644edb9f414bd8a438fc55f6bdcd7a, `ODC_PWTRN_TRN_ALLEY_L` layer 116) | alley centre lines in Denver (TIGER has 45 in all of Denver County) | The item's terms: as is, no warranty, the user holds the city harmless, not for engineering; no limit on use. Same publisher and terms as the Denver crime layer already used. Credited on the card ("Alley: City and County of Denver") when the alley came from it. |
| Door files (county parcel centre and acres), `others-<town>.json` (homes not on the door list) | the house point, lot size, every home's point for the nearest-home distance | built earlier from the county and state parcel data |
| `pest-<town>.json` | open space (COMaP, state, 2026-07-17) and water (USGS NHD) | see `../pest/` |
| State of Colorado (OIT), *Colorado Public Parcels* (ArcGIS item 55234e04218f47c9868900e439fcbd5a, `gis.colorado.gov/public/rest/services/Address_and_Parcel`), as cached for the lawn work on 2026-10-21 (Highlands Ranch) and 2026-10-24 (Thornton, Westminster): `lawn-trial/drcog-turf/parcels-<town>.json` | lot lines for "backs onto a road" | The item's terms (read 2026-10-29 from arcgis.com): no warranty; resale of the service itself forbidden; "Commercial use in applications, including subscription-based applications, is allowed with proper attribution": "State of Colorado Public addresses were accessed on 2026-10-21 / 2026-10-24 from https://gis.colorado.gov/public/rest/services/Address_and_Parcel". The card says "lot lines: State of Colorado public parcels". |
| City and County of Denver, Parcels (ArcGIS item 7c53bd0894134e80ae1e478c0789bf49, `ODC_PROP_PARCELS_A` layer 245, modified 2026-10-29; 240,492 lots fetched 2026-10-29 by `fetch-denver-parcels.mjs` into `cache/parcels-denver.json`, geometry only) | lot lines in Denver (and South Denver, inside the county) | The item's terms: as is, no warranty, the user holds the city harmless, not for engineering or survey; no limit on commercial use (the same as Denver's alleys). Credited on the card ("lot lines: City and County of Denver") when `bd` is set. |

OpenStreetMap was not used (its ODbL licence would add share-alike and attribution duties); nor were Microsoft's building
footprints (ODbL too). gis.colorado.gov was not called tonight; only lot lines already cached on disk and Denver's own were used.

### How each fact is decided

The house point is the parcel's centre. Its own street is the nearest road whose name matches the address (whole name, then the
core name without direction and type, then without a trailing town or unit word, then the same first word within 60 m): found for
94.9% of doors. From the distance to the own street and the acres, the lot's depth and width are estimated. Then:

- **corner**: another named street (S1200, S1400, S1640) within half the lot's width + 13 m, not straight behind, and meeting the
  own street (crossing or ending on it) within the lot's half-diagonal + 18 m of the house point.
- **road behind**: see "Backs onto a road" below (from the lot line, not from these estimates).
- **alley**: S1730 (or Denver's alleys) within the same distances minus 4 m, behind (120 degrees or more) or beside.
- **dead end**: an end of a line of the own street that no other drivable road touches, within half the lot + 45 m.
- **nearest home**: the closest other home point at least 3 m away (units of one building share a point).
- A town home carries its whole complex's acres (Thornton's read 1 acre with neighbours 7 m away): when the acres would make a lot
  far wider than the spacing of the homes, the spacing is used.

### Backs onto a road (back-road.mjs, rebuilt 2026-10-29)

Matthew: "Is there a better way to detect road behind the lot? seems like a high security risk for homes." The first version (a
named road within half the *estimated* lot depth) read right about half the time against real lot lines (52.7-58.0% precision),
mostly because parkways sit behind a strip of HOA land and the estimated lot put the back in the wrong place. It was hidden.

The fact now: **a road that carries traffic (TIGER S1100 primary, S1200 secondary, S1400 local, S1640 service drive; named) runs
within 60 m behind the back lot line, it is not the house's own street, and nothing but open land lies between** (no other home's
lot, no parcel shaped like a building lot, no home's point). Alleys (S1730) stay the separate `al` fact. It is made only where the
lot line itself is on file. Per door:

1. the parcel holding the house point (exactly one, with no other home's point in it: town homes on one complex parcel are skipped);
2. the back direction: from the nearest point of the house's own street to the lot's middle;
3. five rays that way, spread from 20% to 80% across the lot; a ray counts only where it leaves through a back-facing piece of lot
   line (within 60 degrees), and goes on up to 80 m; its road is the first road of those classes it crosses, if the road runs across
   it (40 degrees or more off the ray), and not the own street;
4. a ray is stopped by another lot with a home's point in it, a parcel shaped like a building lot (compact: perimeter squared over
   area under 30, under 2.5 ha: an apartment block, a shop or a house our lists lack), a home's point within 6 m, or land more than
   30 m short of the road with no lot line on file within 20 m (the edge of the lawn cache);
5. the fact holds when three or more rays reach the same road (TIGER's duplicate names for one road, like McArthur Ranch Rd and
   Fairview Pkwy, count as one), at most one ray is stopped, the middle distance is 60 m or less, and the road does not meet the own
   street within 45 m of the house point (that is a corner lot's side street, not the back).

The distance is from the back lot line to the road's centre line (TIGER), so it includes half the road. Without a lot line the fact
is not made: the same rays from the house point and an estimated lot (`BACK_NOLOT=1 node build-lot.mjs ...`) checked at 23.5-63.5%
precision (Denver, Highlands Ranch, Westminster, Thornton), and no distance or class cut reached 90% in every town.

### Checks (2026-10-29)

`check-lot.mjs <town>` compares the corner fact with real lot lines: the state parcel polygons already cached for the lawn work
(`lawn-trial/drcog-turf/parcels-<town>.json`). For each door, the parcel holding its point; along the lot line every 2 m, the named
streets within 13 m; a corner is two such streets that meet within 22 m of the lot line.

| Town | corner: precision / recall |
|---|---|
| Highlands Ranch | 87.4% / 69.9% |
| Thornton | 87.3% / 77.1% |
| Westminster | 88.2% / 73.5% |

`check-back.mjs <town>` checks "backs onto a road" against the lot lines by a different route: no rays, its own street-name
matching and lot middle. The front is the stretch of lot line within 8 m of its closest approach to the own street, the rear the
back 15% of the lot from there; a road counts when its nearest point to the rear is within 60 m, within 45 degrees of straight back
and running across (40 degrees or more); and the strip from the rear's two outer points to the road (sampled every 2 m, and along
its middle every metre) holds no lot with a home or shaped like a building lot, no home's point, and no other road. Every door with
one lot and one home was tested (not a sample):

| Town | lot lines | precision | recall | distance agreement (median / 90th) |
|---|---|---|---|---|
| Highlands Ranch (suburban, HOA strips) | state layer | 96.6% (1,212 of 1,255) | 84.2% (1,212 of 1,440) | 0.7 m / 5.7 m |
| Thornton | state layer | 96.0% (1,653 of 1,721) | 85.1% (1,653 of 1,942) | 0.4 m / 3.0 m |
| Westminster | state layer | 96.3% (967 of 1,004) | 78.0% (967 of 1,239) | 0.4 m / 3.4 m |
| Denver (old grid and postwar) | Denver's | 96.9% (2,574 of 2,656) | 88.6% (2,574 of 2,904) | 0.3 m / 2.2 m |

By distance the check reads 96-98% under 40 m and 80-96% at 40-60 m; by class 99% for highways and main roads. Build positives the
check could not test (no own-street match by its simpler names): 15, 94, 23 and 333 respectively.

Looked at on the 2023 NAIP aerial photo (USDA, public domain, through Microsoft's Planetary Computer) with the lot lines, roads and
home points drawn on: 24 random positives of the final build (6 per town), and on the run before the last two fixes below 24 more
at random and 12 at 40-60 m: all 60 read right (the house backs onto the named road with only a strip, ditch, wall or park between; several names are TIGER's for a
road that also carries another, like Holly Cir N). Of 12 that the check called wrong, 9 were right on the photo (the check's angle
tests are stricter on wedge lots); the 3 truly wrong were corner lots meeting a side street, which step 5's side-street rule now
removes. Earlier runs found two other kinds of error, both fixed before the final numbers: houses whose lots carry no home point
(a town we have no list for; Denver apartment blocks), now stopped by the building-lot shape test, and a centre-of-lot rounding
error with metres in the millions (tens of metres off), now computed from the lot's first corner.

Alleys: Denver's old-grid neighbourhoods 75-90% of doors (Park Hill, Highland), postwar and
newer ones 0-6% (Harvey Park, Southmoor Park, Green Valley Ranch). Dead ends: 45-59% of "Ct" addresses in the suburbs against
about 5% of "St".

### Coverage (2026-10-29, 180 Colorado towns, 1,093,827 Security doors)

corner 155,493 (14.2%) · backs onto a road 7,800 (0.7%; 265 highway, 207 main road) · alley 64,967 (5.9%; 57,791 from Denver's
map) · path or trail 1,397 (0.1%) · dead end 135,883 (12.4%) · nearest home 40 m or more 71,637 (6.5%) · open space 176,878
(16.2%) · water 127,255 (11.6%) · at least one of these 560,689 (51.3%).

"Backs onto a road" needs the lot line, on file for 214,455 doors (19.6%) in 20 towns: Denver 102,867 (2,990 back onto a road),
South Denver 26,881 (222), Highlands Ranch 26,666 (1,270), Westminster 25,535 (1,027), Thornton 19,393 of 33,431 (1,818), and the
edges of those caches in Arvada, Broomfield, Northglenn, Shaw Heights, Sherrelwood, Twin Lakes, Centennial, Lone Tree, Federal
Heights, Berkley, Littleton, Todd Creek (and a few in Acres Green, Welby, Morrison). Among doors with a lot line, 3.6% back onto a
road. The old version's 32,288 (hidden) are gone. More towns come with more lot lines: the state layer once gis.colorado.gov is free
again (the lawn work's `drcog-turf-town.mjs` fetches and caches it by area), or a county's own parcel layer saved in the same
`{ cells: { key: [rings] } }` shape as `cache/parcels-<name>.json`; build-lot.mjs picks up every file there.

### Running it

```
# once: the county road files (about 90 MB) into cache/tiger/, and Denver's alleys
cd cache/tiger && for c in $(seq 1 2 125) 14; do f=$(printf "tl_2026_08%03d_roads.zip" $c); curl -sfO "https://www2.census.gov/geo/tiger/TIGER2026/ROADS/$f"; done
node fetch-denver-alleys.mjs
node fetch-denver-parcels.mjs          # Denver's lot lines, about 130 MB
# every Colorado town (about 1.5 minutes); or name towns; --debug lists unmatched street names and writes nothing
node --max-old-space-size=12000 build-lot.mjs
node check-lot.mjs highlands-ranch     # corners
node check-back.mjs highlands-ranch    # backs onto a road (also thornton, westminster, denver)
```

From a git worktree, point it at the main tree's data with `ROUNDS_DATA=<main>/traverse/app/data/rounds`,
`LOT_CACHE=<main>/traverse/data-pipeline/door-territory/security/cache` and `DT_DIR=<main>/traverse/data-pipeline/door-territory`
(the lawn cache's lot lines); `LOT_OUT=<folder>` writes the files (and the checks read them) somewhere else for a trial;
`BACK_DEBUG=<door id>,...` prints what each ray met. Re-run after a town is added or re-pulled, or a lot-line file is added;
TIGER publishes a new year each autumn.
