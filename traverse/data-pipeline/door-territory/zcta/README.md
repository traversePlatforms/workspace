# ZIP search in the town list (TR-47, 31 Oct 2026)

The search box above the town list takes a town, a neighbourhood or a 5-digit ZIP. For a ZIP, the page lists the neighbourhoods whose centre is
within the ZIP's rough radius (plus 0.75 mi) of the ZIP's middle, closest first, and the towns they belong to. It is a "near this ZIP" list: it
never says a house is in a ZIP.

## Source

- **U.S. Census Bureau, 2026 Gazetteer Files, ZIP Code Tabulation Areas (ZCTAs)**:
  https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip
  (listed on https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html, fetched 2026-10-31).
- Fields used: GEOID (the ZCTA), INTPTLAT / INTPTLONG (its internal point), ALAND_SQMI + AWATER_SQMI (its area, turned into a radius).
- Licence: a work of the U.S. federal government, not subject to copyright in the United States (17 U.S.C. 105). Credit line if one is
  shown: "Source: U.S. Census Bureau, 2026 Gazetteer Files." (The census.gov terms pages render with script and could not be read as
  text from here; the public-domain status is the federal-works rule, not a page quote.)
- ZCTAs are the Census Bureau's areas built from 2020 census blocks to match USPS ZIP delivery areas; they are close to, not the same as,
  the ZIP codes the post office uses. 527 Colorado ZCTAs (800xx-816xx) in the 2026 file.

## Build

```
curl -o gaz.zip https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip
unzip gaz.zip
node traverse/data-pipeline/door-territory/zcta/build-zcta.mjs 2026_Gaz_zcta_national.txt
```

It writes `var TR_ZIP = { CO: '...' }` into `traverse/app/summit-de59ae83/index.html` between `/* zcta:start */` and `/* zcta:end */`
(about 14 KB). A market in another state adds its ZIP range to `STATES` in the script. Run it again when a new Gazetteer year comes out
(ZCTAs change only with a new census).
