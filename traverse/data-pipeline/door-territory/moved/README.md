# New movers and house facts (29 Oct 2026)

Matthew approved both for the editions only (Sixfold unchanged):

- **New movers, all five editions.** Each door card gets a "Last sale on record" line: *Sold Aug 2026*, with
  *Records: Arapahoe County, as of Oct 2026*. A sale in the last 12 months adds "New owner", a *Sold Aug 2026* tag on the door
  row, and the door passes the new **Sold in the last 12 months** filter under Sort & filter. Pest and Security also count the
  newer of this month and El Paso's old `sold` month in their "Why knock" line and their best-doors points.
- **House facts, Pest edition.** Beside the open-space and water lines: basement square feet (finished part, walk-out where
  recorded), or *No basement on the county record*, crawl space or slab where the county records the foundation, stories, the
  walls in plain words, and year built where the pest file has none. Each with its county and date.

Facts only. Nothing here predicts anything about a house.

## Files

| | |
|---|---|
| `fetch-arcgis.mjs` | Pulls the counties that publish through their own ArcGIS services (Denver, Jefferson, Arapahoe, Broomfield, Mesa, Elbert) into `assessor/raw/<county>/*.json`. Asks only for parcel number, sale date/price/deed type and building fields: never an owner, grantor, grantee or mailing field. |
| `build-moved.mjs` | Reads every county's files, matches doors to parcels through `<town>.csv` (address -> parcel, as `year-<town>.json` does) and writes `app/data/rounds/moved-<town>.json` and `house-<town>.json`, plus `coverage.json` (counts only). |
| `coverage.json` | Doors with a sale month and with basement facts, by county and by town. |

Run from a worktree with the data in the main checkout:

```
TRAVERSE_ROOT="/c/Users/Surge Inc/Desktop/claude test 2/traverse" node fetch-arcgis.mjs            # about 10 minutes
TRAVERSE_ROOT="/c/Users/Surge Inc/Desktop/claude test 2/traverse" node --max-old-space-size=8192 build-moved.mjs   # about 1 minute
```

`--only=town,town` and `--counties=denver,jefferson` narrow a run. Dropping a county is `--counties=` without it.

Output shapes:

- `moved-<town>.json`: `{ built, counties: { key: [name, sales as of, building facts as of] }, doors: { id: 'YYYY-MM|key' } }`
- `house-<town>.json`: `{ built, counties, doors: { id: { c, yb?, bs?, bf?, wo?, cr?, sl?, st?, ex? } } }`. `bs` 0 means the county
  records no basement; no `bs` means the county does not say. `st` is 1, 1.5, 2, 2.5, 3, `'split'` or `'bi'`.

Owner names never leave the raw files. Where a county's sale record names both parties, they are compared in memory
(`owner-names.mjs` `isSale`) and dropped; nothing with a name is written.

## Which sale counts

The most recent **market sale**: a sale deed (warranty, special warranty, general warranty, bargain and sale, personal
representative's, administrator's, conservator's, plain "deed") for **$1,000 or more**. Skipped:

- quit claims, death certificates and affidavits, public trustee's (foreclosure), treasurer's and sheriff's deeds, corrections and
  re-recordings, mergers, plats, mineral deeds, contracts, bills of sale, mobile home titles;
- sales the county itself codes as non-market: Jefferson's *related parties*, *non-arm's-length*, *part interest*, *ownership form*,
  *transfer to a financial institution*, *government entity*, *trade*; El Paso's *related parties*, *trade or exchange*, *cannot
  verify*; Mesa's unqualified (`U*`) sales;
- where both names are on the record (Douglas, Adams, Weld, Larimer): a buyer who shares a name with the seller (a spouse added, a
  move into a family trust);
- a date after the current month (a typing slip: Denver had one in 2026-12, El Paso one in 2028-08).

Arapahoe, Elbert and Broomfield's layers give no grantor/grantee, and Arapahoe and Elbert give no deed type: there it is the price
rule alone. Denver's file starts in 2010, so a Denver house unsold since then has no line.

## Sources, licence, date

| County | Source (first-party) | Licence / terms | As of |
|---|---|---|---|
| Denver | City and County of Denver open data: *Real Property Sales and Transfers* (layer 51) and *Real Property Residential Characteristics* (layer 50), services1.arcgis.com/zdB7qR0BtYrg0Xpl | Item "USE CONSTRAINTS": as-is disclaimer, no use restriction; credit "The City and County of Denver" | layer edited 29 Oct 2026 |
| Jefferson | Jefferson County parcel layer, gisportal.jeffco.us/server2/rest/services/Parcel/MapServer/20 | **CC BY 4.0** (item licence); credit "Jefferson County CO" | read 29 Oct 2026 (sales to Sep 2026) |
| Arapahoe | The parcel layer the county publishes for its open data site, gis.arapahoegov.com/arcgis/rest/services/OpenDataService/MapServer/0 | **No licence text** on the service or found on the county site; published "for use in esri's online OpenData service" | read 29 Oct 2026 |
| Broomfield | City and County of Broomfield open data *Parcels*, services1.arcgis.com/vXSRPZbyyOmH9pek | Disclaimer only ("use ... is the sole responsibility of the user"); no restriction | edited 29 Oct 2026 |
| Mesa | Mesa County GIS *Open_Data* MapServer layer 55 (Tax Parcels), mcgis.mesacounty.us | "distributes GIS data sets as a service to the public"; asks non-commercial users to share back. No commercial restriction | read 29 Oct 2026 |
| Elbert | Elbert County *Tax Parcels*, maps.elbertcounty-co.gov | No licence text found | read 29 Oct 2026 |
| El Paso | Assessor's weekly *EPC Parcel Data.txt*, assessor.elpasoco.com/assessordata (already used for year built) | Public download, disclaimer only | 29 Sep 2026 (`LastUpdate`) |
| Douglas | Assessor data downloads, `Property_Sales.txt` (new) + `Property_Location.txt`, `Property_Improvements.txt`, douglasco.gov/assessor/data-downloads | No licence named; disclaimer only; "Copyright 2026 Douglas County Government" | "Last Updated 10/1/2026" |
| Adams | Assessor data dump: `Admin_2026_2.zip` `Sales.TXT` (new; layout `Admin_FileLayout.doc`), `Appraisal_2026_2.zip` `Built_As.TXT` and `Detail.TXT` (basement rows) | Disclaimer only ("no representations or warranty"), no restriction | **4 May 2026** (bi-annual; next after 1 Jan 2027) |
| Weld | Assessor `all.zip`: `Sales.csv`, `AcctCurrentInvntry.csv`, `ImpsCurrentInvntry.csv` | Public download (already used for year built) | 6 Oct 2026 |
| Boulder | Assessor data download: `Sales.csv` (no names in it), `Account_Parcels.csv`, `Buildings.csv`, assessor.boco.solutions | Page says the data was "developed solely for internal use only by Boulder County" and is used "at the risk of user"; no licence named. (Boulder County's open data portal itself is CC BY 4.0.) | refreshed daily; read 29 Oct 2026 |
| Larimer | Assessor Public Data Center: `assessor-public-sales.csv`, `assessor-public-improvement.csv`, larimer.gov/assessor/publicdata | Free public bulk data ("available 24/7 and free to the public"), disclaimer only | sales 28 Oct 2026; buildings **24 Aug 2026** (`RUNDATE`) |

**Licence flag for Matthew:** Denver, Broomfield and Mesa state their terms; Jefferson is CC BY 4.0. The rest (Arapahoe, Elbert,
El Paso, Douglas, Adams, Weld, Boulder, Larimer) publish the files free to the public with a disclaimer and **no named licence** -
the same footing as the year-built and roof-material files the editions already carry from El Paso, Douglas, Adams, Weld and
Boulder. Boulder's "internal use" wording is the weakest. Any county can be left out with `--counties=`.

## Not done

| County (towns) | Doors | Source | Blocker |
|---|---|---|---|
| Pueblo (15 Group 2 towns) | ~41,000 | The assessor's search runs on a vendor site; no bulk download or open parcel service with sales found tonight | Statewide parcel layer (below) once allowed, or ask the assessor for a bulk file |
| Teller (Woodland Park, Divide, Florissant, Cripple Creek) | ~3,800 | No open parcel or assessor download found | Same |
| Clear Creek (Idaho Springs) | 84 | Not looked at in depth | Same |
| Arapahoe house facts | ~144,000 | Basement and year built sit only in the assessor's internal CAMA map service (CustomCAMA_WM), not published for download | Not used: not published as open data |
| Douglas basement | ~102,000 | `Property_Improvements.txt` has basement-looking columns but the county publishes no layout | Left out until a layout or a checked sample confirms them (walls, style and year built are used) |
| Mesa, Elbert basement | | Their layers carry style and year built only | |

**Statewide parcel layer (gis.colorado.gov, not called: Group 3 job running until `g3b.done`).** OIT's *Colorado Public Parcels*
composite standardises each county's sharing into one schema; its field list (seen in search-engine listings, not fetched) includes
a *Date of Last Sale* and *Price of Last Sale*, both strings, and no deed type. Coverage depends on what each county shares.
It is the candidate for Pueblo and Teller later; it cannot apply the deed-type rule.

## Coverage (29 Oct 2026 build; 160 Colorado towns, 1,048,676 doors)

837,348 doors (79.8%) have a sale month; 755,212 have basement, crawl space or slab facts (567,564 with a basement on record).
Every edition carries the same towns, so the figures are the same in each; house facts reach Pest only.

| County | Sale month | Sold in last 12 mo | Basement facts | With a basement |
|---|---:|---:|---:|---:|
| Jefferson | 134,188 | 5,481 | 149,421 | 113,476 |
| Douglas | 101,621 | 5,376 | (walls, stories, year only) | |
| Adams | 92,864 | 2,654 | 101,971 | 72,920 |
| Arapahoe | 91,575 | 4,606 | none published | |
| El Paso | 82,551 | 5,820 | 129,911 | 104,225 |
| Larimer | 80,177 | 3,864 | 82,561 | 58,340 |
| Weld | 72,633 | 3,422 | 75,001 | 57,911 |
| Denver | 69,048 (sales since 2010) | 5,118 | 131,246 | 92,492 |
| Boulder | 65,267 | 2,522 | 66,791 | 53,208 |
| Mesa | 33,115 | 1,604 | (style, year only) | |
| Broomfield | 13,604 | 735 | 18,310 | 14,992 |
| Elbert | 705 | 41 | (style, year only) | |

A town over two counties counts each door under the county that matched it.
