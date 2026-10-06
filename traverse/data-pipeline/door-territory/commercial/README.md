# Commercial roofing test: three storm spots (2026-10-05)

Matthew asked: run the residential system on **apartments, commercial and industrial** buildings in the three Colorado
spots with the most hail and wind damage, get as close as public records allow to **the person behind the owner**, add
the roofing layers, and show what it turns up. Test only. In the app since 2026-10-05 as admin-only towns (com-springs, com-south, com-west) plus a "Commercial showcase" town, built by build-app-data.mjs; see DEPLOY-ROUNDS.

**The review page is `out/COMMERCIAL-TEST.html`.** `out/` is gitignored because it holds owner and agent names. Never
publish it as an artifact and never upload it.

## Run order

```
node pull-parcels.mjs           out/parcels-<spot>.json    buildings + owner of record
node fetch-footprints.mjs       out/footprints-<spot>.json roof outlines (Fable built this; notes in out/footprints-README.md)
node hail-fetch-denver.mjs fetch                           radar hail for the Denver box (Springs reuses ../hail/days)
node resolve-owners.mjs         out/owners.json            Colorado SoS register match + agent counts (cached in out/sos-cache.json)
node enrich.mjs                 out/commercial-<spot>.json roof size, hail, wind, 2023 photo, lead tier
node build-report.mjs           out/COMMERCIAL-TEST.html
```

## The spots, and why

Counted from NWS Local Storm Reports 2020-2025 (the `../wind/cache` CSVs): days of 1-inch-plus hail and of damaging wind
around 27 Colorado cities, then the densest 6 km point inside each area.

| Spot | Centre | Why |
|---|---|---|
| Colorado Springs east | 38.850, -104.725, 4 km | Most hail in the state: 24 days of 1-inch-plus hail within 6 km |
| South metro (Centennial / Englewood) | 39.585, -104.905, 4 km | 19 hail days within 15 km of Centennial, 15 wind-damage days |
| West Denver / Lakewood | 39.720, -105.040, 4 km | 5 days of 1.75-inch-plus within 15 km of Lakewood, 16 wind-damage days, largest stock |

Sterling, Limon and Lamar rank high for hail but have little commercial stock, and Logan County publishes no land use.

## Results (2026-10-05)

| | Springs | South | West | All |
|---|---:|---:|---:|---:|
| Buildings | 1,203 | 822 | 3,057 | 5,082 |
| Tier 1 · person on the deed | 214 | 9 | 540 | 763 |
| Tier 2 · probable owner (person agent, or c/o a person) | 433 | 175 | 998 | 1,606 |
| Tier 3 · a company or trust to call | 181 | 110 | 356 | 647 |
| Tier 4 · mailing address only | 372 | 521 | 969 | 1,862 |
| Tier 5 · public owner | 3 | 7 | 194 | 204 |
| Roof 20,000 sq ft+ and 1-inch-plus hail since 2023 | 203 | 290 | 297 | 790 |
| ...of those with a tier 1-2 name | 64 | 29 | 67 | 160 |

(Revised the same day: blank owners are tier 4, not tier 1, and long "person" names that match a registered company word for word, or
carry a business word, are filed as companies.)

**The finding:** about half of all buildings reach a named person with no manual searching, but the big roofs mostly don't.
Large buildings sit behind registered-agent services and out-of-state owners, so only about 1 in 5 of the big, recently hailed
roofs has a name. Those need the next step (property manager, the register's filing history, or a call).

## Rules that matter

- **Condo units are left out**: the association owns the roof. Churches, schools and exempt owners are left out.
- **A registered agent who is a person and acts for fewer than 25 Colorado companies is tier 2, "probable owner or principal",
  not "owner".** Colorado does not require LLC members or managers in the register.
- **A c/o line is split three ways**: a person (tier 2), a company, usually the manager (tier 3), or a corporate tax mailbox or
  tax consultant (ignored).
- Register matches must agree word by word, each county word the start of the register word (abbreviations allowed: COLO ~ COLORADO), and a county name of 30+ characters may stop early (cut short on the roll); company types must agree. A type mismatch is kept
  only as "possible" and not counted.
- No people-search sites, no scraping. Every source is a government record or open data.

## Known gaps

- No roof material: the classifier learned house roofs.
- Year built for Springs only (El Paso's file); the statewide layer has none for the Denver counties.
- The paging bug: both the statewide composite and El Paso's MapServer **repeat and skip records when paging by offset**. The pull uses
  small map tiles (statewide) and parcel-number batches (El Paso), and checks the totals. Don't go back to offsets.
- **Roof size can include a parking structure** when the garage is the biggest outline on the parcel (737-745 Space Center Dr, Springs). The outline layers carry no building type; check the photo.
- The Springs roof-outline layer is undated and misses some newer buildings (see out/footprints-README.md).
