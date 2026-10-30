# Building permits per door

Builds `traverse/app/data/rounds/permit-<town>.json` (one per covered town) and `permit-index.json`: for each door, the latest
month of each kind of permit the town's building department records. Facts only: kind, month, department.

```
node fetch-pprbd.mjs; node fetch-douglas.mjs; node fetch-centennial.mjs; node fetch-open.mjs   # the feeds
python -I convert-thornton.py; python -I convert-parker.py                                     # the records-request files in raw/
node build-permits.mjs                                                                         # the per-town files
```
From a git worktree, set `TRAVERSE_MAIN=<main repo root>` so the scripts read and write the main tree's data.
Monthly refresh (re-fetch, rebuild, safety checks, upload): `traverse/ops/refresh-permits.sh` (scheduled by Windows Task Scheduler,
"Traverse permit refresh", 1st of the month).

## Door keys

| key | kind | shown in |
|---|---|---|
| r, m | latest re-roof month, roof material named on it | Roofing, Solar |
| s, so | solar permit month, panels removed after it | Roofing, Solar |
| n | new building (a new house where the source says so; Denver's "New Building" can be a garage) | Pest, Security |
| a | addition | Pest, Security |
| pl | pool | Yards, Pest, Security |
| f | fence | Yards, Pest, Security |
| d | deck or patio cover | Yards |
| ir, ld | irrigation, landscaping (from descriptions; almost never filed) | Yards |

`permit-index.json[town] = { src, since, through, full, kinds }`. `kinds` = what that source records at all; the card says
"no re-roof permit since ..." only where `roof` is in kinds and `full` is true. `full: false` = the town's door list reaches past the
department's area (or the feed is a rolling window), so a missing permit proves nothing.

Each edition gets only its own kinds: `build-editions.cjs` `permitKinds` + `permitPack()` filter the door keys and the index, and the
API (`rounds.php` `permitRow()` / `permitCover()`) filters again by the company's trade. Sixfold never receives permits.

## Sources and licences (checked 2026-10-29)

| Source | Towns | Match | Kinds | Licence |
|---|---|---|---|---|
| Pikes Peak Regional Building Dept, public permit map service (maps.pprbd.org Permits_Full_B/E_WM), 2016 on | El Paso towns, Woodland Park | parcel | all | Free public service, no reuse terms stated (checked 2026-10-07); bulk reports are sold separately |
| Douglas County open data, All_Permits_View, 2016 on | Highlands Ranch, Sedalia, Franktown, Larkspur | address | roof, solar, new, add, pool, fence, deck | County open data guidelines (douglasco.gov/documents/open-data-guidelines.pdf): published data sets are "available without registration or license requirements or use restrictions"; users may be asked to name the source and version and describe changes. The layer's own item states no licence |
| City of Thornton permit report (records request), 2016 on | Thornton | address | roof, solar, new, add, deck | Public record supplied to Matthew |
| Town of Parker monthly reports (records request), 2023 on | Parker | parcel | roof, solar | Public record supplied to Matthew |
| City of Centennial public permit search (EnerGov), 2018 on | Centennial | address | roof, solar | City's public search, as the city directed |
| City and County of Denver, Residential Construction Permits (ODC_DEV_RESIDENTIALCONSTPERMIT_P), 2016 on | Denver, South Denver | parcel (SCHEDNUM) | new, add (Denver publishes no re-roof or solar layer) | CC BY 3.0. Credit: "City of Denver Open Data Catalog" (opendata-geospatialdenver.hub.arcgis.com, License section) |
| City of Aurora, Building Permits (ags.auroragov.org OpenData MapServer/44), Oct 2021 on (rolling) | Aurora | address | roof, solar, new, add, pool, fence, deck | Aurora open data site (data-auroraco.opendata.arcgis.com) states CC-BY-SA; the layer's item adds the city's download disclaimer (no warranty, indemnity), with no limit on use. Share-alike: flag before any resale of the derived file |
| City of Boulder, Construction Permits (open-data.bouldercolorado.gov), 2016 on | Boulder | parcel (BOCOPIN) | roof, solar, new, add, pool, fence, deck | CC0 1.0 |
| City of Longmont permits, published by Boulder County (maps.bouldercounty.org PLANNING/LONGMONT_Permits), Nov 2024 on (rolling) | Longmont | parcel | roof (from descriptions), solar, new, add, fence, deck | CC BY 4.0 (ArcGIS item 65b6bac40b734abeb7d5d76de9751df9) |

Looked at and left out (2026-10-29):
- Adams County (Building_Permits_Eye_On_Adams): good data, no licence (unlisted app layer, disclaimer only). Ask the county.
- Castle Rock (PermitsThrough2025_CSV_Geocoded): a staff dashboard upload, no licence, not live. Ask the town.
- Westminster (Permitting/SolarPermits): solar only, no licence found.
- Boulder County unincorporated (OP_Accela_Point): no licence on the item, and building intake stops in May 2026.
- Fort Collins (Building_Permits): only ~2,000 current permits, and the city's GIS terms say "for its internal purposes only, and
  were not designed or intended for general use by members of the public": unclear, out.
- Lakewood, Arvada, Loveland, Greeley, Broomfield, Pueblo, Grand Junction / Mesa County, Jefferson, Arapahoe, Larimer, Weld,
  Commerce City, Littleton, Englewood, Erie, Windsor, Brighton, Northglenn, Wheat Ridge, Golden, Louisville, Lafayette: lookup
  portals only (eTRAKiT, Accela, EnerGov) or monthly PDFs; no open permit data.

No names are read: contractor, applicant, owner and contact fields are never requested.
