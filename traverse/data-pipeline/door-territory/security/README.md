# Security edition data

Two builds write the Security edition's per-door side files into `traverse/app/data/rounds/` (gitignored):

- `build-security.mjs` (2026-10-06): crime counts near the door (Colorado Springs, Denver and Boulder police; area counts only,
  never a location), the town figures (FBI), owner lives elsewhere, sale month and year built. Writes `security-<town>.json`,
  `security-areas.json`, `security-rates.json`. See the header of the script.
- `build-lot.mjs` (2026-10-29): **lot facts**, plain physical facts about the lot. Writes `security-lot-<town>.json`.

Both file names start with `security-`, which every other edition's `keep()` in `editions/build-editions.cjs` already drops
(except the town Security-Widefield's own files), so the lot facts reach the Security edition only and never Sixfold.

## Lot facts (build-lot.mjs)

Per door, when true: `c` corner lot [own street, cross street]; `bk` a named road behind the lot; `al` an alley behind (`b`) or
beside (`s`), `ad` = 1 when that alley is from Denver's own map; `tr` a walkway, trail or bike path along the side or back;
`de` metres to where the house's own street dead-ends; `nn` metres to the nearest other home's point; `os` open space within 90 m
and `wa` a named creek or pond nearby (copied from the pest build). No score, no label about people or risk.

The card shows them under "The lot" in the security block (`secLotLines` in index.html); the nearest home only when 40 m or more.
Doors filters: Corner lot, Backs onto open space, Alley behind, Dead end or cul-de-sac.

### Sources and terms

| Source | What | Terms (checked 2026-10-29) |
|---|---|---|
| U.S. Census Bureau, TIGER/Line Shapefiles 2026, All Roads by county (`www2.census.gov/geo/tiger/TIGER2026/ROADS/tl_2026_08xxx_roads.zip`, files dated 2026-10-06, metadata 2026-09) | street centre lines, names (FULLNAME) and class (MTFCC); road classes from the 2026 MAF/TIGER Feature Class Codes (S1730 alley, S1710 walkway, S1820 bike path) | The files' own metadata: "not copyrighted ... free to use in a product or publication, however acknowledgement must be given to the U.S. Census Bureau as the source"; TIGER/Line is a Census trademark; no warranty. The card says "U.S. Census Bureau street map (2026)". |
| City and County of Denver, Alleys (ArcGIS item c8644edb9f414bd8a438fc55f6bdcd7a, `ODC_PWTRN_TRN_ALLEY_L` layer 116) | alley centre lines in Denver (TIGER has 45 in all of Denver County) | The item's terms: as is, no warranty, the user holds the city harmless, not for engineering; no limit on use. Same publisher and terms as the Denver crime layer already used. Credited on the card ("Alley: City and County of Denver") when the alley came from it. |
| Door files (county parcel centre and acres), `others-<town>.json` (homes not on the door list) | the house point, lot size, every home's point for the nearest-home distance | built earlier from the county and state parcel data |
| `pest-<town>.json` | open space (COMaP, state, 2026-07-17) and water (USGS NHD) | see `../pest/` |

OpenStreetMap was not used (its ODbL licence would add share-alike and attribution duties).
gis.colorado.gov was not called; the check below uses lot lines already cached on disk.

### How each fact is decided

The house point is the parcel's centre. Its own street is the nearest road whose name matches the address (whole name, then the
core name without direction and type, then without a trailing town or unit word, then the same first word within 60 m): found for
94.9% of doors. From the distance to the own street and the acres, the lot's depth and width are estimated. Then:

- **corner**: another named street (S1200, S1400, S1640) within half the lot's width + 13 m, not straight behind, and meeting the
  own street (crossing or ending on it) within the lot's half-diagonal + 18 m of the house point.
- **road behind**: a named road within half the depth + 14 m, at 140 degrees or more from the own street, that does not meet the
  own street near the lot.
- **alley**: S1730 (or Denver's alleys) within the same distances minus 4 m, behind (120 degrees or more) or beside.
- **dead end**: an end of a line of the own street that no other drivable road touches, within half the lot + 45 m.
- **nearest home**: the closest other home point at least 3 m away (units of one building share a point).
- A town home carries its whole complex's acres (Thornton's read 1 acre with neighbours 7 m away): when the acres would make a lot
  far wider than the spacing of the homes, the spacing is used.

### Checks (2026-10-29)

`check-lot.mjs <town>` compares the corner and road-behind facts with real lot lines: the state parcel polygons already cached for
the lawn work (`lawn-trial/drcog-turf/parcels-<town>.json`). For each door, the parcel holding its point; along the lot line every
2 m, the named streets within 13 m; a corner is two such streets that meet within 22 m of the lot line.

| Town | corner: precision / recall | road behind: precision / recall |
|---|---|---|
| Highlands Ranch | 87.4% / 69.9% | 52.7% / 49.6% |
| Thornton | 87.3% / 77.1% | 58.0% / 48.3% |
| Westminster | 88.2% / 73.5% | 53.2% / 46.0% |

Most road-behind "misses" are parkways behind a strip of HOA land: the lot line does not touch the road (so the check says no),
though the house does back onto it. Alleys: Denver's old-grid neighbourhoods 75-90% of doors (Park Hill, Highland), postwar and
newer ones 0-6% (Harvey Park, Southmoor Park, Green Valley Ranch). Dead ends: 45-59% of "Ct" addresses in the suburbs against
about 5% of "St".

### Coverage (2026-10-29, 180 Colorado towns, 1,093,827 Security doors)

corner 155,493 (14.2%) · road behind 32,288 (3.0%) · alley 64,967 (5.9%; 57,791 from Denver's map) · path or trail 1,397 (0.1%) ·
dead end 135,883 (12.4%) · nearest home 40 m or more 71,637 (6.5%) · open space 176,878 (16.2%) · water 127,255 (11.6%) ·
at least one of these 572,722 (52.4%).

### Running it

```
# once: the county road files (about 90 MB) into cache/tiger/, and Denver's alleys
cd cache/tiger && for c in $(seq 1 2 125) 14; do f=$(printf "tl_2026_08%03d_roads.zip" $c); curl -sfO "https://www2.census.gov/geo/tiger/TIGER2026/ROADS/$f"; done
node fetch-denver-alleys.mjs
# every Colorado town (about 1 minute); or name towns; --debug lists unmatched street names and writes nothing
node --max-old-space-size=12000 build-lot.mjs
node check-lot.mjs highlands-ranch
```

From a git worktree, point it at the main tree's data with `ROUNDS_DATA=<main>/traverse/app/data/rounds` and
`LOT_CACHE=<main>/traverse/data-pipeline/door-territory/security/cache` (and `DT_DIR=<main>/traverse/data-pipeline/door-territory`
for check-lot). Re-run after a town is added or re-pulled; TIGER publishes a new year each autumn.
