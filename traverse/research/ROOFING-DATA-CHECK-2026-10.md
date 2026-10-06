# Roofing data check — can the door card show hail, roof age and roof size?

**Prepared for Matthew, 2026-10-04.** Research only: nothing in the live app changed. Covers the 11 towns already loaded (El Paso, Teller and Douglas counties). Every claim is in the fact-check log at the end, with what was verified, what was measured here, and what is still open.

## Bottom line

| Door-card item | Can we get it? | Cost | Verdict |
|---|---|---|---|
| **Hail that hit this house** | Yes. A radar estimate of hail size, about every kilometre, every day, since 2020; plus ground reports since 1950 | Free | **Go.** Read and tested here against a real storm |
| **Roof age: year built** | Yes for El Paso and Douglas, free. Teller only by order form | Free (Teller: ask) | **Go** for El Paso and Douglas |
| **Roof age: last reroof** | El Paso + Monument + Palmer Lake + Woodland Park: yes, from PPRBD's permit files. Douglas: the assessor's "remodeled year" and roof material, free; permits by search only. Teller and Castle Rock: search one address at a time | $19.95 a month (PPRBD) | **Go** for the PPRBD towns; records requests for the rest |
| **Roof material** | Douglas County only (assessor file) | Free | Bonus for Douglas |
| **Roof size and pitch** | Likely, from the laser-scan data already held for El Paso and Douglas | Free | Not tested this round |

The hail data is the deciding piece, and it works. The radar estimate is narrower and smaller than what people report on the ground, so the card has to call it an estimate and rank streets, not promise a size on a roof.

## 1. Hail

### Three free government sources

| Source | What it is | Detail | How far back | Notes |
|---|---|---|---|---|
| **NOAA Storm Events Database** (NCEI) | Ground reports: spotters, the public, the weather service. One point per report, with the size | A point, rounded to about 1 km | 1950 to about three months ago | Bulk CSV per year. The 2026 file was compiled 18 Sep 2026 |
| **Radar hail detections** (NOAA SWDI, "nx3hail") | Each radar's hail algorithm: a point per storm cell per scan, with probability and a maximum size | A point every few minutes along a storm | Queried here for June 2024; the full range was not checked | Free web query by box and dates, no key. The Monument–Colorado Springs box returned 149 detections for 1–15 June 2024 |
| **Radar hail size, daily maximum** (MRMS "MESH", archived by Iowa State) | The largest hail the radar estimated at each spot in the last 24 hours | A grid square about 1.1 km across, the whole country | Complete from 2020 (present Jan and Jun 2020; patchy in late 2019; absent mid-2019) | About 1 MB per day. **This is the one to build on**: it covers every door, not just where someone happened to report |

### Measured here

**Ground reports, 2021 to mid-2026:** 397 hail reports in the three counties. El Paso had the most, with 145 in 2023 alone. 368 of the 397 were 1 inch or larger. **70% of our 30,464 doors (with a location) were within 2 km of at least one report.** Ground reports cluster where people live, so on their own they can't tell one street from the next.

**One storm, read door by door: 5 August 2023**, the biggest local hail day in the files (36 reports, up to 4 inches, mostly east and south-east Colorado Springs). The radar file was read with a short Node script; no extra software was needed. (Windows' application control blocked the usual weather-data library, and I didn't work around it.)

- **624 doors in Black Forest** sat under 1 inch or more on radar (largest 1.07 in). Every other town stayed under 1 inch (Monument's largest 0.49 in). That is exactly the "which neighbourhood got hit" answer a roofer wants the next morning.
- **Against the ground reports at the same spot**, the radar mostly read smaller: reports of 1.5–2 in where the radar said 0.6–1.1 in. Within about 15 km of each big report the radar did reach 2.2–2.3 in, so the storm is in the data; the reports' locations are rough and the radar under-reads the biggest stones.
- That matches the weather service's own research: reports are rounded to familiar objects and go missing where few people live, and radar estimates are uneven (Wendt and Jirak, 2021, below).

### What the card would show

Per door: the storms in the last few years where the radar estimate within about 1 km reached 1 inch or more, with the date and the size, labelled **"radar estimate"**. Plus a neighbourhood sort: **hit hardest, most recently**. The whole archive since 2020 is about 1,300 daily files (roughly 1.3 GB, downloaded once), then one file a day. How soon each day's file appears was not checked.

## 2. Roof age

| Area | Our towns | Year built | Last reroof | Roof material |
|---|---|---|---|---|
| **El Paso County + PPRBD** (Pikes Peak Regional Building Department: Colorado Springs, El Paso County, Monument, Palmer Lake, Woodland Park, and others) | Monument, Palmer Lake, Black Forest, Woodland Park | Assessor parcel file, free, weekly: `YrBlt` | PPRBD's permit files: tab-delimited, every permit, yearly archives 1990–2025, **premium subscription $19.95 a month**. PPRBD issued 16,139 reroof permits in 2024 | Not in the assessor file |
| **Douglas County** | Castle Rock, Franktown, Larkspur, Sedalia | Assessor files, free, monthly (updated 1 Oct 2026): `Built_Year` | Same file: `Remodeled_Year` (not necessarily the roof). The county's permit system holds 1.2 million records back to 1978, searchable but no bulk download found. **Castle Rock** issues its own permits (eTRAKiT portal), search only | **`Roof_Construction_Type` and `Roof_Material_Code`**, free |
| **Teller County** (outside Woodland Park) | Divide, Florissant, Cripple Creek | Assessor data by order form; one data reseller lists year built as almost empty for Teller | Permit search by address or permit number only; a monthly chart back to 1966 with no reroof category | Not found |

**Where there is no download, the right route is a records request** (Colorado Open Records Act) for "reroof permits issued since 2015, with address and date." I'd draft those for you; nothing goes out without your go-ahead. **I won't build anything that pulls the county search pages automatically.**

**Before paying PPRBD:** the file contents (address, permit type) could not be seen without a subscription. One month ($19.95) should be enough to download the yearly archives and check. That's your call; it costs money.

## 3. Roof size and pitch

The USGS laser-scan data already used for trees near the house covers El Paso (2018) and Douglas (2020); Teller has only the canopy map. The same points measure roofs: a footprint plus a pitch gives a rough roof area.

**Tested overnight 2026-10-04 (addendum):** measured for every door in the seven El Paso and Douglas towns with `roofs/sample-roofs.mjs`. 21,530 of 26,674 doors got a roof size and pitch (81%). Of the rest, 3,075 show no roof in the scan, and 98% of those were built in or after the scan year (checked against the county year built); 1,359 have no building outline; 449 have the roof hidden by trees. Against Douglas County's own records: 0.2% of the 7,729 gable and hip roofs read as flat, their median pitch is 5/12, and 10 of the 20 roofs the county lists as flat read as flat or low slope (several of the others measure 20–37°, so some county "flat" records look like sloped houses). Footprints match the county's building sizes (median ratio 1.04). The two measuring methods tried agree within 1/12 on 98% of houses. Median roof: about 30 squares. Still an estimate: eaves outside the outline are missed, and a re-roofed or rebuilt house since 2018/2020 may differ.

**Year built and roof material** (addendum): the free county files matched 98.6% of doors (`assessor/build-year.mjs`). Douglas adds roof shape and material: in Castle Rock, 6,382 composition shingle, 544 concrete tile, 37 wood shake, 23 clay tile.

## 4. Colorado's residential roofing law (C.R.S. 6-22-101 to 105)

From the statute text (2024 edition, current through fall 2025). Passed as SB12-038 in 2012. No later amendment turned up, but the full amendment history was not traced.

- **The contract must state:** scope and materials, approximate dates, approximate cost, the contractor's contact details, its surety and liability insurer, and a **72-hour cancellation** with a full refund of any deposit.
- **A second 72-hour cancellation** runs from when the homeowner hears the insurer has denied the claim in whole or part; money back within 10 days, less work actually done.
- **Payments are held in trust** until materials are delivered or most of the work is done (bold in the contract).
- **No paying, waiving or rebating the deductible, and no advertising or promising it.** The homeowner or the insurer can sue.
- **A roofer soliciting work may not act as a public adjuster**, but may discuss the scope with the insurer once there is a contract.
- Contracts of $1,000 or less are outside the law.

**For the app:** nothing a roofer's crew sends from it (booking texts, notes, any script) may hint at covering the deductible, and a roofing pipeline should track the two 72-hour windows. Local roofing licences (PPRBD requires one, per a permit-guide site) and town solicitation permits were not checked this round.

## Suggested next steps

1. **Build hail per door for the 11 towns** from the daily radar file, 2020 to now: storms at 1 inch or more within about 1 km, a "hit hardest, most recently" sort, labelled as an estimate. A few days' work. All free.
2. **Load Douglas County's assessor file** for year built, remodeled year and roof material (free), and El Paso's year built (free).
3. **You decide on one month of PPRBD** ($19.95) to check the permit files.
4. **Records requests** for Teller County, Castle Rock and Douglas County reroof permits: drafted, not sent.
5. Then roof size from the laser scans, and a roofing pipeline (inspection, claim, adjuster, approved, signed, installed) with the 72-hour windows.

## Fact-check log

**Verified at the source (first-party pages, read 2026-10-04)**
- NOAA Storm Events bulk files exist per year, 2020–2026; the 2026 file was compiled 2026-09-18. [ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/)
- SWDI nx3hail answers a free query by box and dates with columns ZTIME, WSR_ID, CELL_ID, PROB, SEVPROB, MAXSIZE, LAT, LON; 149 rows for the test box, 1–15 June 2024. [ncei.noaa.gov/swdiws](https://www.ncei.noaa.gov/swdiws/csv/nx3hail/20240601:20240615?bbox=-105.2,38.8,-104.6,39.4)
- Iowa State's MRMS archive has MESH_Max_1440min folders on 2020-01-15, 2020-06-01 and 2024-06-01; none on 2018-06-01 or 2019-06-01; 2 files on 2019-10-15. Files are GRIB2, 0.01°, 7000×3500, PNG packing (read here). [mtarchive.geol.iastate.edu](https://mtarchive.geol.iastate.edu/2024/06/01/mrms/ncep/MESH_Max_1440min/)
- PPRBD serves Colorado Springs, El Paso County, Fountain, Woodland Park, Manitou Springs, Monument, Green Mountain Falls, Palmer Lake and Calhan; tab-delimited permit reports including yearly archives 1990–2025 need a premium subscription; premium is $19.95 a month or $198.96 a year. [pprbd.org](https://www.pprbd.org/), [Reports](https://www.pprbd.org/Information/Reports), [Subscriptions](https://www.pprbd.org/Information/Subscriptions)
- El Paso County assessor parcel file: free, weekly; layout includes `YrBlt` and no roof fields. [assessor.elpasoco.com/assessordata](https://assessor.elpasoco.com/assessordata/), [layout PDF](https://epc-assets.elpasoco.com/wp-content/uploads/sites/4/Data/EPC-Parcel-Layout.pdf)
- Douglas County assessor downloads: Property Improvements file includes `Built_Year`, `Remodeled_Year`, `Roof_Construction_Type`, `Roof_Material_Code`; last updated 10/1/2026; active accounts only. [douglasco.gov](https://www.douglasco.gov/?p=127732)
- Douglas County: more than 1.2 million building permit records back to 1978 in Building Online Services; no download mentioned. [douglasco.gov](https://www.douglasco.gov/?p=122544)
- Teller County permit search: by address or permit number; charts back to 1966 with export, no reroof category. [tellercounty.gov](https://tellercounty.gov/Building-Permit-Contractor-Search), [charts](https://cdd.tellercounty.gov/permitweb/PublicAccess/Charts.aspx)
- C.R.S. 6-22-103, -104, -105 as summarised above, from the 2024 statutes (current through fall 2025) as published at [colorado.public.law](https://colorado.public.law/statutes/crs_6-22-103) ([-104](https://colorado.public.law/statutes/crs_6-22-104), [-105](https://colorado.public.law/statutes/crs_6-22-105)), a mirror of the official text.
- Wendt, N. A., and I. L. Jirak, 2021: *An Hourly Climatology of Operational MRMS MESH-Diagnosed Severe and Significant Hail with Comparisons to Storm Data Hail Reports.* Weather and Forecasting, April 2021 (NOAA Storm Prediction Center). Reports are estimated against reference objects, may be over- or under-estimated, and may be missing where population is low. [spc.noaa.gov](https://www.spc.noaa.gov/publications/wendt/meshwaf.pdf)

**Measured here (scripts in the session scratchpad; numbers from the files above)**
- 397 Storm Events hail reports in El Paso, Teller and Douglas, 2021 to mid-2026 (2026 is partial); 368 at 1 inch or more.
- 21,168 of 30,464 doors with a location (69.5%) within 2 km of a report; 19,774 (64.9%) within 2 km of a 1-inch-plus report.
- 5 Aug 2023 radar file (24 hours to 12:00 UTC on 6 Aug): 624 Black Forest doors at 1 in or more, largest 1.07 in; the largest value within about 15 km of the big reports was 2.2–2.3 in; the largest anywhere in the country was 82.2 mm (3.24 in).

**From a named outlet, not first-party**
- PPRBD issued 16,139 reroof permits in 2024, 9% fewer than 2023. [Colorado Public Radio, 2025-01-14](https://www.cpr.org/2025/01/14/pikes-peak-region-building-permits-residential-construction-2024/)

**Unresolved**
- What PPRBD's permit files actually contain (address, permit type) — needs the subscription.
- How soon each day's radar file appears in the archive; the full date range of the SWDI hail query.
- What the radar file's two "no value" codes mean exactly (−1 and −3); both are treated as no hail estimate.
- Whether Larkspur and Cripple Creek issue their own permits; Teller's assessor data cost and contents.
- PPRBD's roofing-licence requirement (from a permit-guide site, permitmint.com) and town solicitation permits: not checked at the source.
- Whether 6-22 has been amended since 2012: none found, history not fully traced.
- **Corrected along the way:** a search summary said Douglas County's assessor data was last updated 7/1/2026; the county's own page says 10/1/2026. The first-party page is used.

## Addendum 2026-10-05: sharper roof photos, and what El Paso's would cost

**In the app now (free):** the Denver Regional Aerial Photography Project's 2020 photos at 3 inches a pixel, published by the State of Colorado on AWS Open Data (public domain), read in the browser straight from the state's bucket. Covers all of Castle Rock and most of Franktown and Sedalia (8,503 doors). Not Larkspur, not El Paso, not Teller. The 2022 photos are in the same bucket but stored one pixel row at a time, too slow to read on a phone. The rest of the bucket is the statewide farm photos (NAIP, 60 cm) and a 2015 Trinidad set. Colorado's statewide 6-inch Vexcel photos are licensed to state and local governments only.

**El Paso County's 2024 photos** (6-inch and 1-foot, licensed per 4,000 ft tile for three years: 6-inch $100, 1-foot $50, per the county's licensed-data page). Counted with `operations/door-territory/elpaso-imagery/count-tiles.mjs` against the county's open "Aerial Delivery Tiles" grid (3,900 tiles): our 16,801 El Paso doors fall in **199 tiles** (Monument 61, Palmer Lake 14, Black Forest 130; some shared).

| Coverage | Tiles | At 6-inch | At 1-foot |
|---|---|---|---|
| Every El Paso door | 199 | $19,900 | $9,950 |
| 90% of doors | 99 | $9,900 | $4,950 |
| 75% of doors | 53 | $5,300 | $2,650 |
| 50% of doors | 24 | $2,400 | $1,200 |

Open before buying: the grid's RESOLUTION field reads the same for every tile, so which tiles come at 6-inch is unconfirmed; the county page does not say whether the licence allows showing the photos to field staff in a web app, or use by a product sold to other companies (the licence would be in whose name?); and the photos arrive as files, so we would have to cut and host map tiles ourselves. 1-foot shows roof shapes but not shingle detail; the Douglas photos in the app are 3-inch.
