# The best Colorado towns for each edition (proposal, 2026-10-07)

**For:** Matthew. Each edition keeps its current towns and gains three of its own (his call, 2026-10-07). TraverseYards already
gets Highlands Ranch, Parker and Castle Pines (the lawn towns being built now; every edition has them).

How these were picked:
- A table of every Colorado place with 1,500+ owner-occupied homes, 109 in all:
  `data-pipeline/door-territory/research-editions/rank.mjs` builds it into `places-ranked.json`.
- Each trade was then ranked on what makes doors sell for it.
- Data comes from the county parcel records (checked per county) and, for Security, the police's own published crime reports.

## Roofing: where the hail falls

| Town | Owner homes | Hail days 1 in+ within 5 mi, since Oct 2021 | Days 1.75 in+ | County data |
|---|---|---|---|---|
| **Colorado Springs, east side** | 123,264 (whole city) | 21 | 7 | El Paso builder |
| **Security-Widefield** | 11,674 | 21 | 3 | El Paso builder |
| **Fountain** | 7,612 | 17 | 2 | El Paso builder |
| *for comparison:* Highlands Ranch | 30,106 | 11 | 0 | |
| *for comparison:* Aurora | 90,683 | 6 | 3 | |
| *for comparison:* Denver | 163,555 | 5 | 4 | |

The Pikes Peak region gets more than three times the big-hail days of the Denver suburbs. Colorado Springs is too big to take
whole, about 100,000 doors, so the pick is the east side, where the radar shows the most hail. The boundary will come from
the radar hail record, which the app already uses.

## Solar: large markets of owned houses, newer roofs, good values

| Town | Owner homes | Detached | Median value | Median income | Median year built | County data |
|---|---|---|---|---|---|---|
| **Arvada** | 37,573 | 70% | $632,600 | $117,348 | 1979 | ready |
| **Centennial** | 34,030 | 73% | $658,100 | $131,928 | 1983 | lot size from shape |
| **Thornton** | 36,109 | 62% | $517,500 | $103,088 | 1997 | ready |

- All three are covered by the 2020 Denver-area laser scan, which gives sun-facing roof, shade, panels and output.
- The power company per door comes from the state utility map in the build.
- Denver, Colorado Springs and Aurora are bigger again, but each is a city of 90,000+ owner homes. A neighbourhood pick inside
  them is a later step.

## Pest: the newest suburbs beside open space and water

| Town | Owner homes | Detached | Median year built | Median value | County data |
|---|---|---|---|---|---|
| **Windsor** | 11,553 | 80% | 2009 | $604,000 | ready (Weld) |
| **Erie** | 10,295 | 84% | 2008 | $736,500 | ready (Weld) |
| **Commerce City** | 17,300 | 79% | 2005 | $499,500 | ready (Adams) |

These are new subdivisions on former farmland, edged with lakes, ditches and open space: the "backs onto open space" and
"water nearby" lines the Pest card shows.

## Security: towns where the police publish their crime reports

A door can only carry crime counts within 1 mile where the police publish individual reports with locations.

| Town | Owner homes | Median value | Crime reports published? |
|---|---|---|---|
| **Denver** (detached-home neighbourhoods) | 163,555 (whole city) | $616,000 | **Yes**: the city's open data, 382,595 offences, daily, latest 6 Oct 2026, each with a location and neighbourhood |
| **Colorado Springs** (the rest of the city) | 123,264 | $452,600 | **Yes**: already used; today only its Briargate side is in the app |
| **Boulder** | 20,977 | $1,040,000 | A downloadable crime file is reported (Esri dashboard); feed not yet checked |

- Not picked:
  - **Aurora:** a crime dashboard, but no confirmed download.
  - **Lakewood:** PDF reports only.
  - **Fort Collins:** only third-party summaries found.
- Denver and Colorado Springs are too big to take whole. The pick inside each is its detached-home neighbourhoods, where
  security systems sell.

## What it costs

- Each edition only needs its own layers:
  - Roofing: hail, wind, roofs and photos.
  - Solar: the laser scan.
  - Pest: open space and water.
  - Security: crime and new owners.
- Lawn sizing, the slow step, is for Yards and Sixfold only.
- Denver, Arapahoe (Centennial) and Larimer records lack a lot-size field, so the door-list builder computes it from the
  parcel shape. That is a small change.
- El Paso towns use the El Paso builder.

## Fact-check log

**Verified:**
- ACS 2020-2024 five-year figures via Census Reporter (api.censusreporter.org, release acs2024_5yr), pulled 2026-10-07.
- Place centres: Census TIGERweb (Incorporated Places and Census Designated Places layers).
- Hail: NWS Local Storm Reports via the Iowa Environmental Mesonet. These are the wind build's cached CSVs, reports of 1 in+
  since 1 Oct 2021 within 5 miles of each place's centre. Reports follow people, so this compares towns with towns.
- County parcel fields: `build-walklist-co.mjs --coverage` on 1,000-parcel samples, 2026-10-07.
- Denver crime feed: ArcGIS service ODC_CRIME_OFFENSES_P layer 324 (services1.arcgis.com/zdB7qR0BtYrg0Xpl). 382,595 rows,
  max REPORTED_DATE 2026-10-06, fields include GEO_LAT, GEO_LON, OFFENSE_CATEGORY_ID and NEIGHBORHOOD_ID.

**Unresolved:**
- Boulder's crime download, which is reported but not yet tested.
- Aurora's portal download.
- Fort Collins.
- Each Solar town's power company and its current rebate or net-metering terms. These come from the state utility map per
  door, but the programs themselves have not been checked.
